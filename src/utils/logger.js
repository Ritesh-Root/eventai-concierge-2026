/**
 * @fileoverview Structured logger for EventAI Concierge.
 *
 * In **production** (Cloud Run) output is JSON — one object per line — which
 * Google Cloud Logging automatically parses into structured log entries with
 * severity, message, labels, and trace fields.
 *
 * In **development** output is human-readable with colour and timestamps.
 *
 * Usage:
 * ```js
 * const logger = require('./utils/logger');
 * logger.info('Server started', { port: 8080 });
 * logger.warn('Cache miss', { key });
 * logger.error('Upstream failure', { err, requestId });
 * ```
 *
 * @module utils/logger
 * @see https://cloud.google.com/run/docs/logging
 */

'use strict';

// Severity levels aligned with Google Cloud Logging.
const LEVELS = Object.freeze({
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARNING',
  ERROR: 'ERROR',
});

const isProduction =
  process.env.NODE_ENV === 'production';

/**
 * Emits a single structured log entry.
 *
 * @param {string} severity    One of the LEVELS values.
 * @param {string} message     Human-readable log line.
 * @param {Object} [meta={}]   Arbitrary key-value pairs (requestId, latency, etc.).
 */
function emit(severity, message, meta = {}) {
  // In test mode, suppress all output to keep Jest clean.
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (isProduction) {
    // Google Cloud Logging JSON format
    const entry = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    // errors get their own field for Cloud Error Reporting
    if (meta.err) {
      entry.stack_trace =
        meta.err instanceof Error ? meta.err.stack : String(meta.err);
      delete entry.err;
    }
    const stream =
      severity === LEVELS.ERROR || severity === LEVELS.WARN
        ? process.stderr
        : process.stdout;
    stream.write(JSON.stringify(entry) + '\n');
  } else {
    // Dev-friendly coloured output
    const ts = new Date().toISOString().slice(11, 23);
    const prefix = `[${ts}] [${severity}]`;
    const extra = Object.keys(meta).length
      ? ' ' + JSON.stringify(meta, null, 0)
      : '';
    if (severity === LEVELS.ERROR) {
      console.error(`${prefix} ${message}${extra}`);
    } else if (severity === LEVELS.WARN) {
      console.warn(`${prefix} ${message}${extra}`);
    } else {
      console.log(`${prefix} ${message}${extra}`);
    }
  }
}

/** @type {import('./logger')} */
const logger = {
  debug: (msg, meta) => emit(LEVELS.DEBUG, msg, meta),
  info: (msg, meta) => emit(LEVELS.INFO, msg, meta),
  warn: (msg, meta) => emit(LEVELS.WARN, msg, meta),
  error: (msg, meta) => emit(LEVELS.ERROR, msg, meta),
  LEVELS,
};

module.exports = logger;
