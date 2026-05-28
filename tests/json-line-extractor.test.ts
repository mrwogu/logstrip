import { describe, expect, it } from 'vitest';
import {
  extractJsonLog,
  normalizeJsonLevel,
  scoreJsonLine,
} from '../src/core/formats/json-line-extractor.js';

describe('json line extractor', () => {
  it('extracts level, msg, and err stack from a pino log line', () => {
    const log = extractJsonLog(
      '{"level":50,"time":1680000000000,"msg":"database timeout","err":{"stack":"Error: connect\\n    at db.ts:42"}}',
    );
    expect(log).not.toBeNull();
    expect(log!.level).toBe(50);
    expect(log!.msg).toBe('database timeout');
    expect(log!.errStack).toBe('Error: connect\n    at db.ts:42');
  });

  it('extracts severity field as level', () => {
    const log = extractJsonLog(
      '{"severity":"critical","msg":"checkout failed"}',
    );
    expect(log!.level).toBe('critical');
    expect(log!.msg).toBe('checkout failed');
  });

  it('extracts message field as msg', () => {
    const log = extractJsonLog(
      '{"level":"error","message":"something broke"}',
    );
    expect(log!.msg).toBe('something broke');
  });

  it('handles missing level and msg gracefully', () => {
    const log = extractJsonLog('{"foo":"bar"}');
    expect(log).not.toBeNull();
    expect(log!.level).toBeUndefined();
    expect(log!.msg).toBeUndefined();
  });

  it('returns null for non-object JSON values', () => {
    expect(extractJsonLog('"just a string"')).toBeNull();
    expect(extractJsonLog('42')).toBeNull();
    expect(extractJsonLog('null')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(extractJsonLog('not json at all')).toBeNull();
    expect(extractJsonLog('{broken')).toBeNull();
  });

  it('normalizes pino numeric levels', () => {
    expect(normalizeJsonLevel(60)).toBe('fatal');
    expect(normalizeJsonLevel(55)).toBe('error');
    expect(normalizeJsonLevel(50)).toBe('error');
    expect(normalizeJsonLevel(45)).toBe('warn');
    expect(normalizeJsonLevel(40)).toBe('warn');
    expect(normalizeJsonLevel(35)).toBe('info');
    expect(normalizeJsonLevel(30)).toBe('info');
    expect(normalizeJsonLevel(25)).toBe('debug');
    expect(normalizeJsonLevel(20)).toBe('debug');
    expect(normalizeJsonLevel(15)).toBe('trace');
    expect(normalizeJsonLevel(10)).toBe('trace');
    expect(normalizeJsonLevel(5)).toBe('trace');
  });

  it('normalizes string levels as lowercase', () => {
    expect(normalizeJsonLevel('ERROR')).toBe('error');
    expect(normalizeJsonLevel('Warning')).toBe('warning');
    expect(normalizeJsonLevel('INFO')).toBe('info');
  });

  it('defaults undefined level to info', () => {
    expect(normalizeJsonLevel(undefined)).toBe('info');
  });

  it('scores JSON error/fatal as 100', () => {
    expect(scoreJsonLine('{"level":"error","msg":"boom"}')).toBe(100);
    expect(scoreJsonLine('{"level":"fatal","msg":"boom"}')).toBe(100);
    expect(scoreJsonLine('{"level":"critical","msg":"boom"}')).toBe(100);
    expect(scoreJsonLine('{"level":50,"msg":"boom"}')).toBe(100);
    expect(scoreJsonLine('{"severity":"error","msg":"boom"}')).toBe(100);
  });

  it('scores JSON warn/warning as 50', () => {
    expect(scoreJsonLine('{"level":"warn","msg":"retry"}')).toBe(50);
    expect(scoreJsonLine('{"level":"warning","msg":"retry"}')).toBe(50);
    expect(scoreJsonLine('{"level":40,"msg":"retry"}')).toBe(50);
  });

  it('drops JSON info/debug/trace (returns null)', () => {
    expect(scoreJsonLine('{"level":"info","msg":"started"}')).toBeNull();
    expect(scoreJsonLine('{"level":"debug","msg":"probe"}')).toBeNull();
    expect(scoreJsonLine('{"level":"trace","msg":"enter"}')).toBeNull();
    expect(scoreJsonLine('{"level":30,"msg":"started"}')).toBeNull();
    expect(scoreJsonLine('{"level":20,"msg":"debugging"}')).toBeNull();
    expect(scoreJsonLine('{"level":10,"msg":"tracing"}')).toBeNull();
  });

  it('keeps JSON info/debug/trace if there is an error stack', () => {
    expect(
      scoreJsonLine(
        '{"level":"info","msg":"get failed","err":{"stack":"Error: ECONNREFUSED\\n    at foo.ts:5"}}',
      ),
    ).toBe(80);
    expect(
      scoreJsonLine(
        '{"level":"debug","msg":"query","error":{"stack":"Error: timeout\\n    at bar.ts:10"}}',
      ),
    ).toBe(80);
  });

  it('returns undefined for non-JSON lines', () => {
    expect(scoreJsonLine('not json')).toBeUndefined();
    expect(scoreJsonLine('[ERROR] plain text log')).toBeUndefined();
    expect(scoreJsonLine('Caused by: Error: something')).toBeUndefined();
  });
});
