import { type DetectedFormat } from './format-detector.js';
/**
 * Majority-vote format detection.
 *
 * Instead of locking onto the first recognizable line, the voter tallies the
 * detected format across the first N non-blank lines and picks the most common
 * one (ties broken by first appearance). This is robust to mixed-format logs
 * such as a JSON application stream interleaved with plaintext runtime output.
 */
export interface FormatVoter {
    votes: Map<DetectedFormat, number>;
    order: DetectedFormat[];
    samples: number;
    sampleSize: number;
    decided: boolean;
    result: DetectedFormat | undefined;
    /** Consecutive post-decision lines recognized as a different format. */
    driftMismatches: number;
}
/**
 * Number of consecutive recognizable lines in a *different* format that a
 * decided voter tolerates before re-electing. Catches mid-stream format
 * drift (e.g. plaintext boot output followed by a JSON application log).
 */
export declare const FORMAT_DRIFT_THRESHOLD = 20;
export declare function createFormatVoter(sampleSize: number): FormatVoter;
/**
 * Feed a non-blank line. Returns the decided format once enough samples have
 * been seen, otherwise `undefined` (keep sampling).
 */
export declare function voteFormat(voter: FormatVoter, line: string): DetectedFormat | undefined;
/**
 * Watch a decided voter for sustained format drift. Returns the new format
 * once FORMAT_DRIFT_THRESHOLD consecutive recognizable lines disagree with
 * the elected result; any agreeing (or unrecognizable) line resets the run.
 */
export declare function observeFormatDrift(voter: FormatVoter, line: string): DetectedFormat | undefined;
/** Force a decision (e.g. at end of stream when fewer than N lines were seen). */
export declare function decideFormat(voter: FormatVoter): DetectedFormat | undefined;
