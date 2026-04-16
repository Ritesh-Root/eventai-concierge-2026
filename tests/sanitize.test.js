/**
 * @fileoverview Tests for the custom XSS sanitizer middleware.
 */

'use strict';

const { clean, sanitizeDeep, xssSanitize } = require('../src/middleware/sanitize');

describe('clean()', () => {
  it('should strip script tags', () => {
    expect(clean('<script>alert(1)</script>Hello')).toBe('alert(1)Hello');
  });

  it('should strip img tags with event handlers', () => {
    expect(clean('<img onerror=alert(1)>text')).toBe('text');
  });

  it('should strip nested tags', () => {
    expect(clean('<div><p><b>bold</b></p></div>')).toBe('bold');
  });

  it('should leave plain text unchanged', () => {
    expect(clean('Hello world')).toBe('Hello world');
  });

  it('should handle empty strings', () => {
    expect(clean('')).toBe('');
  });

  it('should strip self-closing tags', () => {
    expect(clean('before<br/>after')).toBe('beforeafter');
  });
});

describe('sanitizeDeep()', () => {
  it('should sanitize a simple string', () => {
    expect(sanitizeDeep('<b>bold</b>')).toBe('bold');
  });

  it('should sanitize an array of strings', () => {
    expect(sanitizeDeep(['<i>a</i>', '<b>b</b>'])).toEqual(['a', 'b']);
  });

  it('should sanitize nested objects', () => {
    const input = { msg: '<script>x</script>hi', nested: { val: '<b>bold</b>' } };
    const result = sanitizeDeep(input);
    expect(result.msg).toBe('xhi');
    expect(result.nested.val).toBe('bold');
  });

  it('should leave numbers unchanged', () => {
    expect(sanitizeDeep(42)).toBe(42);
  });

  it('should leave booleans unchanged', () => {
    expect(sanitizeDeep(true)).toBe(true);
  });

  it('should leave null unchanged', () => {
    expect(sanitizeDeep(null)).toBe(null);
  });

  it('should handle mixed arrays', () => {
    expect(sanitizeDeep(['<b>x</b>', 42, true])).toEqual(['x', 42, true]);
  });
});

describe('xssSanitize() middleware', () => {
  function mockReq(body, query, params) {
    return { body, query: query || {}, params: params || {} };
  }

  it('should sanitize req.body', () => {
    const req = mockReq({ message: '<script>bad</script>good' });
    const next = jest.fn();
    xssSanitize()(req, {}, next);
    expect(req.body.message).toBe('badgood');
    expect(next).toHaveBeenCalled();
  });

  it('should sanitize req.query', () => {
    const req = mockReq({}, { search: '<img>xss' });
    const next = jest.fn();
    xssSanitize()(req, {}, next);
    expect(req.query.search).toBe('xss');
    expect(next).toHaveBeenCalled();
  });

  it('should sanitize req.params', () => {
    const req = mockReq({}, {}, { id: '<b>123</b>' });
    const next = jest.fn();
    xssSanitize()(req, {}, next);
    expect(req.params.id).toBe('123');
    expect(next).toHaveBeenCalled();
  });

  it('should handle missing body gracefully', () => {
    const req = { query: {}, params: {} };
    const next = jest.fn();
    xssSanitize()(req, {}, next);
    expect(next).toHaveBeenCalled();
  });

  it('should handle missing query gracefully', () => {
    const req = { body: {}, params: {} };
    const next = jest.fn();
    xssSanitize()(req, {}, next);
    expect(next).toHaveBeenCalled();
  });

  it('should handle missing params gracefully', () => {
    const req = { body: {}, query: {} };
    const next = jest.fn();
    xssSanitize()(req, {}, next);
    expect(next).toHaveBeenCalled();
  });
});
