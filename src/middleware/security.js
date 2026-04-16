/**
 * @fileoverview Security middleware — Helmet CSP and CORS configuration.
 * @module middleware/security
 */

const helmet = require('helmet');
const cors = require('cors');

/**
 * Configures and returns Helmet middleware with a Content Security Policy
 * that allows self-origin resources and inline styles (needed for the demo UI).
 * @returns {Function} Helmet middleware.
 */
function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
}

/**
 * Configures CORS to allow only same-origin requests.
 * @returns {Function} CORS middleware.
 */
function configureCors() {
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      // In production, restrict to known origins
      // For this demo, we allow same-origin only
      callback(null, false);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400,
  });
}

module.exports = { configureHelmet, configureCors };
