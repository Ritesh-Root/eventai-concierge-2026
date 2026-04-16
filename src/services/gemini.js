/**
 * @fileoverview Gemini AI service — wraps the @google/generative-ai SDK.
 *
 * Provides three capabilities:
 *   1. askGemini         — single-shot text chat, grounded in event data.
 *   2. streamGemini      — async-iterable stream of text chunks (SSE-friendly).
 *   3. askGeminiVision   — multi-modal (image + text) grounded reply.
 *
 * Includes retry-with-exponential-backoff for transient errors (429 / 5xx)
 * and typed error classes for clean upstream error handling.
 *
 * @module services/gemini
 */

'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const logger = require('../utils/logger');
const { AuthError, RateLimitError, UpstreamError } = require('../utils/errors');
const { buildSystemPrompt, buildVisionPrompt } = require('../utils/prompts');
const eventData = require('../utils/eventData');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Determines if an error is transient (retryable).
 * @param {Error} err
 * @returns {boolean}
 */
function isTransient(err) {
  const status = err?.status;
  const msg = (err?.message || '').toLowerCase();
  if (status === 429 || (status >= 500 && status < 600)) {
    return true;
  }
  return /rate.?limit|quota|resource_?exhausted|unavailable|overloaded|503|500|429/.test(
    msg
  );
}

/**
 * Determines if an error is an authentication / authorization failure.
 * @param {Error} err
 * @returns {boolean}
 */
function isAuthError(err) {
  const status = err?.status;
  const msg = (err?.message || '').toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    /api_?key_?invalid|permission_?denied|unauthenti/.test(msg)
  );
}

/**
 * Creates and returns an authenticated GoogleGenerativeAI client.
 * @returns {GoogleGenerativeAI}
 * @throws {AuthError} When GEMINI_API_KEY is not configured.
 */
function getClient() {
  const apiKey = config.gemini.apiKey;
  if (!apiKey || apiKey === 'test-placeholder') {
    const e = new Error(
      'GEMINI_API_KEY is not set. Please configure it in your .env file.'
    );
    e.code = 'NO_KEY';
    throw e;
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Re-throws an error as a typed application error.
 * @param {Error} err      The original error.
 * @param {Error} [last]   The last error in a retry chain.
 * @throws {AuthError|RateLimitError|UpstreamError}
 */
function rethrow(err, last = err) {
  if (isAuthError(err)) {
    throw new AuthError(
      'Invalid Gemini API key. Please check your configuration.'
    );
  }
  if (isTransient(last)) {
    throw new RateLimitError();
  }
  throw new UpstreamError();
}

/**
 * Single-shot text chat — returns the model's full reply.
 *
 * @param {string} userMessage        The user's question.
 * @param {Object} [eventContext]     Event data for grounding (default: bundled data).
 * @returns {Promise<string>}         The AI's grounded response.
 */
async function askGemini(userMessage, eventContext = eventData) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: config.gemini.textModel,
    systemInstruction: buildSystemPrompt(
      JSON.stringify(eventContext, null, 2)
    ),
    generationConfig: {
      temperature: config.gemini.temperature,
      maxOutputTokens: config.gemini.maxOutputTokens,
    },
  });

  let lastErr;
  for (let attempt = 0; attempt <= config.gemini.maxRetries; attempt += 1) {
    try {
      const result = await model.generateContent(userMessage);
      const text = result.response.text();
      if (!text || text.trim().length === 0) {
        return 'I apologize, but I could not generate a response. Could you rephrase your question?';
      }
      return text.trim();
    } catch (err) {
      lastErr = err;
      logger.error(`askGemini attempt ${attempt + 1} failed`, {
        message: err.message,
        status: err.status,
      });
      if (isAuthError(err)) {
        rethrow(err);
      }
      if (!isTransient(err) || attempt === config.gemini.maxRetries) {
        break;
      }
      await sleep(
        config.gemini.baseBackoffMs * 2 ** attempt +
          Math.floor(Math.random() * 100)
      );
    }
  }
  rethrow(lastErr);
}

/**
 * Streaming text chat — yields string chunks as Gemini produces them.
 * Consumers can write each chunk to an SSE stream.
 *
 * @param {string} userMessage
 * @param {Object} [eventContext=eventData]
 * @returns {AsyncGenerator<string>}
 */
async function* streamGemini(userMessage, eventContext = eventData) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: config.gemini.textModel,
    systemInstruction: buildSystemPrompt(
      JSON.stringify(eventContext, null, 2)
    ),
    generationConfig: {
      temperature: config.gemini.temperature,
      maxOutputTokens: config.gemini.maxOutputTokens,
    },
  });

  try {
    const result = await model.generateContentStream(userMessage);
    for await (const chunk of result.stream) {
      const text = chunk?.text?.();
      if (text) {
        yield text;
      }
    }
  } catch (err) {
    logger.error('streamGemini failed', { message: err.message });
    rethrow(err);
  }
}

/**
 * Multi-modal chat — accepts an image (base64) + optional text prompt.
 *
 * @param {{ data: string, mimeType: string }} image  Parsed image data.
 * @param {string} [userText]                          Optional text prompt.
 * @param {Object} [eventContext=eventData]             Grounding data.
 * @returns {Promise<string>}                           The AI's response.
 */
async function askGeminiVision(image, userText = '', eventContext = eventData) {
  if (!image?.data || !image?.mimeType) {
    const e = new Error(
      'Image data and mimeType are required for vision.'
    );
    e.code = 'BAD_IMAGE';
    throw e;
  }

  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: config.gemini.visionModel,
    systemInstruction: buildVisionPrompt(
      JSON.stringify(eventContext, null, 2)
    ),
    generationConfig: {
      temperature: config.gemini.temperature,
      maxOutputTokens: config.gemini.maxOutputTokens,
    },
  });

  const parts = [
    { inlineData: { data: image.data, mimeType: image.mimeType } },
  ];
  if (userText && userText.trim()) {
    parts.push({ text: userText.trim() });
  } else {
    parts.push({
      text: 'What is in this image, and how does it relate to the event?',
    });
  }

  let lastErr;
  for (let attempt = 0; attempt <= config.gemini.maxRetries; attempt += 1) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
      });
      const text = result.response.text();
      if (!text || text.trim().length === 0) {
        return "I couldn't read the image clearly. Could you try another angle?";
      }
      return text.trim();
    } catch (err) {
      lastErr = err;
      logger.error(`askGeminiVision attempt ${attempt + 1} failed`, {
        message: err.message,
      });
      if (isAuthError(err)) {
        rethrow(err);
      }
      if (!isTransient(err) || attempt === config.gemini.maxRetries) {
        break;
      }
      await sleep(
        config.gemini.baseBackoffMs * 2 ** attempt +
          Math.floor(Math.random() * 100)
      );
    }
  }
  rethrow(lastErr);
}

module.exports = {
  askGemini,
  streamGemini,
  askGeminiVision,
  MODEL_NAME: config.gemini.textModel,
  VISION_MODEL: config.gemini.visionModel,
};
