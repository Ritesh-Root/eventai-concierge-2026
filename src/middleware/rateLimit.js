/**
 * @fileoverview Rate limiter middleware for the chat API endpoints.
 *
 * Uses a sliding-window algorithm (via express-rate-limit) to limit each
 * IP address to a configurable number of requests per minute. Standard
 * `RateLimit-*` response headers are included so well-behaved clients can
 * self-throttle.
 *
 * @module middleware/rateLimit
 */

'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Creates an express-rate-limit middleware configured for the chat endpoint.
 * Limits each IP to `config.rateLimit.maxRequests` per window.
 *
 * @returns {Function} Rate-limit middleware.
 */
function createChatLimiter() {
  if (config.isTest) {
    return (req, res, next) => next();
  }
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable deprecated `X-RateLimit-*` headers
    message: {
      error: 'Too many requests. Please wait a moment before trying again.',
    },
    keyGenerator: (req) => {
      // Use X-Forwarded-For on Cloud Run (behind Google Front End proxy).
      return req.ip;
    },
  });
}

module.exports = { createChatLimiter };
