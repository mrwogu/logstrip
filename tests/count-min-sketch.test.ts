import { describe, expect, it } from 'vitest';
import { CountMinSketch } from '../src/core/dedupe/count-min-sketch.js';

describe('CountMinSketch', () => {
  it('starts with zero for any key', () => {
    const cms = new CountMinSketch(8192, 4);
    expect(cms.increment('foo')).toBe(1);
  });

  it('increments and returns count', () => {
    const cms = new CountMinSketch(8192, 4);
    expect(cms.increment('foo')).toBe(1);
    expect(cms.increment('foo')).toBe(2);
    expect(cms.increment('foo')).toBe(3);
  });

  it('returns 1 for first occurrence of each key', () => {
    const cms = new CountMinSketch(8192, 4);
    expect(cms.increment('foo')).toBe(1);
    expect(cms.increment('bar')).toBe(1);
    expect(cms.increment('baz')).toBe(1);
  });

  it('distinguishes different keys', () => {
    const cms = new CountMinSketch(1024, 4);
    cms.increment('foo');
    cms.increment('foo');
    expect(cms.increment('bar')).toBe(1);
    expect(cms.increment('foo')).toBe(3);
  });

  it('handles empty strings', () => {
    const cms = new CountMinSketch(8192, 4);
    expect(cms.increment('')).toBe(1);
    expect(cms.increment('')).toBe(2);
  });

  it('handles very long keys', () => {
    const cms = new CountMinSketch(8192, 4);
    const longKey = 'x'.repeat(10_000);
    expect(cms.increment(longKey)).toBe(1);
    expect(cms.increment(longKey)).toBe(2);
  });

  it('defaults to 8192×4', () => {
    const cms = new CountMinSketch();
    expect(cms.increment('test')).toBe(1);
  });
});
