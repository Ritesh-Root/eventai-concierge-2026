/**
 * @fileoverview Google Cloud Logging integration helpers.
 *
 * When deployed to **Cloud Run**, `stdout` JSON lines with the correct
 * `severity` and `logging.googleapis.com/trace` fields are automatically
 * parsed into structured log entries by the Cloud Logging agent.
 *
 * This module provides helper functions that format log payloads in the
 * Google-recommended format so that logs in the Cloud Console are
 * filterable by severity, trace, and custom labels.
 *
 * @module services/cloudLogging
 * @see https://cloud.google.com/run/docs/logging#writing_structured_logs
 * @see https://cloud.google.com/logging/docs/structured-logging
 */

'use strict';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';

/**
 * Builds a Cloud-Logging-compatible structured log entry.
 *
 * @param {string} severity   One of DEFAULT, DEBUG, INFO, NOTICE, WARNING, ERROR, CRITICAL.
 * @param {string} message    Human-readable log line.
 * @param {Object} [opts]     Additional fields.
 * @param {string} [opts.requestId]  The X-Request-Id for the current request.
 * @param {string} [opts.traceId]    Cloud Trace ID from X-Cloud-Trace-Context.
 * @param {number} [opts.latencyMs]  Request latency in milliseconds.
 * @param {Object} [opts.labels]     Custom key-value labels.
 * @param {Error}  [opts.error]      Error object (stack trace is extracted).
 * @returns {Object} JSON-serialisable log entry.
 */
function buildLogEntry(severity, message, opts = {}) {
  const entry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    'logging.googleapis.com/labels': {
      service: 'event-ai-concierge',
      ...opts.labels,
    },
  };

  // Attach Cloud Trace correlation
  if (opts.traceId && PROJECT_ID) {
    entry['logging.googleapis.com/trace'] =
      `projects/${PROJECT_ID}/traces/${opts.traceId}`;
  }

  if (opts.requestId) {
    entry.requestId = opts.requestId;
  }

  if (opts.latencyMs !== undefined) {
    entry.latencyMs = opts.latencyMs;
  }

  if (opts.error) {
    entry.stack_trace =
      opts.error instanceof Error ? opts.error.stack : String(opts.error);
    // Enables Cloud Error Reporting auto-detection
    entry['@type'] =
      'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';
  }

  return entry;
}

/**
 * Writes a structured log entry to stdout (INFO/DEBUG) or stderr (WARNING/ERROR).
 * @param {Object} entry - The entry returned by `buildLogEntry()`.
 */
function writeLogEntry(entry) {
  const stream =
    entry.severity === 'ERROR' ||
    entry.severity === 'CRITICAL' ||
    entry.severity === 'WARNING'
      ? process.stderr
      : process.stdout;

  stream.write(JSON.stringify(entry) + '\n');
}

/**
 * Express middleware that logs every request with Cloud-compatible fields.
 * Attach after `attachRequestId()` so `req.id` and `req.traceId` are available.
 *
 * @returns {Function} Express middleware.
 */
function requestLogger() {
  return (req, res, next) => {
    // Skip logging in test to keep Jest output clean
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const start = Date.now();

    res.on('finish', () => {
      const latencyMs = Date.now() - start;
      const severity = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARNING' : 'INFO';

      writeLogEntry(
        buildLogEntry(severity, `${req.method} ${req.originalUrl} ${res.statusCode}`, {
          requestId: req.id,
          traceId: req.traceId,
          latencyMs,
          labels: {
            method: req.method,
            path: req.originalUrl,
            status: String(res.statusCode),
          },
        })
      );
    });

    next();
  };
}

module.exports = {
  buildLogEntry,
  writeLogEntry,
  requestLogger,
};
