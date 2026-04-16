/**
 * @fileoverview Tests for the Google Cloud Logging integration module.
 */

'use strict';

const { buildLogEntry, writeLogEntry, requestLogger } = require('../src/services/cloudLogging');

describe('Cloud Logging - buildLogEntry()', () => {
  it('should build a basic log entry with severity and message', () => {
    const entry = buildLogEntry('INFO', 'Test message');
    expect(entry.severity).toBe('INFO');
    expect(entry.message).toBe('Test message');
    expect(entry.timestamp).toBeDefined();
    expect(entry['logging.googleapis.com/labels'].service).toBe('event-ai-concierge');
  });

  it('should include requestId when provided', () => {
    const entry = buildLogEntry('DEBUG', 'req log', { requestId: 'req-123' });
    expect(entry.requestId).toBe('req-123');
  });

  it('should include latencyMs when provided', () => {
    const entry = buildLogEntry('INFO', 'completed', { latencyMs: 42 });
    expect(entry.latencyMs).toBe(42);
  });

  it('should include custom labels', () => {
    const entry = buildLogEntry('INFO', 'labeled', {
      labels: { method: 'POST', path: '/api/chat' },
    });
    expect(entry['logging.googleapis.com/labels'].method).toBe('POST');
    expect(entry['logging.googleapis.com/labels'].path).toBe('/api/chat');
  });

  it('should extract stack trace from Error objects', () => {
    const err = new Error('boom');
    const entry = buildLogEntry('ERROR', 'failure', { error: err });
    expect(entry.stack_trace).toContain('boom');
    expect(entry['@type']).toContain('clouderrorreporting');
  });

  it('should handle non-Error error values', () => {
    const entry = buildLogEntry('ERROR', 'failure', { error: 'string error' });
    expect(entry.stack_trace).toBe('string error');
  });

  it('should include trace when both traceId and project are set', () => {
    const origProject = process.env.GOOGLE_CLOUD_PROJECT;
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    // Need to re-require to pick up env change
    jest.resetModules();
    const { buildLogEntry: freshBuild } = require('../src/services/cloudLogging');
    const entry = freshBuild('INFO', 'traced', { traceId: 'abc123' });
    expect(entry['logging.googleapis.com/trace']).toBe('projects/test-project/traces/abc123');
    process.env.GOOGLE_CLOUD_PROJECT = origProject;
  });

  it('should not include trace when project is not set', () => {
    const entry = buildLogEntry('INFO', 'no trace', { traceId: 'abc123' });
    // Without GOOGLE_CLOUD_PROJECT being set at module load time, no trace
    expect(entry['logging.googleapis.com/trace']).toBeUndefined();
  });
});

describe('Cloud Logging - writeLogEntry()', () => {
  it('should write INFO entries to stdout', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const entry = buildLogEntry('INFO', 'stdout test');
    writeLogEntry(entry);
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('"severity":"INFO"');
    spy.mockRestore();
  });

  it('should write ERROR entries to stderr', () => {
    const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const entry = buildLogEntry('ERROR', 'stderr test');
    writeLogEntry(entry);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should write WARNING entries to stderr', () => {
    const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const entry = buildLogEntry('WARNING', 'warn test');
    writeLogEntry(entry);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should write CRITICAL entries to stderr', () => {
    const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const entry = buildLogEntry('CRITICAL', 'critical test');
    writeLogEntry(entry);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should write DEBUG entries to stdout', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const entry = buildLogEntry('DEBUG', 'debug test');
    writeLogEntry(entry);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('Cloud Logging - requestLogger()', () => {
  it('should return a middleware function', () => {
    const middleware = requestLogger();
    expect(typeof middleware).toBe('function');
  });

  it('should call next() in test mode', () => {
    const middleware = requestLogger();
    const req = { method: 'GET', originalUrl: '/api/health', id: 'test' };
    const res = { on: jest.fn(), statusCode: 200 };
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
