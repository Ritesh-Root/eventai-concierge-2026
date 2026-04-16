/**
 * @fileoverview Chat API routes for EventAI Concierge.
 *
 * Endpoints:
 *   POST /api/chat         — single-shot JSON reply
 *   POST /api/chat/stream  — server-sent events stream of text chunks
 *   POST /api/vision       — image + text multi-modal reply
 *   GET  /api/event        — returns the grounded event dataset for the UI
 *
 * All AI endpoints use the validation middleware for input checks and the
 * rate-limiter for abuse prevention. Responses are cached in-memory with
 * LRU eviction to reduce upstream API calls.
 *
 * @module routes/chat
 */

'use strict';

const express = require('express');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const {
  askGemini,
  streamGemini,
  askGeminiVision,
} = require('../services/gemini');
const eventData = require('../utils/eventData');
const { createChatLimiter } = require('../middleware/rateLimit');
const {
  validateChatMessage,
  validateVisionInput,
} = require('../middleware/validate');

const router = express.Router();
const chatLimiter = createChatLimiter();

// ── LRU Response Cache ───────────────────────────────────────────────
// Memory-bounded in-memory cache with TTL and max-size eviction.
// Reduces redundant Gemini API calls for repeated questions.

const responseCache = new Map();

/**
 * Retrieves a cached response if still within TTL.
 * @param {string} key  Sanitised user message.
 * @returns {string|null} Cached reply or null.
 */
function getCached(key) {
  const item = responseCache.get(key);
  if (item && Date.now() - item.time < config.cache.ttlMs) {
    logger.debug('Cache HIT', { key: key.slice(0, 40) });
    return item.value;
  }
  if (item) {
    responseCache.delete(key); // expired — clean up
  }
  return null;
}

/**
 * Stores a response in the cache with LRU eviction when full.
 * @param {string} key   Sanitised user message.
 * @param {string} value AI response text.
 */
function setCache(key, value) {
  // LRU eviction: delete oldest entry when at capacity.
  if (responseCache.size >= config.cache.maxEntries) {
    const oldest = responseCache.keys().next().value;
    responseCache.delete(oldest);
    logger.debug('Cache LRU eviction', { evicted: oldest?.slice(0, 40) });
  }
  responseCache.set(key, { value, time: Date.now() });
}

/**
 * Maps an AppError (or generic error) to an HTTP response.
 * @param {Error} err
 * @returns {{ status: number, body: Object }}
 */
function mapErrorStatus(err) {
  if (err instanceof AppError) {
    return { status: err.status, body: err.toJSON() };
  }
  if (err.code === 'NO_KEY' || err.code === 'AUTH' || /API key/i.test(err.message || '')) {
    return {
      status: 503,
      body: { error: 'AI service is temporarily unavailable. Please try again later.' },
    };
  }
  if (err.code === 'RATE_LIMIT') {
    return {
      status: 429,
      body: { error: 'The AI is busy right now. Please wait a few seconds and try again.' },
    };
  }
  if (err.code === 'BAD_IMAGE') {
    return { status: 400, body: { error: err.message } };
  }
  return {
    status: 500,
    body: { error: 'Something went wrong. Please try again.' },
  };
}

// ── POST /api/chat ───────────────────────────────────────────────────

/**
 * Single-shot JSON reply for simple clients.
 */
router.post('/chat', chatLimiter, validateChatMessage, async (req, res) => {
  try {
    const cleanMsg = req.cleanMessage;

    const cached = getCached(cleanMsg);
    if (cached) {
      return res.json({ reply: cached });
    }

    const reply = await askGemini(cleanMsg);
    setCache(cleanMsg, reply);
    return res.json({ reply });
  } catch (err) {
    logger.error('POST /api/chat error', {
      code: err.code,
      message: err.message,
      requestId: req.id,
    });
    const { status, body } = mapErrorStatus(err);
    return res.status(status).json(body);
  }
});

// ── POST /api/chat/stream ────────────────────────────────────────────

/**
 * Server-Sent Events stream of text chunks.
 * Event names:
 *   chunk  — a fragment of assistant text
 *   done   — terminal marker (no data)
 *   error  — terminal error (data: {message})
 */
router.post('/chat/stream', chatLimiter, validateChatMessage, async (req, res) => {
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
    const clean = req.cleanMessage;

    // Heartbeat keeps the connection alive through proxies.
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => clearInterval(heartbeat));

    const cached = getCached(clean);
    if (cached) {
      write('chunk', JSON.stringify({ text: cached }));
      clearInterval(heartbeat);
      write('done', JSON.stringify({ ok: true }));
      res.end();
      return;
    }

    let fullText = '';
    for await (const chunk of streamGemini(clean)) {
      fullText += chunk;
      write('chunk', JSON.stringify({ text: chunk }));
    }
    setCache(clean, fullText);

    clearInterval(heartbeat);
    write('done', JSON.stringify({ ok: true }));
    res.end();
  } catch (e) {
    logger.error('POST /api/chat/stream error', {
      code: e.code,
      message: e.message,
      requestId: req.id,
    });
    const { body } = mapErrorStatus(e);
    write('error', JSON.stringify(body));
    res.end();
  }
});

// ── POST /api/vision ─────────────────────────────────────────────────

/**
 * Gemini Vision (multi-modal) endpoint.
 * Receives a validated image data-URL and optional text prompt.
 */
router.post('/vision', chatLimiter, validateVisionInput, async (req, res) => {
  try {
    const reply = await askGeminiVision(req.imageData, req.cleanPrompt);
    return res.json({ reply });
  } catch (err) {
    logger.error('POST /api/vision error', {
      code: err.code,
      message: err.message,
      requestId: req.id,
    });
    const { status, body } = mapErrorStatus(err);
    return res.status(status).json(body);
  }
});

// ── GET /api/event ───────────────────────────────────────────────────

/**
 * Returns the grounded event dataset for the UI
 * (floor map, agenda builder, booth directory).
 */
router.get('/event', (_req, res) => {
  res.json(eventData);
});

// Expose cache for test cleanup
router._responseCache = responseCache;

module.exports = router;
