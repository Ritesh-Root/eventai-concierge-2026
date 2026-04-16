/**
 * @fileoverview Tests for the structured logger module.
 */

'use strict';

describe('Logger', () => {
  const originalEnv = process.env.NODE_ENV;

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  beforeEach(() => {
    jest.resetModules();
  });

  it('should export debug, info, warn, error methods', () => {
    process.env.NODE_ENV = 'test';
    const logger = require('../src/utils/logger');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should export LEVELS constant', () => {
    const logger = require('../src/utils/logger');
    expect(logger.LEVELS).toBeDefined();
    expect(logger.LEVELS.DEBUG).toBe('DEBUG');
    expect(logger.LEVELS.INFO).toBe('INFO');
    expect(logger.LEVELS.WARN).toBe('WARNING');
    expect(logger.LEVELS.ERROR).toBe('ERROR');
  });

  it('should not throw in test mode', () => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    const logger = require('../src/utils/logger');
    expect(() => logger.info('test message')).not.toThrow();
    expect(() => logger.error('test error', { err: new Error('boom') })).not.toThrow();
    expect(() => logger.warn('test warn')).not.toThrow();
    expect(() => logger.debug('test debug', { key: 'value' })).not.toThrow();
  });

  it('should handle meta with error objects', () => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    const logger = require('../src/utils/logger');
    const error = new Error('Something broke');
    expect(() => logger.error('Failure', { err: error, requestId: 'abc' })).not.toThrow();
  });

  it('should handle meta without error objects', () => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    const logger = require('../src/utils/logger');
    expect(() => logger.info('Success', { latencyMs: 42 })).not.toThrow();
  });

  it('should produce JSON output in production mode', () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();

    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = require('../src/utils/logger');

    logger.info('prod log', { requestId: 'r1' });

    expect(writeSpy).toHaveBeenCalled();
    const output = writeSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.severity).toBe('INFO');
    expect(parsed.message).toBe('prod log');
    expect(parsed.requestId).toBe('r1');
    expect(parsed.timestamp).toBeDefined();

    writeSpy.mockRestore();
  });

  it('should write errors to stderr in production', () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();

    const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = require('../src/utils/logger');

    logger.error('error log');

    expect(writeSpy).toHaveBeenCalled();
    const parsed = JSON.parse(writeSpy.mock.calls[0][0]);
    expect(parsed.severity).toBe('ERROR');

    writeSpy.mockRestore();
  });
});
