import { describe, expect, it } from 'vitest';
import {
  buildAdaptiveAfterBounds,
  neutralErrorGap,
  resolveAdaptiveAfterWindow,
} from '../src/core/context/adaptive-window';

describe('buildAdaptiveAfterBounds', () => {
  it('derives min/base/max after-window bounds from the base window', () => {
    expect(buildAdaptiveAfterBounds(2)).toMatchObject({
      minAfter: 1,
      baseAfter: 2,
      maxAfter: 4,
      denseGap: 2,
      sparseGap: 12,
    });
  });

  it('clamps the minimum after-window to at least one line', () => {
    const bounds = buildAdaptiveAfterBounds(0);
    expect(bounds.minAfter).toBe(1);
    expect(bounds.maxAfter).toBe(2);
  });
});

describe('neutralErrorGap', () => {
  it('returns a gap that maps to the base window', () => {
    const bounds = buildAdaptiveAfterBounds(2);
    const gap = neutralErrorGap(bounds);
    expect(gap).toBeGreaterThan(bounds.denseGap);
    expect(gap).toBeLessThan(bounds.sparseGap);
    expect(resolveAdaptiveAfterWindow(gap, bounds)).toBe(2);
  });
});

describe('resolveAdaptiveAfterWindow', () => {
  const bounds = buildAdaptiveAfterBounds(2);

  it('tightens the window for clustered errors at or below the dense gap', () => {
    expect(resolveAdaptiveAfterWindow(1, bounds)).toBe(1);
    expect(resolveAdaptiveAfterWindow(bounds.denseGap, bounds)).toBe(1);
  });

  it('keeps the base window for medium-density gaps', () => {
    expect(resolveAdaptiveAfterWindow(bounds.denseGap + 1, bounds)).toBe(2);
    expect(resolveAdaptiveAfterWindow(bounds.sparseGap - 1, bounds)).toBe(2);
  });

  it('widens the window for isolated errors at or above the sparse gap', () => {
    expect(resolveAdaptiveAfterWindow(bounds.sparseGap, bounds)).toBe(4);
    expect(resolveAdaptiveAfterWindow(99, bounds)).toBe(4);
  });
});
