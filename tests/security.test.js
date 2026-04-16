/**
 * @fileoverview Security middleware tests.
 * Verifies Helmet headers and CORS behaviour.
 */

const request = require('supertest');

// Mock gemini to avoid needing a real API key
jest.mock('../src/services/gemini', () => ({
  askGemini: jest.fn().mockResolvedValue('Mocked response'),
  MODEL_NAME: 'gemini-2.5-flash',
}));

const app = require('../server');

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

    // Helmet v8 sets this to "0" (modern best practice)
    expect(res.headers).toHaveProperty('x-xss-protection');
  });

  it('should set Content-Security-Policy header', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers).toHaveProperty('content-security-policy');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
  });

  it('should set Strict-Transport-Security header', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers).toHaveProperty('strict-transport-security');
  });

  it('should not expose X-Powered-By header', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers).not.toHaveProperty('x-powered-by');
  });
});

describe('CORS', () => {
  it('should allow requests without Origin header (same-origin)', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
  });

  it('should reject requests from external origins', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://malicious-site.com');

    // CORS should not include the foreign origin in Access-Control-Allow-Origin
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should handle preflight OPTIONS requests', async () => {
    const res = await request(app)
      .options('/api/chat')
      .set('Origin', 'https://malicious-site.com')
      .set('Access-Control-Request-Method', 'POST');

    // Should not allow the foreign origin
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('JSON Body Limits', () => {
  it('should reject payloads exceeding 16kb', async () => {
    const largePayload = { message: 'x'.repeat(20000) };

    const res = await request(app)
      .post('/api/chat')
      .send(largePayload);

    // Will either get 400 (validation) or 413 (body too large)
    expect([400, 413]).toContain(res.status);
  });
});
