/**
 * @fileoverview Centralised, immutable application configuration.
 * Validates required environment variables at import time so the process
 * fails fast with a clear message rather than crashing deep in a handler.
 *
 * Every tunable constant lives here — no magic numbers in route files.
 * @module config
 */

'use strict';

/**
 * Validates that a required env var is present and non-empty.
 * @param {string} name - Variable name.
 * @returns {string} The value.
 * @throws {Error} If the variable is missing or blank.
 */
function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'See .env.example for the full list.'
    );
  }
  return value.trim();
}

/**
 * Reads an optional env var with a fallback default.
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function optionalEnv(name, fallback) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

// ── Build the config object ──────────────────────────────────────────

const config = Object.freeze({
  /** Server port — Cloud Run injects PORT automatically. */
  port: parseInt(optionalEnv('PORT', '8080'), 10),

  /** Node environment string. */
  env: optionalEnv('NODE_ENV', 'development'),

  /** True when running inside Jest or other test runners. */
  isTest: process.env.NODE_ENV === 'test',

  /** True for production builds (Cloud Run, Docker). */
  isProduction: process.env.NODE_ENV === 'production',

  /** Google AI / Gemini configuration. */
  gemini: Object.freeze({
    /** API key — required unless running tests with mocks. */
    apiKey:
      process.env.NODE_ENV === 'test'
        ? process.env.GEMINI_API_KEY || 'test-placeholder'
        : requireEnv('GEMINI_API_KEY'),

    /** Primary text/streaming model. */
    textModel: optionalEnv('GEMINI_TEXT_MODEL', 'gemini-2.5-flash-lite'),

    /** Vision (multi-modal) model. */
    visionModel: optionalEnv('GEMINI_VISION_MODEL', 'gemini-2.5-flash'),

    /** Maximum retry attempts on transient errors (429 / 5xx). */
    maxRetries: parseInt(optionalEnv('GEMINI_MAX_RETRIES', '2'), 10),

    /** Base back-off delay in ms before the first retry. */
    baseBackoffMs: parseInt(optionalEnv('GEMINI_BACKOFF_MS', '300'), 10),

    /** Temperature for creative-yet-grounded responses. */
    temperature: parseFloat(optionalEnv('GEMINI_TEMPERATURE', '0.7')),

    /** Maximum output tokens per response. */
    maxOutputTokens: parseInt(optionalEnv('GEMINI_MAX_TOKENS', '1024'), 10),
  }),

  /** Rate-limiting settings. */
  rateLimit: Object.freeze({
    /** Window duration in milliseconds. */
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),

    /** Maximum requests per window per IP. */
    maxRequests: parseInt(optionalEnv('RATE_LIMIT_MAX', '30'), 10),
  }),

  /** Input constraints. */
  input: Object.freeze({
    /** Maximum characters in a chat message. */
    maxMessageLength: 500,

    /** Maximum image upload size in bytes (5 MB). */
    maxImageBytes: 5 * 1024 * 1024,

    /** Accepted image MIME types. */
    allowedImageMimes: Object.freeze([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ]),

    /** Express JSON body limit (covers base-64 image + JSON overhead). */
    bodyLimit: '7mb',
  }),

  /** In-memory response cache settings. */
  cache: Object.freeze({
    /** Time-to-live in milliseconds (10 minutes). */
    ttlMs: 10 * 60 * 1000,

    /** Maximum number of cached entries before LRU eviction. */
    maxEntries: 500,
  }),

  /** Static-file serving. */
  staticMaxAge: '1d',
});

module.exports = config;
