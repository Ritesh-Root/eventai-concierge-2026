/**
 * @fileoverview Integration tests for /api routes (chat, stream, vision, event, health).
 * Uses mocked Gemini service to validate request routing, validation, caching,
 * error handling, and response shapes without hitting the real API.
 */

'use strict';

const request = require('supertest');

jest.mock('../src/services/gemini', () => ({
  askGemini: jest.fn().mockResolvedValue('The opening keynote starts at 09:00 in Grand Hall A.'),
  streamGemini: jest.fn(),
  askGeminiVision: jest.fn().mockResolvedValue('Looks like the Figma booth sign.'),
  MODEL_NAME: 'gemini-2.5-flash-lite',
  VISION_MODEL: 'gemini-2.5-flash',
}));

const app = require('../server');
const { askGemini, streamGemini, askGeminiVision } = require('../src/services/gemini');

// ── POST /api/chat ───────────────────────────────────────────────────

describe('POST /api/chat', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a reply for a valid message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'When is the keynote?' })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('reply');
    expect(typeof res.body.reply).toBe('string');
    expect(askGemini).toHaveBeenCalledWith('When is the keynote?');
  });

  it('returns 400 when message is missing', async () => {
    const res = await request(app).post('/api/chat').send({}).expect(400);
    expect(res.body.error).toMatch(/message/i);
  });

  it('returns 400 when message is not a string', async () => {
    const res = await request(app).post('/api/chat').send({ message: 12345 }).expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when message is empty string', async () => {
    const res = await request(app).post('/api/chat').send({ message: '   ' }).expect(400);
    expect(res.body.error).toMatch(/1 and 500/);
  });

  it('returns 400 when message exceeds 500 characters', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'a'.repeat(501) })
      .expect(400);
    expect(res.body.error).toMatch(/1 and 500/);
  });

  it('accepts message at exactly 500 characters', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'a'.repeat(500) })
      .expect(200);
    expect(res.body).toHaveProperty('reply');
  });

  it('strips HTML tags (sanitize)', async () => {
    await request(app)
      .post('/api/chat')
      .send({ message: '<script>alert(1)</script>Where is the keynote?' })
      .expect(200);
    expect(askGemini).toHaveBeenCalledWith(expect.not.stringContaining('<script>'));
  });

  it('returns rate-limit headers', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Hi' }).expect(200);
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
  });

  it('returns X-Request-Id header', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Hi' }).expect(200);
    expect(res.headers).toHaveProperty('x-request-id');
  });

  it('returns 500 on generic Gemini error', async () => {
    askGemini.mockRejectedValueOnce(new Error('Something broke'));
    const res = await request(app).post('/api/chat').send({ message: 'Hi' }).expect(500);
    expect(res.body.error).toMatch(/went wrong/i);
  });

  it('returns 503 on invalid API key', async () => {
    askGemini.mockRejectedValueOnce(new Error('Invalid Gemini API key. Please check your configuration.'));
    const res = await request(app).post('/api/chat').send({ message: 'Hi' }).expect(503);
    expect(res.body.error).toMatch(/unavailable/i);
  });

  it('returns proper JSON Content-Type', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Hi' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('handles messages with Unicode correctly', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'Où est la conférence? 🎉' })
      .expect(200);
    expect(res.body).toHaveProperty('reply');
  });

  it('returns 429 on rate limit error from Gemini', async () => {
    const err = new Error('Rate limit');
    err.code = 'RATE_LIMIT';
    askGemini.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/chat').send({ message: 'Hi' }).expect(429);
    expect(res.body.error).toMatch(/busy/i);
  });

  it('returns 503 on NO_KEY error', async () => {
    const err = new Error('Missing key');
    err.code = 'NO_KEY';
    askGemini.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/chat').send({ message: 'Hi' }).expect(503);
    expect(res.body.error).toMatch(/unavailable/i);
  });

  it('returns 400 on BAD_IMAGE error code', async () => {
    const err = new Error('Invalid image format');
    err.code = 'BAD_IMAGE';
    askGemini.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/chat').send({ message: 'Hi' }).expect(400);
    expect(res.body.error).toMatch(/Invalid image/);
  });
});

// ── POST /api/chat/stream ────────────────────────────────────────────

describe('POST /api/chat/stream', () => {
  beforeEach(() => jest.clearAllMocks());

  it('streams SSE chunks then a done event', async () => {
    streamGemini.mockImplementation(async function* () {
      yield 'Hello ';
      yield 'world.';
    });

    const res = await request(app)
      .post('/api/chat/stream')
      .send({ message: 'Hi' })
      .buffer(true)
      .parse((r, cb) => {
        r.setEncoding('utf8');
        let data = '';
        r.on('data', (c) => {
          data += c;
        });
        r.on('end', () => cb(null, data));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/event-stream/);
    expect(res.body).toMatch(/event: chunk/);
    expect(res.body).toMatch(/Hello /);
    expect(res.body).toMatch(/event: done/);
  });

  it('returns 400 on invalid message', async () => {
    const res = await request(app).post('/api/chat/stream').send({}).expect(400);
    expect(res.body.error).toMatch(/message/i);
  });

  it('sends error event on stream failure', async () => {
    streamGemini.mockImplementation(async function* () {
      yield 'partial';
      throw new Error('Stream crashed');
    });

    const res = await request(app)
      .post('/api/chat/stream')
      .send({ message: 'Hi' })
      .buffer(true)
      .parse((r, cb) => {
        r.setEncoding('utf8');
        let data = '';
        r.on('data', (c) => { data += c; });
        r.on('end', () => cb(null, data));
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatch(/event: error/);
  });
});

// ── POST /api/vision ─────────────────────────────────────────────────

describe('POST /api/vision', () => {
  const validImage =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=';

  beforeEach(() => jest.clearAllMocks());

  it('returns a reply for a valid image + prompt', async () => {
    const res = await request(app)
      .post('/api/vision')
      .send({ image: validImage, prompt: 'What is this?' })
      .expect(200);
    expect(res.body).toHaveProperty('reply');
    expect(askGeminiVision).toHaveBeenCalled();
  });

  it('returns 400 when image is missing', async () => {
    const res = await request(app).post('/api/vision').send({}).expect(400);
    expect(res.body.error).toMatch(/image/i);
  });

  it('returns 400 when image is not a data URL', async () => {
    const res = await request(app)
      .post('/api/vision')
      .send({ image: 'https://example.com/x.png' })
      .expect(400);
    expect(res.body.error).toMatch(/data URL|base64/i);
  });

  it('returns 400 for unsupported MIME types', async () => {
    const bad = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    const res = await request(app).post('/api/vision').send({ image: bad }).expect(400);
    expect(res.body.error).toMatch(/format|Unsupported/i);
  });

  it('returns a reply for a valid image without prompt', async () => {
    const res = await request(app).post('/api/vision').send({ image: validImage }).expect(200);
    expect(res.body).toHaveProperty('reply');
  });

  it('returns 413 when image exceeds size limit', async () => {
    // ~7.2 MB of base64 decodes to ~5.4 MB, exceeding the 5 MB limit.
    const largeImage = 'data:image/png;base64,' + 'A'.repeat(7200000);
    const res = await request(app).post('/api/vision').send({ image: largeImage }).expect(413);
    expect(res.body.error).toMatch(/large/i);
  });

  it('returns 500 on vision service error', async () => {
    askGeminiVision.mockRejectedValueOnce(new Error('Vision model failed'));
    const validImage =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=';
    const res = await request(app)
      .post('/api/vision')
      .send({ image: validImage, prompt: 'test' })
      .expect(500);
    expect(res.body.error).toMatch(/went wrong/i);
  });
});

// ── GET /api/event ───────────────────────────────────────────────────

describe('GET /api/event', () => {
  it('returns the event dataset with expected shape', async () => {
    const res = await request(app).get('/api/event').expect(200);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('sessions');
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body).toHaveProperty('booths');
    expect(res.body).toHaveProperty('venue');
  });
});

// ── GET /api/health ──────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns status ok with metadata', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('uptime');
  });
});

// ── 404 handler ──────────────────────────────────────────────────────

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent').expect(404);
    expect(res.body).toHaveProperty('error', 'Not found');
  });
});
