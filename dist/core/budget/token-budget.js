"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTokenBudget = applyTokenBudget;
function physicalLineCount(text) {
    return text.split('\n').length;
}
function applyTokenBudget(lines, maxTokens) {
    const budget = Math.max(0, Math.floor(maxTokens));
    const total = lines.reduce((sum, line) => sum + line.tokens, 0);
    if (total <= budget) {
        return { kept: [...lines], droppedCount: 0, droppedPhysicalLines: 0 };
    }
    // Priority order: highest score first; ties broken by original position so
    // earlier (and therefore usually root-cause) lines win.
    const order = lines.map((line, index) => ({ line, index }));
    order.sort((a, b) => {
        if (b.line.score !== a.line.score)
            return b.line.score - a.line.score;
        return a.index - b.index;
    });
    const keepIndices = new Set();
    let used = 0;
    for (const { line, index } of order) {
        if (used + line.tokens > budget) {
            continue;
        }
        keepIndices.add(index);
        used += line.tokens;
    }
    const kept = [];
    let droppedCount = 0;
    let droppedPhysicalLines = 0;
    for (const [index, line] of lines.entries()) {
        if (keepIndices.has(index)) {
            kept.push(line);
        }
        else {
            droppedCount += 1;
            droppedPhysicalLines += physicalLineCount(line.text);
        }
    }
    return { kept, droppedCount, droppedPhysicalLines };
}
