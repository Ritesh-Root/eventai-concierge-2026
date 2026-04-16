/**
 * @fileoverview Express application entry point for EventAI Concierge.
 *
 * Responsibilities:
 *   1. Load environment from .env (dotenv).
 *   2. Apply security middleware (Helmet, CORS, custom XSS sanitizer, Mongo-sanitize).
 *   3. Attach request-ID and structured Cloud Logging middleware.
 *   4. Parse JSON bodies, enable compression, serve static assets.
 *   5. Mount API routes and health-check endpoint.
 *   6. Global error handler with typed error mapping.
 *   7. Graceful shutdown on SIGTERM / SIGINT.
 *
 * @module server
 */

'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const { xssSanitize } = require('./src/middleware/sanitize');

const config = require('./src/config');
const logger = require('./src/utils/logger');
const { AppError } = require('./src/utils/errors');
const { configureHelmet, configureCors, configurePermissionsPolicy } = require('./src/middleware/security');
const { attachRequestId } = require('./src/middleware/requestId');
const { requestLogger } = require('./src/services/cloudLogging');
const chatRouter = require('./src/routes/chat');

const app = express();

// ── Request tracing ──────────────────────────────────────────────────
app.use(attachRequestId());

// ── Security ─────────────────────────────────────────────────────────
app.use(configureHelmet());
app.use(configureCors());
app.use(configurePermissionsPolicy());

// ── Structured request logging (Cloud Logging compatible) ────────────
app.use(requestLogger());

// ── Body parsing ─────────────────────────────────────────────────────
// 7 MB ceiling covers a base64-encoded 5 MB image plus JSON overhead.
app.use(express.json({ limit: config.input.bodyLimit }));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(xssSanitize());
app.use(mongoSanitize());

// ── Static files ─────────────────────────────────────────────────────
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: config.staticMaxAge,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (
        filePath.endsWith('sw.js') ||
        filePath.endsWith('manifest.webmanifest')
      ) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// ── API routes ───────────────────────────────────────────────────────
app.use('/api', chatRouter);

// ── Health check (Cloud Run readiness / liveness probe) ──────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    uptime: Math.floor(process.uptime()),
  });
});

// ── 404 fallback ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // Typed AppError subclasses carry their own status and code.
  if (err instanceof AppError) {
    logger.warn('Handled application error', {
      code: err.code,
      message: err.message,
      requestId: req.id,
    });
    return res.status(err.status).json(err.toJSON());
  }

  // Express body-parser 413
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }

  // Catch-all — never leak internals to the client.
  logger.error('Unhandled server error', {
    err,
    requestId: req.id,
  });
  return res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ─────────────────────────────────────────────────────
let server;
if (!config.isTest) {
  server = app.listen(config.port, () => {
    logger.info(`✦ EventAI Concierge running on http://localhost:${config.port}`, {
      env: config.env,
      port: config.port,
    });
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`⏻ Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      logger.info('✓ Server closed.');
      process.exit(0);
    });
    // Force exit after 5 seconds if connections are hanging.
    setTimeout(() => {
      logger.warn('⚠ Forcing shutdown after timeout.');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
