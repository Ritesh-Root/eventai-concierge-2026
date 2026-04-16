/**
 * @fileoverview Security middleware — Helmet CSP, CORS, and additional
 * hardening headers for EventAI Concierge.
 *
 * Security posture:
 *   - Strict Content-Security-Policy (self-origin + Google Fonts only).
 *   - Same-origin CORS — external origins are rejected.
 *   - Permissions-Policy — restricts browser features to minimise attack surface.
 *   - Referrer-Policy — limits information leakage in Referer headers.
 *   - X-Powered-By removed by Helmet.
 *   - HSTS enabled for transport-layer security.
 *
 * @module middleware/security
 */

'use strict';

const helmet = require('helmet');
const cors = require('cors');

/**
 * Configures and returns Helmet middleware with a Content Security Policy
 * that allows self-origin resources and inline styles (needed for the demo UI).
 *
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
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,

    // Referrer-Policy: limits information sent in the Referer header.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    // Strict-Transport-Security: enforce HTTPS for 1 year with subdomains.
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  });
}

/**
 * Returns middleware that sets the Permissions-Policy header.
 * Disables unnecessary browser features to reduce the attack surface.
 *
 * @returns {Function} Express middleware.
 */
function configurePermissionsPolicy() {
  return (_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()'
    );
    next();
  };
}

/**
 * Configures CORS to allow only same-origin requests.
 *
 * @returns {Function} CORS middleware.
 */
function configureCors() {
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, curl, server-to-server).
      if (!origin) {
        return callback(null, true);
      }
      // In production, restrict to known origins.
      // For this demo, we allow same-origin only.
      callback(null, false);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400,
  });
}

module.exports = { configureHelmet, configureCors, configurePermissionsPolicy };
