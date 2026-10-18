import type { Aggressiveness } from '../types.js';
/**
 * True for lines the pipeline drops before scoring: bracketed or JSON
 * INFO/DEBUG/TRACE/VERBOSE tags, routine Apache notices, and unbracketed
 * header levels (Spring, logback, Python logging, logfmt, glog). A line with
 * an unbracketed noise level is kept when its text still reads as a
 * diagnostic or reports a non-zero exit, so "INFO ... connection refused" and
 * "INFO service exited with code 137" are never dropped.
 */
export declare function isIgnoredLogLine(line: string): boolean;
export declare function shouldKeepLine(line: string): boolean;
/**
 * True for lines that are a single stack-trace frame (any supported
 * language). Excludes trace headers (goroutine/Traceback/panic) on purpose:
 * the parser's app-stack truncation counts only consecutive frames.
 */
export declare function isStackFrameLine(line: string): boolean;
export declare function looksLikeDiagnosticLine(line: string): boolean;
export declare function isInternalStackTraceLine(line: string): boolean;
export declare function estimateTokens(wordCountOrText: number | string): number;
export declare function scoreLineRelevance(line: string, aggressiveness: Aggressiveness, seenCount?: number, inputLines?: number): number;
export declare function isCiNoiseLine(line: string): boolean;
export declare function isProgressBarLine(line: string): boolean;
export { isAccessLogNoiseLine } from '../formats/access-log-classifier.js';
