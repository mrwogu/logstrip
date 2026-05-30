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
import {
  ADAPTIVE_CONTEXT_AFTER_EXPANSION,
  ADAPTIVE_CONTEXT_DENSE_GAP,
  ADAPTIVE_CONTEXT_SPARSE_GAP,
} from '../constants.js';

export interface AdaptiveAfterBounds {
  minAfter: number;
  baseAfter: number;
  maxAfter: number;
  denseGap: number;
  sparseGap: number;
}

export function buildAdaptiveAfterBounds(baseAfter: number): AdaptiveAfterBounds {
  return {
    minAfter: Math.max(1, baseAfter - 1),
    baseAfter,
    maxAfter: baseAfter + ADAPTIVE_CONTEXT_AFTER_EXPANSION,
    denseGap: ADAPTIVE_CONTEXT_DENSE_GAP,
    sparseGap: ADAPTIVE_CONTEXT_SPARSE_GAP,
  };
}

// A gap value that maps to the base window, used to seed the line counter so
// the first error in a stream is treated as neither clustered nor isolated.
export function neutralErrorGap(bounds: AdaptiveAfterBounds): number {
  return Math.floor((bounds.denseGap + bounds.sparseGap) / 2);
}

export function resolveAdaptiveAfterWindow(
  linesSinceError: number,
  bounds: AdaptiveAfterBounds,
): number {
  if (linesSinceError <= bounds.denseGap) {
    return bounds.minAfter;
  }
  if (linesSinceError >= bounds.sparseGap) {
    return bounds.maxAfter;
  }
  return bounds.baseAfter;
}
