import type { MultilineMode } from './multiline-buffer.js';
/**
 * Resolve the best multiline mode from detected log sources.
 * Returns the mode matching the first recognized source, or 'off' if none match.
 */
export declare function resolveAutoMultiline(detectedSources: readonly string[]): Exclude<MultilineMode, 'auto-source'>;
/**
 * Compute the effective multiline mode given the requested mode and
 * the current set of detected sources (updated continuously during streaming).
 */
export declare function effectiveMultilineMode(requested: MultilineMode, detectedSources: readonly string[]): Exclude<MultilineMode, 'auto-source'>;
