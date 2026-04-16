/**
 * @fileoverview Request-ID middleware for distributed tracing.
 *
 * Generates a unique identifier for every incoming request using
 * `crypto.randomUUID()`. The ID is attached to:
 *   - `req.id`                 — available in route handlers and logs
 *   - `X-Request-Id` response header — visible to the client for support tickets
 *
 * On Google Cloud Run the `X-Cloud-Trace-Context` header is already set by
 * the load balancer; this middleware also reads it when present and exposes
 * it as `req.traceId` so our structured logger can correlate with Cloud Trace.
 *
 * @module middleware/requestId
 */

'use strict';

const { randomUUID } = require('crypto');

/**
 * Returns Express middleware that assigns a request ID and optional trace ID.
 * @returns {Function} Express middleware.
 */
function attachRequestId() {
  return (req, res, next) => {
    // Prefer an incoming X-Request-Id (if behind a second proxy) or generate one.
    const id = req.headers['x-request-id'] || randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);

    // Cloud Run trace context
    const traceHeader = req.headers['x-cloud-trace-context'];
    if (traceHeader) {
      const [traceId] = traceHeader.split('/');
      req.traceId = traceId;
    }

    next();
  };
}

module.exports = { attachRequestId };
