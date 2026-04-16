/**
 * @fileoverview Tests for the structured logger module.
 * Covers all branches: test mode (silent), production (JSON stdout/stderr),
 * and development (coloured console output).
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

  it('should write warnings to stderr in production', () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();

    const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = require('../src/utils/logger');

    logger.warn('warn log');

    expect(writeSpy).toHaveBeenCalled();
    const parsed = JSON.parse(writeSpy.mock.calls[0][0]);
    expect(parsed.severity).toBe('WARNING');

    writeSpy.mockRestore();
  });

  it('should write debug to stdout in production', () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();

    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = require('../src/utils/logger');

    logger.debug('debug log', { extra: 'data' });

    expect(writeSpy).toHaveBeenCalled();
    const parsed = JSON.parse(writeSpy.mock.calls[0][0]);
    expect(parsed.severity).toBe('DEBUG');
    expect(parsed.extra).toBe('data');

    writeSpy.mockRestore();
  });

  it('should extract stack_trace from Error in production', () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();

    const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = require('../src/utils/logger');
    const err = new Error('test error');

    logger.error('failure', { err });

    const parsed = JSON.parse(writeSpy.mock.calls[0][0]);
    expect(parsed.stack_trace).toContain('test error');
    expect(parsed.err).toBeUndefined();

    writeSpy.mockRestore();
  });

  it('should handle non-Error err values in production', () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();

    const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = require('../src/utils/logger');

    logger.error('failure', { err: 'string error' });

    const parsed = JSON.parse(writeSpy.mock.calls[0][0]);
    expect(parsed.stack_trace).toBe('string error');

    writeSpy.mockRestore();
  });

  it('should use console.log for dev info output', () => {
    process.env.NODE_ENV = 'development';
    jest.resetModules();

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = require('../src/utils/logger');

    logger.info('dev message');

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0][0]).toContain('[INFO]');
    expect(logSpy.mock.calls[0][0]).toContain('dev message');

    logSpy.mockRestore();
  });

  it('should use console.error for dev error output', () => {
    process.env.NODE_ENV = 'development';
    jest.resetModules();

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logger = require('../src/utils/logger');

    logger.error('dev error');

    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toContain('[ERROR]');

    errorSpy.mockRestore();
  });

  it('should use console.warn for dev warning output', () => {
    process.env.NODE_ENV = 'development';
    jest.resetModules();

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = require('../src/utils/logger');

    logger.warn('dev warn');

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('[WARNING]');

    warnSpy.mockRestore();
  });

  it('should include meta in dev output', () => {
    process.env.NODE_ENV = 'development';
    jest.resetModules();

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = require('../src/utils/logger');

    logger.info('with meta', { latencyMs: 42 });

    expect(logSpy.mock.calls[0][0]).toContain('latencyMs');

    logSpy.mockRestore();
  });

  it('should not include meta string when meta is empty', () => {
    process.env.NODE_ENV = 'development';
    jest.resetModules();

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = require('../src/utils/logger');

    logger.info('no meta');

    // Should just have the message, no trailing JSON
    expect(logSpy.mock.calls[0][0]).not.toContain('{');

    logSpy.mockRestore();
  });
});
