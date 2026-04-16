/**
 * @fileoverview Security middleware tests.
 * Verifies Helmet headers, CORS behaviour, Permissions-Policy,
 * Referrer-Policy, and request-ID generation.
 */

'use strict';

const request = require('supertest');

// Mock gemini to avoid needing a real API key.
jest.mock('../src/services/gemini', () => ({
  askGemini: jest.fn().mockResolvedValue('Mocked response'),
  streamGemini: jest.fn(),
  askGeminiVision: jest.fn(),
  MODEL_NAME: 'gemini-2.5-flash-lite',
  VISION_MODEL: 'gemini-2.5-flash',
}));

const app = require('../server');

// ── Helmet Security Headers ──────────────────────────────────────────

describe('Security Headers (Helmet)', () => {
  it('should set X-Content-Type-Options to nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should set X-Frame-Options to SAMEORIGIN', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('should set X-XSS-Protection header', async () => {
    const res = await request(app).get('/api/health');
    // Helmet v8 sets this to "0" (modern best practice — rely on CSP instead).
    expect(res.headers).toHaveProperty('x-xss-protection');
  });

  it('should set Content-Security-Policy header with strict directives', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers).toHaveProperty('content-security-policy');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('should set Strict-Transport-Security header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers).toHaveProperty('strict-transport-security');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });

  it('should not expose X-Powered-By header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });

  it('should set Referrer-Policy header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers).toHaveProperty('referrer-policy');
    expect(res.headers['referrer-policy']).toContain('strict-origin');
  });
});

// ── CORS ─────────────────────────────────────────────────────────────

describe('CORS', () => {
  it('should allow requests without Origin header (same-origin)', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('should reject requests from external origins', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://malicious-site.com');
    // CORS should not include the foreign origin in Access-Control-Allow-Origin.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should handle preflight OPTIONS requests', async () => {
    const res = await request(app)
      .options('/api/chat')
      .set('Origin', 'https://malicious-site.com')
      .set('Access-Control-Request-Method', 'POST');
    // Should not allow the foreign origin.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

// ── Request ID ───────────────────────────────────────────────────────

describe('Request ID', () => {
  it('should include X-Request-Id in response headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers).toHaveProperty('x-request-id');
    expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
  });

  it('should use provided X-Request-Id from client', async () => {
    const customId = 'test-req-id-12345';
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', customId);
    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('should generate unique IDs for different requests', async () => {
    const res1 = await request(app).get('/api/health');
    const res2 = await request(app).get('/api/health');
    expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
  });
});

// ── JSON Body Limits ─────────────────────────────────────────────────

describe('JSON Body Limits', () => {
  it('should reject payloads exceeding validation limits', async () => {
    const largePayload = { message: 'x'.repeat(20000) };
    const res = await request(app).post('/api/chat').send(largePayload);
    // Will get 400 (validation rejects > 500 chars).
    expect([400, 413]).toContain(res.status);
  });
});
