/**
 * @fileoverview Tests for the custom error classes.
 */

'use strict';

const {
  AppError,
  ValidationError,
  AuthError,
  RateLimitError,
  UpstreamError,
} = require('../src/utils/errors');

describe('AppError', () => {
  it('should be an instance of Error', () => {
    const err = new AppError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('should have correct defaults', () => {
    const err = new AppError('test');
    expect(err.message).toBe('test');
    expect(err.status).toBe(500);
    expect(err.code).toBe('APP_ERROR');
    expect(err.name).toBe('AppError');
  });

  it('should accept custom status and code', () => {
    const err = new AppError('custom', 418, 'TEAPOT');
    expect(err.status).toBe(418);
    expect(err.code).toBe('TEAPOT');
  });

  it('should serialise to client-safe JSON', () => {
    const err = new AppError('safe message', 400, 'BAD');
    const json = err.toJSON();
    expect(json).toEqual({ error: 'safe message', code: 'BAD' });
    expect(json.stack).toBeUndefined(); // no stack leaked
  });

  it('should have a stack trace', () => {
    const err = new AppError('with stack');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AppError');
  });
});

describe('ValidationError', () => {
  it('should map to HTTP 400', () => {
    const err = new ValidationError('bad input');
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
    expect(err.name).toBe('ValidationError');
  });

  it('should be an instance of AppError', () => {
    const err = new ValidationError('x');
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('AuthError', () => {
  it('should map to HTTP 503 with default message', () => {
    const err = new AuthError();
    expect(err.status).toBe(503);
    expect(err.code).toBe('AUTH');
    expect(err.message).toMatch(/unavailable/i);
  });

  it('should accept a custom message', () => {
    const err = new AuthError('Custom auth error');
    expect(err.message).toBe('Custom auth error');
  });
});

describe('RateLimitError', () => {
  it('should map to HTTP 429 with default message', () => {
    const err = new RateLimitError();
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.message).toMatch(/busy/i);
  });
});

describe('UpstreamError', () => {
  it('should map to HTTP 500 with default message', () => {
    const err = new UpstreamError();
    expect(err.status).toBe(500);
    expect(err.code).toBe('UPSTREAM');
    expect(err.message).toMatch(/failed/i);
  });
});

describe('Error hierarchy', () => {
  it('all custom errors are caught by instanceof AppError', () => {
    const errors = [
      new ValidationError('v'),
      new AuthError(),
      new RateLimitError(),
      new UpstreamError(),
    ];
    errors.forEach((err) => {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  it('each error has the correct name property', () => {
    expect(new ValidationError('x').name).toBe('ValidationError');
    expect(new AuthError().name).toBe('AuthError');
    expect(new RateLimitError().name).toBe('RateLimitError');
    expect(new UpstreamError().name).toBe('UpstreamError');
  });
});
