/**
 * @fileoverview Tests for the input validation middleware.
 * Verifies chat message and vision input validators handle edge cases,
 * boundary conditions, and XSS payloads correctly.
 */

'use strict';

const { sanitize, validateChatMessage, validateVisionInput } = require('../src/middleware/validate');

// ── Helper: mock Express req/res/next ────────────────────────────────

function mockReq(body = {}, headers = {}) {
  return { body, headers };
}

function mockRes() {
  const res = {
    statusCode: 200,
    _json: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res._json = data;
      return res;
    },
  };
  return res;
}

// ── sanitize() ───────────────────────────────────────────────────────

describe('sanitize()', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert(1)</script>Hello')).toBe('alert(1)Hello');
  });

  it('trims whitespace', () => {
    expect(sanitize('   hello world   ')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(sanitize('')).toBe('');
  });

  it('strips nested tags', () => {
    expect(sanitize('<div><b>bold</b></div>')).toBe('bold');
  });

  it('handles self-closing tags', () => {
    expect(sanitize('before<br/>after')).toBe('beforeafter');
  });

  it('preserves non-HTML angle brackets in normal text', () => {
    expect(sanitize('5 > 3 and 2 < 4')).toBe('5 > 3 and 2 < 4');
  });
});

// ── validateChatMessage() ────────────────────────────────────────────

describe('validateChatMessage()', () => {
  it('passes valid messages and attaches cleanMessage', () => {
    const req = mockReq({ message: 'Where is the keynote?' });
    const res = mockRes();
    const next = jest.fn();

    validateChatMessage(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.cleanMessage).toBe('Where is the keynote?');
  });

  it('rejects missing message field', () => {
    const req = mockReq({});
    const res = mockRes();
    const next = jest.fn();

    validateChatMessage(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/message/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects non-string message', () => {
    const req = mockReq({ message: 12345 });
    const res = mockRes();
    const next = jest.fn();

    validateChatMessage(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects empty string message', () => {
    const req = mockReq({ message: '   ' });
    const res = mockRes();
    const next = jest.fn();

    validateChatMessage(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/1 and 500/);
  });

  it('rejects message exceeding 500 characters', () => {
    const req = mockReq({ message: 'a'.repeat(501) });
    const res = mockRes();
    const next = jest.fn();

    validateChatMessage(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/1 and 500/);
  });

  it('accepts message at exactly 500 characters', () => {
    const req = mockReq({ message: 'a'.repeat(500) });
    const res = mockRes();
    const next = jest.fn();

    validateChatMessage(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('sanitises HTML in the message', () => {
    const req = mockReq({ message: '<img onerror=alert(1)>Where?' });
    const res = mockRes();
    const next = jest.fn();

    validateChatMessage(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.cleanMessage).not.toContain('<img');
  });

  it('trims leading/trailing whitespace', () => {
    const req = mockReq({ message: '   hello   ' });
    const res = mockRes();
    const next = jest.fn();

    validateChatMessage(req, res, next);

    expect(req.cleanMessage).toBe('hello');
  });

  it('handles null body gracefully', () => {
    const req = { body: null };
    const res = mockRes();
    const next = jest.fn();

    validateChatMessage(req, res, next);

    expect(res.statusCode).toBe(400);
  });
});

// ── validateVisionInput() ────────────────────────────────────────────

describe('validateVisionInput()', () => {
  const validImage =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=';

  it('passes valid image and attaches parsed data', () => {
    const req = mockReq({ image: validImage, prompt: 'What is this?' });
    const res = mockRes();
    const next = jest.fn();

    validateVisionInput(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.imageData).toBeDefined();
    expect(req.imageData.mimeType).toBe('image/png');
    expect(req.cleanPrompt).toBe('What is this?');
  });

  it('rejects missing image', () => {
    const req = mockReq({});
    const res = mockRes();
    const next = jest.fn();

    validateVisionInput(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/image/i);
  });

  it('rejects non-data-URL image', () => {
    const req = mockReq({ image: 'https://example.com/x.png' });
    const res = mockRes();
    const next = jest.fn();

    validateVisionInput(req, res, next);

    expect(res.statusCode).toBe(400);
  });

  it('rejects unsupported MIME types', () => {
    const req = mockReq({ image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' });
    const res = mockRes();
    const next = jest.fn();

    validateVisionInput(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/Unsupported/i);
  });

  it('rejects oversized images with 413', () => {
    // ~7.2 MB of base64 decodes to ~5.4 MB, exceeding the 5 MB limit.
    const largeImage = 'data:image/png;base64,' + 'A'.repeat(7200000);
    const req = mockReq({ image: largeImage });
    const res = mockRes();
    const next = jest.fn();

    validateVisionInput(req, res, next);

    expect(res.statusCode).toBe(413);
    expect(res._json.error).toMatch(/large/i);
  });

  it('handles missing prompt gracefully', () => {
    const req = mockReq({ image: validImage });
    const res = mockRes();
    const next = jest.fn();

    validateVisionInput(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.cleanPrompt).toBe('');
  });

  it('sanitises HTML in prompt', () => {
    const req = mockReq({ image: validImage, prompt: '<script>x</script>Tell me' });
    const res = mockRes();
    const next = jest.fn();

    validateVisionInput(req, res, next);

    expect(req.cleanPrompt).not.toContain('<script>');
  });

  it('accepts JPEG images', () => {
    const jpeg = 'data:image/jpeg;base64,/9j/4AAQ';
    const req = mockReq({ image: jpeg });
    const res = mockRes();
    const next = jest.fn();

    validateVisionInput(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.imageData.mimeType).toBe('image/jpeg');
  });

  it('accepts WebP images', () => {
    const webp = 'data:image/webp;base64,UklGRh4A';
    const req = mockReq({ image: webp });
    const res = mockRes();
    const next = jest.fn();

    validateVisionInput(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.imageData.mimeType).toBe('image/webp');
  });
});
