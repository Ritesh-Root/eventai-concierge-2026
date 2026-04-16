/**
 * @fileoverview Rate limiter middleware for the chat API endpoint.
 * @module middleware/rateLimit
 */

const rateLimit = require('express-rate-limit');

/**
 * Creates an express-rate-limit middleware configured for the chat endpoint.
 * Limits each IP to 30 requests per 1-minute window.
 * @returns {Function} Rate-limit middleware.
 */
function createChatLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    message: {
      error: 'Too many requests. Please wait a moment before trying again.',
    },
    keyGenerator: (req) => {
      return req.ip;
    },
  });
}

module.exports = { createChatLimiter };
