import { describe, expect, it } from 'vitest';
import {
  inferSeverity,
  parseSeverityLevel,
  passesSeverityFilter,
  VALID_SEVERITY_LEVELS,
} from '../src/core/severity/severity-filter';

describe('VALID_SEVERITY_LEVELS', () => {
  it('contains all six severity levels', () => {
    expect(VALID_SEVERITY_LEVELS).toEqual([
      'fatal', 'error', 'warn', 'info', 'debug', 'trace',
    ]);
  });
});

describe('parseSeverityLevel', () => {
  it('accepts all valid levels case-insensitively', () => {
    expect(parseSeverityLevel('fatal')).toBe('fatal');
    expect(parseSeverityLevel('ERROR')).toBe('error');
    expect(parseSeverityLevel('Warn')).toBe('warn');
    expect(parseSeverityLevel('info')).toBe('info');
    expect(parseSeverityLevel('DEBUG')).toBe('debug');
    expect(parseSeverityLevel('trace')).toBe('trace');
  });

  it('rejects invalid values', () => {
    expect(() => parseSeverityLevel('verbose')).toThrow('Unsupported severity level');
    expect(() => parseSeverityLevel('')).toThrow('Unsupported severity level');
    expect(() => parseSeverityLevel('critical')).toThrow('Unsupported severity level');
  });
});

describe('inferSeverity', () => {
  it('detects [FATAL] level', () => {
    expect(inferSeverity('[FATAL] system crash')).toBe('fatal');
  });

  it('detects JSON fatal level', () => {
    expect(inferSeverity('{"level":"fatal","msg":"oom"}')).toBe('fatal');
  });

  it('detects Severity: FATAL', () => {
    expect(inferSeverity('Severity: FATAL error')).toBe('fatal');
  });

  it('detects standalone FATAL keyword', () => {
    expect(inferSeverity('FATAL: unrecoverable')).toBe('fatal');
  });

  it('detects [ERROR] level', () => {
    expect(inferSeverity('[ERROR] request failed')).toBe('error');
  });

  it('detects JSON error level', () => {
    expect(inferSeverity('{"level":"error"}')).toBe('error');
  });

  it('detects Severity: ERROR', () => {
    expect(inferSeverity('Severity: ERROR')).toBe('error');
  });

  it('detects [WARN] level', () => {
    expect(inferSeverity('[WARN] cache miss')).toBe('warn');
  });

  it('detects [WARNING] level', () => {
    expect(inferSeverity('[WARNING] deprecation')).toBe('warn');
  });

  it('detects JSON warn level', () => {
    expect(inferSeverity('{"level":"warn"}')).toBe('warn');
  });

  it('detects JSON warning level', () => {
    expect(inferSeverity('{"level":"warning"}')).toBe('warn');
  });

  it('detects [INFO] level', () => {
    expect(inferSeverity('[INFO] boot ok')).toBe('info');
  });

  it('detects JSON info level', () => {
    expect(inferSeverity('{"level":"info"}')).toBe('info');
  });

  it('detects [DEBUG] level', () => {
    expect(inferSeverity('[DEBUG] trace data')).toBe('debug');
  });

  it('detects JSON debug level', () => {
    expect(inferSeverity('{"level":"debug"}')).toBe('debug');
  });

  it('detects [TRACE] level', () => {
    expect(inferSeverity('[TRACE] tick')).toBe('trace');
  });

  it('detects JSON trace level', () => {
    expect(inferSeverity('{"level":"trace"}')).toBe('trace');
  });

  it('returns undefined for lines without severity markers', () => {
    expect(inferSeverity('plain text log line')).toBeUndefined();
    expect(inferSeverity('something happened')).toBeUndefined();
  });
});

describe('passesSeverityFilter', () => {
  it('keeps lines at or above the minimum level', () => {
    expect(passesSeverityFilter('[FATAL] crash', 'fatal')).toBe(true);
    expect(passesSeverityFilter('[ERROR] fail', 'error')).toBe(true);
    expect(passesSeverityFilter('[ERROR] fail', 'warn')).toBe(true);
    expect(passesSeverityFilter('[WARN] slow', 'warn')).toBe(true);
    expect(passesSeverityFilter('[WARN] slow', 'info')).toBe(true);
    expect(passesSeverityFilter('[INFO] boot', 'info')).toBe(true);
    expect(passesSeverityFilter('[INFO] boot', 'debug')).toBe(true);
    expect(passesSeverityFilter('[DEBUG] x', 'debug')).toBe(true);
    expect(passesSeverityFilter('[DEBUG] x', 'trace')).toBe(true);
    expect(passesSeverityFilter('[TRACE] y', 'trace')).toBe(true);
  });

  it('drops lines below the minimum level', () => {
    expect(passesSeverityFilter('[TRACE] y', 'debug')).toBe(false);
    expect(passesSeverityFilter('[DEBUG] x', 'info')).toBe(false);
    expect(passesSeverityFilter('[INFO] boot', 'warn')).toBe(false);
    expect(passesSeverityFilter('[WARN] slow', 'error')).toBe(false);
    expect(passesSeverityFilter('[ERROR] fail', 'fatal')).toBe(false);
  });

  it('passes lines without a detectable severity level', () => {
    expect(passesSeverityFilter('plain text', 'error')).toBe(true);
    expect(passesSeverityFilter('unstructured log', 'fatal')).toBe(true);
  });

  it('severity hierarchy is ordered correctly', () => {
    // fatal > error > warn > info > debug > trace
    expect(passesSeverityFilter('[FATAL] x', 'error')).toBe(true);
    expect(passesSeverityFilter('[ERROR] x', 'fatal')).toBe(false);
    expect(passesSeverityFilter('[ERROR] x', 'warn')).toBe(true);
    expect(passesSeverityFilter('[WARN] x', 'info')).toBe(true);
    expect(passesSeverityFilter('[INFO] x', 'debug')).toBe(true);
    expect(passesSeverityFilter('[DEBUG] x', 'trace')).toBe(true);
    expect(passesSeverityFilter('[TRACE] x', 'info')).toBe(false);
  });
});
