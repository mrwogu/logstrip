import { describe, expect, it } from 'vitest';
import { planBlockDedupe } from '../src/core/dedupe/block-deduper';

function render(lines: string[], maxBlockLines: number): string[] {
  const plan = planBlockDedupe(lines, maxBlockLines);
  return plan.ops.map((op) =>
    op.kind === 'line' ? lines[op.index] : `[block x${op.count}]`,
  );
}

describe('planBlockDedupe', () => {
  it('passes through input with no repeated block', () => {
    const lines = ['a', 'b', 'c', 'd'];
    const plan = planBlockDedupe(lines, 4);
    expect(plan.removedLines).toBe(0);
    expect(render(lines, 4)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('collapses a 2-line block repeated twice', () => {
    const lines = ['a', 'b', 'a', 'b'];
    const plan = planBlockDedupe(lines, 4);
    expect(plan.removedLines).toBe(2);
    expect(render(lines, 4)).toEqual(['a', 'b', '[block x2]']);
  });

  it('counts three or more consecutive repeats', () => {
    const lines = ['x', 'y', 'x', 'y', 'x', 'y'];
    const plan = planBlockDedupe(lines, 4);
    expect(plan.removedLines).toBe(4);
    expect(render(lines, 4)).toEqual(['x', 'y', '[block x3]']);
  });

  it('prefers the longest repeating block', () => {
    const lines = ['a', 'b', 'c', 'a', 'b', 'c'];
    const plan = planBlockDedupe(lines, 4);
    expect(plan.removedLines).toBe(3);
    expect(render(lines, 4)).toEqual(['a', 'b', 'c', '[block x2]']);
  });

  it('respects the maxBlockLines bound', () => {
    const lines = ['a', 'b', 'c', 'a', 'b', 'c'];
    // With a bound of 2, the 3-line block cannot be detected as one unit.
    const plan = planBlockDedupe(lines, 2);
    expect(plan.removedLines).toBe(0);
    expect(render(lines, 2)).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });

  it('leaves a trailing partial block untouched', () => {
    const lines = ['a', 'b', 'a', 'b', 'a'];
    const plan = planBlockDedupe(lines, 4);
    expect(plan.removedLines).toBe(2);
    expect(render(lines, 4)).toEqual(['a', 'b', '[block x2]', 'a']);
  });

  it('clamps maxBlockLines to a minimum of 2', () => {
    const lines = ['a', 'b', 'a', 'b'];
    expect(planBlockDedupe(lines, 1).removedLines).toBe(2);
  });
});
