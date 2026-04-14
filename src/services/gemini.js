/**
 * @fileoverview Gemini AI service — wraps the @google/generative-ai SDK.
 * Provides three capabilities:
 *   1. askGemini         — single-shot text chat, grounded in event data.
 *   2. streamGemini      — async-iterable stream of text chunks (SSE-friendly).
 *   3. askGeminiVision   — multi-modal (image + text) grounded reply.
 * Includes retry-with-backoff for transient errors (429 / 5xx).
 * @module services/gemini
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildSystemPrompt, buildVisionPrompt } = require('../utils/prompts');
const eventData = require('../utils/eventData');

const TEXT_MODEL = 'gemini-2.5-flash-lite';
const VISION_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransient(err) {
  const status = err?.status;
  const msg = (err?.message || '').toLowerCase();
  if (status === 429 || (status >= 500 && status < 600)) {
    return true;
  }
  return /rate.?limit|quota|resource_?exhausted|unavailable|overloaded|503|500|429/.test(msg);
}

function isAuthError(err) {
  const status = err?.status;
  const msg = (err?.message || '').toLowerCase();
  return status === 401 || status === 403 || /api_?key_?invalid|permission_?denied|unauthenti/.test(msg);
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const e = new Error('GEMINI_API_KEY is not set. Please configure it in your .env file.');
    e.code = 'NO_KEY';
    throw e;
  }
  return new GoogleGenerativeAI(apiKey);
}

function rethrow(err, lastErr = err) {
  if (isAuthError(err)) {
    const e = new Error('Invalid Gemini API key. Please check your configuration.');
    e.code = 'AUTH';
    throw e;
  }
  if (isTransient(lastErr)) {
    const e = new Error('AI rate limit reached — please try again in a few seconds.');
    e.code = 'RATE_LIMIT';
    throw e;
  }
  const e = new Error('Failed to get a response from the AI service.');
  e.code = 'UPSTREAM';
  throw e;
}

/**
 * Single-shot text chat — returns the model's full reply.
 */
async function askGemini(userMessage, eventContext = eventData) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: TEXT_MODEL,
    systemInstruction: buildSystemPrompt(JSON.stringify(eventContext, null, 2)),
  });

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await model.generateContent(userMessage);
      const text = result.response.text();
      if (!text || text.trim().length === 0) {
        return 'I apologize, but I could not generate a response. Could you rephrase your question?';
      }
      return text.trim();
    } catch (err) {
      lastErr = err;
      console.error(`[GeminiService] askGemini attempt ${attempt + 1} failed:`, err.message);
      if (isAuthError(err)) rethrow(err);
      if (!isTransient(err) || attempt === MAX_RETRIES) break;
      await sleep(BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 100));
    }
  }
  rethrow(lastErr);
  return ''; // unreachable
}

/**
 * Streaming text chat — yields string chunks as Gemini produces them.
 * Consumers can write each chunk to an SSE stream.
 *
 * @param {string} userMessage
 * @param {object} [eventContext=eventData]
 * @returns {AsyncGenerator<string>}
 */
async function* streamGemini(userMessage, eventContext = eventData) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: TEXT_MODEL,
    systemInstruction: buildSystemPrompt(JSON.stringify(eventContext, null, 2)),
  });

  try {
    const result = await model.generateContentStream(userMessage);
    for await (const chunk of result.stream) {
      const text = chunk?.text?.();
      if (text) yield text;
    }
  } catch (err) {
    console.error('[GeminiService] streamGemini failed:', err.message);
    rethrow(err);
  }
}

/**
 * Multi-modal chat — accepts an image (base64) + optional text prompt.
 *
 * @param {{ data: string, mimeType: string }} image
 * @param {string} [userText]
 * @param {object} [eventContext=eventData]
 * @returns {Promise<string>}
 */
async function askGeminiVision(image, userText = '', eventContext = eventData) {
  if (!image?.data || !image?.mimeType) {
    const e = new Error('Image data and mimeType are required for vision.');
    e.code = 'BAD_IMAGE';
    throw e;
  }

  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: VISION_MODEL,
    systemInstruction: buildVisionPrompt(JSON.stringify(eventContext, null, 2)),
  });

  const parts = [
    { inlineData: { data: image.data, mimeType: image.mimeType } },
  ];
  if (userText && userText.trim()) {
    parts.push({ text: userText.trim() });
  } else {
    parts.push({ text: 'What is in this image, and how does it relate to the event?' });
  }

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
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
      console.error(`[GeminiService] askGeminiVision attempt ${attempt + 1} failed:`, err.message);
      if (isAuthError(err)) rethrow(err);
      if (!isTransient(err) || attempt === MAX_RETRIES) break;
      await sleep(BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 100));
    }
  }
  rethrow(lastErr);
  return '';
}

module.exports = {
  askGemini,
  streamGemini,
  askGeminiVision,
  MODEL_NAME: TEXT_MODEL,
  VISION_MODEL,
};
