import { describe, expect, it } from 'vitest';
import {
  addRepeatGroupLine,
  createRepeatGroup,
  createRepeatSignature,
  renderRepeatGroup,
} from '../src/core/dedupe/repeat-grouper';
import { processLogString } from '../src/core/logstrip-parser';

describe('repeat-grouper score tracking', () => {
  it('defaults the group score to zero', () => {
    const group = createRepeatGroup('worker idle');
    expect(group.score).toBe(0);
  });

  it('carries the score supplied at creation', () => {
    const group = createRepeatGroup('worker idle', 40);
    expect(group.score).toBe(40);
  });

  it('raises the group score when a later line scores higher', () => {
    const group = createRepeatGroup('worker idle', 10);
    addRepeatGroupLine(group, 'worker idle', 75);
    expect(group.score).toBe(75);
    expect(group.count).toBe(2);
  });

  it('keeps the higher score when a later line scores lower', () => {
    const group = createRepeatGroup('worker idle', 90);
    addRepeatGroupLine(group, 'worker idle', 5);
    expect(group.score).toBe(90);
  });
});

describe('template mining signatures', () => {
  it('wildcards numbers after generic word labels in template mode', () => {
    expect(createRepeatSignature('Retrying upload 17 for tenant acme', true)).toBe(
      'Retrying upload [VALUE] for tenant acme',
    );
    expect(createRepeatSignature('Retrying upload 18 for tenant acme', true)).toBe(
      createRepeatSignature('Retrying upload 17 for tenant acme', true),
    );
  });

  it('keeps the allowlist-only behavior without template mode', () => {
    expect(createRepeatSignature('Retrying upload 17 for tenant acme')).toBe(
      'Retrying upload 17 for tenant acme',
    );
    // "worker" is on the classic allowlist, so both modes wildcard it.
    expect(createRepeatSignature('restarting worker 4')).toBe('restarting worker [VALUE]');
  });

  it('never merges numbers after blocklisted diagnostic labels', () => {
    expect(createRepeatSignature('process exited with code 1', true)).toBe(
      'process exited with code 1',
    );
    expect(createRepeatSignature('terminated by signal 9', true)).toBe(
      'terminated by signal 9',
    );
    expect(createRepeatSignature('failed at line 42', true)).toBe('failed at line 42');
  });

  it('accepts labels with a trailing colon and rejects non-word labels', () => {
    expect(createRepeatSignature('attempt: 3 of upload', true)).toBe(
      'attempt: [VALUE] of upload',
    );
    expect(createRepeatSignature('[2026] 17 widgets', true)).toBe('[2026] 17 widgets');
  });

  it('collects template deltas when merging lines', () => {
    const group = createRepeatGroup(
      'Retrying upload 17 for tenant acme',
      0,
      createRepeatSignature('Retrying upload 17 for tenant acme', true),
    );
    addRepeatGroupLine(group, 'Retrying upload 18 for tenant acme', 0, true);
    addRepeatGroupLine(group, 'Retrying upload 19 for tenant acme', 0, true);

    expect(group.count).toBe(3);
    expect(renderRepeatGroup(group)).toBe('Retrying upload [17 | 18 | 19] for tenant acme');
  });
});

describe('template mining with units and punctuation', () => {
  it('wildcards a number wrapped in parentheses after a parenthesized label', () => {
    const first = createRepeatSignature('Redis connection lost, retrying in 2s (attempt 1)', true);
    expect(first).toBe('Redis connection lost, retrying in [VALUE] (attempt [VALUE])');
    expect(createRepeatSignature('Redis connection lost, retrying in 2s (attempt 2)', true)).toBe(first);
  });

  it('wildcards values that carry a duration or size unit', () => {
    expect(createRepeatSignature('request took 120ms', true)).toBe('request took [VALUE]');
    expect(createRepeatSignature('request took 3.4s', true)).toBe('request took [VALUE]');
    expect(createRepeatSignature('uploaded 12MB', true)).toBe('uploaded [VALUE]');
    expect(createRepeatSignature('cache hit 82%', true)).toBe('cache hit [VALUE]');
    expect(createRepeatSignature('waited 5m', true)).toBe('waited [VALUE]');
  });

  it('does not treat other letter suffixes as units', () => {
    expect(createRepeatSignature('built 12abc', true)).toBe('built 12abc');
    expect(createRepeatSignature('commit 5f3a2d1', true)).toBe('commit 5f3a2d1');
  });

  it('keeps the wrapping punctuation when folding values', () => {
    const line = (n: number, ms: number): string =>
      `Task completed in (${ms}ms) attempt ${n}, tenant acme`;
    const group = createRepeatGroup(line(1, 40), 0, createRepeatSignature(line(1, 40), true));
    addRepeatGroupLine(group, line(2, 55), 0, true);

    expect(renderRepeatGroup(group)).toBe(
      'Task completed in ([40ms | 55ms]) attempt [1 | 2], tenant acme',
    );
  });

  it('does not merge values wrapped in different punctuation', () => {
    expect(createRepeatSignature('retry (3)', true)).not.toBe(createRepeatSignature('retry 3', true));
  });

  it('keeps the classic mode strict about bare numbers', () => {
    expect(createRepeatSignature('worker 4s')).toBe('worker 4s');
    expect(createRepeatSignature('worker 4)')).toBe('worker 4)');
    expect(createRepeatSignature('worker 4')).toBe('worker [VALUE]');
  });

  it('never merges blocklisted labels even when parenthesized', () => {
    expect(createRepeatSignature('failed (line 42)', true)).toBe('failed (line 42)');
    expect(createRepeatSignature('failed (exit 1)', true)).toBe('failed (exit 1)');
  });

  it('folds retry lines whose delay and attempt change', async () => {
    const lines = [
      '[TIME] - app.worker - WARNING - Redis connection lost, retrying in 2s (attempt 1)',
      '[TIME] - app.worker - WARNING - Redis connection lost, retrying in 4s (attempt 2)',
      '[TIME] - app.worker - WARNING - Redis connection lost, retrying in 8s (attempt 3)',
    ];
    const { output } = await processLogString(`${lines.join('\n')}\n`);

    expect(output).toBe(
      '[x3] [TIME] - app.worker - WARNING - Redis connection lost, retrying in [2s | 4s | 8s] (attempt [1 | 2 | 3])\n',
    );
  });
});
