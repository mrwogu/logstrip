"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAdaptiveAfterBounds = buildAdaptiveAfterBounds;
exports.neutralErrorGap = neutralErrorGap;
exports.resolveAdaptiveAfterWindow = resolveAdaptiveAfterWindow;
/**
 * Adaptive after-context sizing by error density.
 *
 * In auto mode the fixed after-context window that follows each kept error is
 * replaced by a window that scales with how densely errors cluster:
 *
 * - Clustered errors (a small gap of scored lines since the previous error)
 *   are self-contextualizing, so the after-window shrinks to its minimum - the
 *   surrounding errors already supply the context.
 * - Isolated errors (a large gap since the previous error) earn extra
 *   after-context lines so a lone failure is not stranded without detail.
 * - Everything in between (and the very first error in a stream) keeps the
 *   unchanged base window, so the common case behaves exactly as before.
 *
 * The before-context is not adapted: it is drained from a ring buffer whose
 * length is already bounded by the same gap that drives this sizing, so a
 * clustered error never has more than a line or two pending anyway.
 */
const constants_js_1 = require("../constants.js");
function buildAdaptiveAfterBounds(baseAfter) {
    return {
        minAfter: Math.max(1, baseAfter - 1),
        baseAfter,
        maxAfter: baseAfter + constants_js_1.ADAPTIVE_CONTEXT_AFTER_EXPANSION,
        denseGap: constants_js_1.ADAPTIVE_CONTEXT_DENSE_GAP,
        sparseGap: constants_js_1.ADAPTIVE_CONTEXT_SPARSE_GAP,
    };
}
// A gap value that maps to the base window, used to seed the line counter so
// the first error in a stream is treated as neither clustered nor isolated.
function neutralErrorGap(bounds) {
    return Math.floor((bounds.denseGap + bounds.sparseGap) / 2);
}
function resolveAdaptiveAfterWindow(linesSinceError, bounds) {
    if (linesSinceError <= bounds.denseGap) {
        return bounds.minAfter;
    }
    if (linesSinceError >= bounds.sparseGap) {
        return bounds.maxAfter;
    }
    return bounds.baseAfter;
}
