/**
 * @fileoverview Chat API routes.
 *   POST /api/chat         — single-shot JSON reply
 *   POST /api/chat/stream  — server-sent events stream of text chunks
 *   POST /api/vision       — image + text multi-modal reply
 *   GET  /api/event        — returns the grounded event dataset for the UI
 * @module routes/chat
 */

const express = require('express');
const {
  askGemini,
  streamGemini,
  askGeminiVision,
} = require('../services/gemini');
const eventData = require('../utils/eventData');
const { createChatLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const chatLimiter = createChatLimiter();

const MAX_MESSAGE_LEN = 500;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function sanitize(input) {
  return input.replace(/<[^>]*>/g, '').trim();
}

function validateMessage(message) {
  if (!message || typeof message !== 'string') {
    return 'A "message" field (string) is required.';
  }
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_LEN) {
    return `Message must be between 1 and ${MAX_MESSAGE_LEN} characters.`;
  }
  return null;
}

function mapErrorStatus(err) {
  if (err.code === 'NO_KEY' || err.code === 'AUTH' || /API key/i.test(err.message || '')) {
    return { status: 503, body: { error: 'AI service is temporarily unavailable. Please try again later.' } };
  }
  if (err.code === 'RATE_LIMIT') {
    return { status: 429, body: { error: 'The AI is busy right now. Please wait a few seconds and try again.' } };
  }
  if (err.code === 'BAD_IMAGE') {
    return { status: 400, body: { error: err.message } };
  }
  return { status: 500, body: { error: 'Something went wrong. Please try again.' } };
}

/**
 * POST /api/chat — JSON reply for simple clients.
 */
router.post('/chat', chatLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    const err = validateMessage(message);
    if (err) return res.status(400).json({ error: err });

    const reply = await askGemini(sanitize(message.trim()));
    return res.json({ reply });
  } catch (err) {
    console.error('[ChatRoute] /chat error:', err.code || '?', err.message);
    const { status, body } = mapErrorStatus(err);
    return res.status(status).json(body);
  }
});

/**
 * POST /api/chat/stream — Server-Sent Events stream of text chunks.
 * Event names:
 *   chunk  — a fragment of assistant text
 *   done   — terminal marker (no data)
 *   error  — terminal error (data: {message})
 */
router.post('/chat/stream', chatLimiter, async (req, res) => {
  const { message } = req.body;
  const err = validateMessage(message);
  if (err) return res.status(400).json({ error: err });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const write = (event, data = '') => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${data}\n\n`);
  };

  try {
    const clean = sanitize(message.trim());
    // heartbeat
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => clearInterval(heartbeat));

    for await (const chunk of streamGemini(clean)) {
      write('chunk', JSON.stringify({ text: chunk }));
    }
    clearInterval(heartbeat);
    write('done', JSON.stringify({ ok: true }));
    res.end();
  } catch (e) {
    console.error('[ChatRoute] /chat/stream error:', e.code || '?', e.message);
    const { body } = mapErrorStatus(e);
    write('error', JSON.stringify(body));
    res.end();
  }
});

/**
 * POST /api/vision — Gemini Vision (multi-modal).
 * Expects JSON { image: dataUrl, prompt?: string }
 */
router.post('/vision', chatLimiter, async (req, res) => {
  try {
    const { image, prompt } = req.body || {};
    if (typeof image !== 'string' || !image.startsWith('data:')) {
      return res.status(400).json({ error: 'A base64 data-URL "image" field is required.' });
    }
    const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Image must be a base64 data URL.' });
    }
    const mimeType = match[1].toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
      return res.status(400).json({ error: 'Unsupported image format. Use JPEG, PNG, WebP, HEIC, or HEIF.' });
    }
    const bytes = Buffer.byteLength(match[2], 'base64');
    if (bytes > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Image too large (max 5 MB).' });
    }

    const safePrompt = typeof prompt === 'string' ? sanitize(prompt).slice(0, MAX_MESSAGE_LEN) : '';

    const reply = await askGeminiVision({ data: match[2], mimeType }, safePrompt);
    return res.json({ reply });
  } catch (err) {
    console.error('[ChatRoute] /vision error:', err.code || '?', err.message);
    const { status, body } = mapErrorStatus(err);
    return res.status(status).json(body);
  }
});

/**
 * GET /api/event — returns the grounded event dataset for the UI
 * (floor map, agenda builder, booth directory).
 */
router.get('/event', (_req, res) => {
  res.json(eventData);
});

module.exports = router;
