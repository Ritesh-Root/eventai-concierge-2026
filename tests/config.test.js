/**
 * @fileoverview Tests for the centralised config module.
 * Verifies environment variable validation, defaults, and immutability.
 */

'use strict';

describe('Config module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'test', GEMINI_API_KEY: 'test-key-123' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load with valid environment', () => {
    const config = require('../src/config');
    expect(config).toBeDefined();
    expect(config.port).toBe(8080);
    expect(config.isTest).toBe(true);
  });

  it('should have correct default values', () => {
    const config = require('../src/config');
    expect(config.port).toBe(8080);
    expect(config.gemini.textModel).toBe('gemini-2.5-flash-lite');
    expect(config.gemini.visionModel).toBe('gemini-2.5-flash');
    expect(config.gemini.maxRetries).toBe(2);
    expect(config.gemini.temperature).toBe(0.7);
    expect(config.gemini.maxOutputTokens).toBe(1024);
    expect(config.rateLimit.windowMs).toBe(60000);
    expect(config.rateLimit.maxRequests).toBe(30);
  });

  it('should have correct input constraints', () => {
    const config = require('../src/config');
    expect(config.input.maxMessageLength).toBe(500);
    expect(config.input.maxImageBytes).toBe(5 * 1024 * 1024);
    expect(config.input.allowedImageMimes).toContain('image/jpeg');
    expect(config.input.allowedImageMimes).toContain('image/png');
    expect(config.input.allowedImageMimes).toContain('image/webp');
    expect(config.input.bodyLimit).toBe('7mb');
  });

  it('should have correct cache settings', () => {
    const config = require('../src/config');
    expect(config.cache.ttlMs).toBe(600000);
    expect(config.cache.maxEntries).toBe(500);
  });

  it('should be immutable (Object.freeze)', () => {
    const config = require('../src/config');
    expect(() => {
      config.port = 9999;
    }).toThrow();
    expect(config.port).toBe(8080);
  });

  it('should have immutable nested objects', () => {
    const config = require('../src/config');
    expect(() => {
      config.gemini.temperature = 999;
    }).toThrow();
  });

  it('should use PORT env var when set', () => {
    process.env.PORT = '3000';
    jest.resetModules();
    const config = require('../src/config');
    expect(config.port).toBe(3000);
  });

  it('should use placeholder API key in test mode', () => {
    delete process.env.GEMINI_API_KEY;
    jest.resetModules();
    const config = require('../src/config');
    expect(config.gemini.apiKey).toBe('test-placeholder');
  });

  it('should respect custom model names from env', () => {
    process.env.GEMINI_TEXT_MODEL = 'gemini-custom-model';
    jest.resetModules();
    const config = require('../src/config');
    expect(config.gemini.textModel).toBe('gemini-custom-model');
  });

  it('should correctly identify production environment', () => {
    process.env.NODE_ENV = 'production';
    process.env.GEMINI_API_KEY = 'real-key';
    jest.resetModules();
    const config = require('../src/config');
    expect(config.isProduction).toBe(true);
    expect(config.isTest).toBe(false);
  });

  it('should throw when GEMINI_API_KEY is missing in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GEMINI_API_KEY;
    jest.resetModules();
    expect(() => require('../src/config')).toThrow(/Missing required environment variable.*GEMINI_API_KEY/);
  });

  it('should throw when GEMINI_API_KEY is blank in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.GEMINI_API_KEY = '   ';
    jest.resetModules();
    expect(() => require('../src/config')).toThrow(/Missing required environment variable/);
  });
});
