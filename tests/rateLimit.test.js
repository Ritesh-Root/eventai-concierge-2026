/**
 * @fileoverview Tests for the rate-limit middleware configuration.
 */

'use strict';

const { createChatLimiter } = require('../src/middleware/rateLimit');

describe('Rate Limiter', () => {
  it('should export createChatLimiter as a function', () => {
    expect(typeof createChatLimiter).toBe('function');
  });

  it('should return a middleware function', () => {
    const limiter = createChatLimiter();
    // express-rate-limit returns a middleware function
    expect(typeof limiter).toBe('function');
  });

  it('should have the expected arity (req, res, next)', () => {
    const limiter = createChatLimiter();
    // Middleware functions typically have arity 3
    expect(limiter.length).toBeGreaterThanOrEqual(2);
  });
});
