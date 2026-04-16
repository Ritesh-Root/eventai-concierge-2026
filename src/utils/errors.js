/**
 * @fileoverview Custom error classes for EventAI Concierge.
 *
 * A typed error hierarchy lets route handlers and the global error handler
 * map exceptions to appropriate HTTP status codes without string-matching.
 *
 * Hierarchy:
 *   AppError (base)
 *   ├── ValidationError   → 400
 *   ├── AuthError          → 503 (key invalid — not the user's fault)
 *   ├── RateLimitError     → 429
 *   └── UpstreamError      → 500
 *
 * @module utils/errors
 */

'use strict';

/**
 * Base application error. All custom errors extend this so
 * `instanceof AppError` catches everything in one guard.
 */
class AppError extends Error {
  /**
   * @param {string} message  Human-readable error description.
   * @param {number} status   HTTP status code to return to the client.
   * @param {string} code     Machine-readable error code (e.g. 'VALIDATION').
   */
  constructor(message, status = 500, code = 'APP_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    // Maintains proper stack trace for where the error was thrown (V8).
    Error.captureStackTrace?.(this, this.constructor);
  }

  /** Serialises to a client-safe JSON object (no stack traces leaked). */
  toJSON() {
    return { error: this.message, code: this.code };
  }
}

/**
 * Thrown when user input fails validation (bad type, too long, etc.).
 * Maps to HTTP 400 Bad Request.
 */
class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION');
  }
}

/**
 * Thrown when the Gemini API key is missing or invalid.
 * Maps to HTTP 503 Service Unavailable (it's not the user's fault).
 */
class AuthError extends AppError {
  constructor(message = 'AI service is temporarily unavailable. Please try again later.') {
    super(message, 503, 'AUTH');
  }
}

/**
 * Thrown when the upstream AI service is rate-limiting us.
 * Maps to HTTP 429 Too Many Requests.
 */
class RateLimitError extends AppError {
  constructor(message = 'The AI is busy right now. Please wait a few seconds and try again.') {
    super(message, 429, 'RATE_LIMIT');
  }
}

/**
 * Thrown when the upstream AI service fails for any other reason.
 * Maps to HTTP 500 Internal Server Error.
 */
class UpstreamError extends AppError {
  constructor(message = 'Failed to get a response from the AI service.') {
    super(message, 500, 'UPSTREAM');
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  RateLimitError,
  UpstreamError,
};
