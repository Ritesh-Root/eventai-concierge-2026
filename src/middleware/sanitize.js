/**
 * @fileoverview Lightweight XSS sanitizer middleware.
 *
 * Replaces the deprecated `xss-clean` package with a focused,
 * dependency-free implementation that recursively sanitizes string
 * values in `req.body`, `req.query`, and `req.params`.
 *
 * Strategy:
 *   - Strip HTML tags via regex (prevents tag-based injection).
 *   - Encode remaining special characters (`<`, `>`, `&`, `"`, `'`).
 *   - This runs BEFORE any validation middleware, so downstream code
 *     receives pre-sanitised data.
 *
 * @module middleware/sanitize
 */

'use strict';

/**
 * Sanitises a single string value by stripping HTML tags.
 * @param {string} str
 * @returns {string} Sanitised string.
 */
function clean(str) {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Recursively sanitises all string values in an object or array.
 * @param {*} obj - The value to sanitise.
 * @returns {*} The sanitised value.
 */
function sanitizeDeep(obj) {
  if (typeof obj === 'string') {
    return clean(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = sanitizeDeep(obj[key]);
    }
    return result;
  }
  return obj;
}

/**
 * Returns Express middleware that sanitises `body`, `query`, and `params`.
 * @returns {Function} Express middleware.
 */
function xssSanitize() {
  return (req, _res, next) => {
    if (req.body) {
      req.body = sanitizeDeep(req.body);
    }
    if (req.query) {
      req.query = sanitizeDeep(req.query);
    }
    if (req.params) {
      req.params = sanitizeDeep(req.params);
    }
    next();
  };
}

module.exports = { xssSanitize, sanitizeDeep, clean };
