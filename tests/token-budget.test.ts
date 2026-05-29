import { describe, expect, it } from 'vitest';
import { applyTokenBudget, type BudgetLine } from '../src/core/budget/token-budget';

function line(text: string, score: number, tokens: number): BudgetLine {
  return { text, score, tokens };
}

describe('applyTokenBudget', () => {
  it('keeps every line when the total fits the budget', () => {
    const lines = [line('a', 10, 2), line('b', 5, 3)];
    const result = applyTokenBudget(lines, 10);
    expect(result.kept).toEqual(lines);
    expect(result.droppedCount).toBe(0);
    expect(result.droppedPhysicalLines).toBe(0);
  });

  it('drops the lowest-scoring lines first when over budget', () => {
    const lines = [
      line('low', 1, 5),
      line('high', 100, 5),
      line('mid', 50, 5),
    ];
    const result = applyTokenBudget(lines, 10);
    expect(result.kept.map((l) => l.text)).toEqual(['high', 'mid']);
    expect(result.droppedCount).toBe(1);
  });

  it('preserves original order among survivors', () => {
    const lines = [
      line('first', 100, 4),
      line('second', 1, 4),
      line('third', 90, 4),
    ];
    const result = applyTokenBudget(lines, 8);
    expect(result.kept.map((l) => l.text)).toEqual(['first', 'third']);
  });

  it('breaks score ties by original position (earlier wins)', () => {
    const lines = [line('a', 10, 5), line('b', 10, 5)];
    const result = applyTokenBudget(lines, 5);
    expect(result.kept.map((l) => l.text)).toEqual(['a']);
  });

  it('skips a high-priority line that alone exceeds the remaining budget', () => {
    const lines = [line('huge', 100, 50), line('small', 1, 3)];
    const result = applyTokenBudget(lines, 5);
    expect(result.kept.map((l) => l.text)).toEqual(['small']);
    expect(result.droppedCount).toBe(1);
  });

  it('counts physical newlines of dropped multiline entries', () => {
    const lines = [line('keep', 100, 2), line('a\nb\nc', 1, 9)];
    const result = applyTokenBudget(lines, 2);
    expect(result.droppedCount).toBe(1);
    expect(result.droppedPhysicalLines).toBe(3);
  });

  it('treats a zero or negative budget as dropping everything', () => {
    const lines = [line('a', 10, 2)];
    expect(applyTokenBudget(lines, 0).kept).toEqual([]);
    expect(applyTokenBudget(lines, -5).kept).toEqual([]);
  });

  it('floors fractional budgets', () => {
    const lines = [line('a', 10, 3), line('b', 5, 3)];
    const result = applyTokenBudget(lines, 5.9);
    expect(result.kept.map((l) => l.text)).toEqual(['a']);
  });
});
