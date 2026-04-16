/**
 * @fileoverview Tests for the rate-limit middleware configuration.
 */

'use strict';

const { createChatLimiter } = require('../src/middleware/rateLimit');

describe('Rate Limiter', () => {
  let originalIsTest;
  let config;
  
  beforeAll(() => {
    config = require('../src/config');
    originalIsTest = config.isTest;
  });

  afterAll(() => {
    // Cannot reassign config if it's frozen, but we rely on jest.resetModules if needed.
    // Given config is frozen, let's mock it using jest.mock
  });

  // Re-requiring cleanly with mock
  it('should export createChatLimiter as a middleware', () => {
    jest.mock('../src/config', () => ({
      ...jest.requireActual('../src/config'),
      isTest: false, // Force real limiter
    }));
    
    // Clear the require cache for rateLimit
    jest.resetModules();
    const { createChatLimiter } = require('../src/middleware/rateLimit');
    
    const limiter = createChatLimiter();
    expect(typeof limiter).toBe('function');
    expect(limiter.length).toBeGreaterThanOrEqual(2);
  });
});
