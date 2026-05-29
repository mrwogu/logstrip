import { describe, expect, it } from 'vitest';
import {
  addRepeatGroupLine,
  createRepeatGroup,
} from '../src/core/dedupe/repeat-grouper';

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
