/**
 * @fileoverview Input validation middleware for EventAI Concierge.
 *
 * Separates validation logic from route handlers for testability and
 * single-responsibility. Each validator is an Express middleware that
 * either calls `next()` on success or responds with a 400/413 error.
 *
 * @module middleware/validate
 */

'use strict';

const config = require('../config');

const ALLOWED_MIMES = new Set(config.input.allowedImageMimes);

/**
 * Strips all HTML tags from a string to prevent XSS via model output injection.
 * @param {string} input
 * @returns {string} Sanitised string.
 */
function sanitize(input) {
  return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Express middleware — validates and sanitises the `message` field
 * on POST /api/chat and POST /api/chat/stream.
 */
function validateChatMessage(req, res, next) {
  const { message } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      error: 'A "message" field (string) is required.',
    });
  }

  const trimmed = message.trim();

  if (trimmed.length === 0 || trimmed.length > config.input.maxMessageLength) {
    return res.status(400).json({
      error: `Message must be between 1 and ${config.input.maxMessageLength} characters.`,
    });
  }

  // Attach sanitised version for downstream use.
  req.cleanMessage = sanitize(trimmed);
  return next();
}

/**
 * Express middleware — validates the `image` data-URL and optional
 * `prompt` on POST /api/vision.
 */
function validateVisionInput(req, res, next) {
  const { image, prompt } = req.body || {};

  if (typeof image !== 'string' || !image.startsWith('data:')) {
    return res.status(400).json({
      error: 'A base64 data-URL "image" field is required.',
    });
  }

  const match = image.match(
    /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i
  );
  if (!match) {
    return res.status(400).json({
      error: 'Image must be a base64 data URL.',
    });
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_MIMES.has(mimeType)) {
    return res.status(400).json({
      error:
        'Unsupported image format. Use JPEG, PNG, WebP, HEIC, or HEIF.',
    });
  }

  const bytes = Buffer.byteLength(match[2], 'base64');
  if (bytes > config.input.maxImageBytes) {
    return res.status(413).json({ error: 'Image too large (max 5 MB).' });
  }

  // Attach parsed image data for the route handler.
  req.imageData = { data: match[2], mimeType };
  req.cleanPrompt =
    typeof prompt === 'string'
      ? sanitize(prompt).slice(0, config.input.maxMessageLength)
      : '';

  return next();
}

module.exports = {
  sanitize,
  validateChatMessage,
  validateVisionInput,
};
