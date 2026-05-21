import { describe, expect, it } from 'vitest';
import {
  detectFormat,
  groupHttpStatusCodes,
} from '../src/core/formats/format-detector';

describe('detectFormat', () => {
  it('detects syslog format', () => {
    expect(detectFormat('<34>1 2026-01-01T00:00:00Z host app - - -')).toBe('syslog');
    expect(detectFormat('<165>1 something')).toBe('syslog');
  });

  it('detects JSON format', () => {
    expect(detectFormat('{"level":"error","msg":"crash"}')).toBe('json');
    expect(detectFormat('  {"key": "value"}  ')).toBe('json');
  });

  it('rejects invalid JSON that starts with {', () => {
    expect(detectFormat('{not valid json}')).toBe('unknown');
  });

  it('detects logfmt format', () => {
    expect(detectFormat('level=error msg=crash')).toBe('logfmt');
    expect(detectFormat('key=val key2=val2')).toBe('logfmt');
  });

  it('returns unknown for unstructured lines', () => {
    expect(detectFormat('[ERROR] plain text log')).toBe('unknown');
    expect(detectFormat('random log output')).toBe('unknown');
    expect(detectFormat('')).toBe('unknown');
  });
});

describe('groupHttpStatusCodes', () => {
  it('groups 5xx status codes with context pattern', () => {
    expect(groupHttpStatusCodes('HTTP/1.1 503 Service Unavailable')).toBe('HTTP/1.1 [HTTP 5xx] Service Unavailable');
    expect(groupHttpStatusCodes('returned 500')).toBe('returned [HTTP 5xx]');
    expect(groupHttpStatusCodes('status=502')).toBe('status=[HTTP 5xx]');
    expect(groupHttpStatusCodes('with status 500')).toBe('with status [HTTP 5xx]');
    expect(groupHttpStatusCodes('code=503')).toBe('code=[HTTP 5xx]');
  });

  it('groups 4xx status codes with context pattern', () => {
    expect(groupHttpStatusCodes('HTTP/1.1 404 Not Found')).toBe('HTTP/1.1 [HTTP 4xx] Not Found');
    expect(groupHttpStatusCodes('returned 403')).toBe('returned [HTTP 4xx]');
    expect(groupHttpStatusCodes('status=401')).toBe('status=[HTTP 4xx]');
  });

  it('does not group 2xx/3xx status codes', () => {
    expect(groupHttpStatusCodes('HTTP/1.1 200 OK')).toBe('HTTP/1.1 200 OK');
    expect(groupHttpStatusCodes('returned 301')).toBe('returned 301');
    expect(groupHttpStatusCodes('status=302')).toBe('status=302');
  });

  it('groups 5xx codes with description pattern', () => {
    expect(groupHttpStatusCodes('500 Internal Server Error')).toBe('[HTTP 5xx] Internal Server Error');
    expect(groupHttpStatusCodes('502 Bad Gateway')).toBe('[HTTP 5xx] Bad Gateway');
    expect(groupHttpStatusCodes('503 Service Unavailable')).toBe('[HTTP 5xx] Service Unavailable');
    expect(groupHttpStatusCodes('504 Gateway Timeout')).toBe('[HTTP 5xx] Gateway Timeout');
  });

  it('groups 4xx codes with description pattern', () => {
    expect(groupHttpStatusCodes('400 Bad Request')).toBe('[HTTP 4xx] Bad Request');
    expect(groupHttpStatusCodes('401 Unauthorized')).toBe('[HTTP 4xx] Unauthorized');
    expect(groupHttpStatusCodes('403 Forbidden')).toBe('[HTTP 4xx] Forbidden');
    expect(groupHttpStatusCodes('404 Not Found')).toBe('[HTTP 4xx] Not Found');
    expect(groupHttpStatusCodes('405 Method Not Allowed')).toBe('[HTTP 4xx] Method Not Allowed');
    expect(groupHttpStatusCodes('409 Conflict')).toBe('[HTTP 4xx] Conflict');
    expect(groupHttpStatusCodes('429 Too Many Requests')).toBe('[HTTP 4xx] Too Many Requests');
  });

  it('does not group 2xx/3xx codes with description pattern', () => {
    expect(groupHttpStatusCodes('200 OK')).toBe('200 OK');
    expect(groupHttpStatusCodes('201 Created')).toBe('201 Created');
    expect(groupHttpStatusCodes('202 Accepted')).toBe('202 Accepted');
    expect(groupHttpStatusCodes('204 No Content')).toBe('204 No Content');
    expect(groupHttpStatusCodes('301 Moved')).toBe('301 Moved');
    expect(groupHttpStatusCodes('302 Found')).toBe('302 Found');
    expect(groupHttpStatusCodes('304 Not Modified')).toBe('304 Not Modified');
  });

  it('handles lines without status codes', () => {
    expect(groupHttpStatusCodes('[ERROR] plain text')).toBe('[ERROR] plain text');
    expect(groupHttpStatusCodes('no codes here')).toBe('no codes here');
  });
});
