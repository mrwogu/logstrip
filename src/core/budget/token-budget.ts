/**
 * Token-budget trimming.
 *
 * Given a list of already-compressed output lines, each annotated with a
 * relevance score and an estimated token cost, return the subset that fits a
 * target token budget while preserving the highest-scoring lines.
 *
 * The kept subset is returned in the original input order so the log still
 * reads top-to-bottom; only the *selection* is priority-driven.
 */

export interface BudgetLine {
  text: string;
  /** Higher = more important. Highest scores survive trimming first. */
  score: number;
  /** Estimated token cost of this line (including its trailing newline). */
  tokens: number;
}

export interface BudgetResult {
  /** Surviving lines, in original order. */
  kept: BudgetLine[];
  /** Number of lines removed to fit the budget. */
  droppedCount: number;
  /** Number of physical newlines removed (for stats accounting). */
  droppedPhysicalLines: number;
}

function physicalLineCount(text: string): number {
  return text.split('\n').length;
}

export function applyTokenBudget(
  lines: readonly BudgetLine[],
  maxTokens: number,
): BudgetResult {
  const budget = Math.max(0, Math.floor(maxTokens));
  const total = lines.reduce((sum, line) => sum + line.tokens, 0);

  if (total <= budget) {
    return { kept: [...lines], droppedCount: 0, droppedPhysicalLines: 0 };
  }

  // Priority order: highest score first; ties broken by original position so
  // earlier (and therefore usually root-cause) lines win.
  const order = lines.map((line, index) => ({ line, index }));
  order.sort((a, b) => {
    if (b.line.score !== a.line.score) return b.line.score - a.line.score;
    return a.index - b.index;
  });

  const keepIndices = new Set<number>();
  let used = 0;
  for (const { line, index } of order) {
    if (used + line.tokens > budget) {
      continue;
    }
    keepIndices.add(index);
    used += line.tokens;
  }

  const kept: BudgetLine[] = [];
  let droppedCount = 0;
  let droppedPhysicalLines = 0;
  for (const [index, line] of lines.entries()) {
    if (keepIndices.has(index)) {
      kept.push(line);
    } else {
      droppedCount += 1;
      droppedPhysicalLines += physicalLineCount(line.text);
    }
  }

  return { kept, droppedCount, droppedPhysicalLines };
}
