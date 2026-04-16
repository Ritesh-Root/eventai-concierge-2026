/**
 * @fileoverview Tests for the request-ID middleware.
 */

'use strict';

const { attachRequestId } = require('../src/middleware/requestId');

describe('attachRequestId()', () => {
  const mockRes = () => {
    const headers = {};
    return {
      setHeader: (k, v) => { headers[k] = v; },
      getHeader: (k) => headers[k],
      headers,
    };
  };

  it('should return a middleware function', () => {
    const mw = attachRequestId();
    expect(typeof mw).toBe('function');
    expect(mw.length).toBe(3);
  });

  it('should generate a request ID and set it on req.id', () => {
    const mw = attachRequestId();
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(req.id).toBeDefined();
    expect(typeof req.id).toBe('string');
    expect(req.id.length).toBeGreaterThan(10);
    expect(next).toHaveBeenCalled();
  });

  it('should set X-Request-Id response header', () => {
    const mw = attachRequestId();
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(res.headers['X-Request-Id']).toBe(req.id);
  });

  it('should reuse X-Request-Id from incoming request', () => {
    const mw = attachRequestId();
    const req = { headers: { 'x-request-id': 'custom-id-42' } };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(req.id).toBe('custom-id-42');
    expect(res.headers['X-Request-Id']).toBe('custom-id-42');
  });

  it('should extract Cloud Trace context', () => {
    const mw = attachRequestId();
    const req = {
      headers: { 'x-cloud-trace-context': 'abc123def456/spanid;o=1' },
    };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(req.traceId).toBe('abc123def456');
  });

  it('should not set traceId when Cloud Trace header is absent', () => {
    const mw = attachRequestId();
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(req.traceId).toBeUndefined();
  });
});
