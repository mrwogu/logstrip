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
export declare function applyTokenBudget(lines: readonly BudgetLine[], maxTokens: number): BudgetResult;
