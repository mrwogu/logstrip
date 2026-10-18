"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCascadeNoiseLine = isCascadeNoiseLine;
/**
 * Cascade-noise detection for root-cause anchoring (opt-in --root-cause).
 *
 * CI and build logs frequently bury the real root cause under downstream
 * "cascade" restatements — lines whose only content is that a *previous* or
 * *dependent* step already failed. These add no new diagnostic information.
 *
 * The pattern is deliberately conservative: it only matches phrasings that
 * explicitly reference a prior/upstream/dependent failure, so genuine
 * first-occurrence errors (e.g. "payment failed because timeout") are kept.
 */
const CASCADE_NOISE_PATTERN = /(?:\baborting due to \d+ previous errors?\b|\bcould not compile\b[^\n]*\bdue to (?:\d+ )?previous errors?\b|\bdue to (?:\d+ )?previous errors?\b|\bcompilation terminated\b|(?:\bskipping|\bskipped)\b[^\n]*\bbecause\b[^\n]*\b(?:dependency|previous|upstream|prerequisite)\b[^\n]*\b(?:failed|error)|\bbecause (?:a |an |the )?(?:previous|prior|upstream|dependent|prerequisite) (?:step|task|job|stage|build|target|test|dependency) (?:failed|errored|was cancelled|did not complete)\b)/iu;
function isCascadeNoiseLine(line) {
    return CASCADE_NOISE_PATTERN.test(line);
}
