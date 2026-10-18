import { Transform, Writable } from 'node:stream';
import { type LogStripCustomConfig } from './logstrip-config.js';
import type { LogStripErrorCode, LogStripFileJob, LogStripLineDecision, LogStripOptions, LogStripResult, LogStripStringResult } from './types.js';
export { inferSeverity, parseSeverityLevel, passesSeverityFilter } from './severity/severity-filter.js';
export type { SeverityLevel } from './severity/severity-filter.js';
export { detectFormat } from './formats/format-detector.js';
export { type FormatVoter, FORMAT_DRIFT_THRESHOLD, createFormatVoter, decideFormat, observeFormatDrift, voteFormat, } from './formats/format-voter.js';
export { parseAggressiveness } from './aggressiveness/levels.js';
export { CONTENT_EARLY_LOG_MIN_LINES, CONTENT_EARLY_LOG_MIN_RATIO, CONTENT_LINE_SCAN_LIMIT, CONTENT_TEXT_MAX_LOG_RATIO, CONTENT_TEXT_MIN_LINES, CONTENT_TEXT_MIN_RATIO, CONTEXT_WINDOW_AFTER, CONTEXT_WINDOW_BEFORE, DEFAULT_CONTENT_SAMPLE_BYTES, DEFAULT_CONTENT_SAMPLE_LINES, DEFAULT_MAX_STACK_FRAMES, INTERNAL_STACK_MARKER, MAX_REPEAT_DELTA_VALUES, RARITY_BOOST, RARITY_MIN_INPUT_LINES, SCORE_KEEP_THRESHOLD, TFIDF_MAP_LIMIT, TFIDF_PENALTY, TFIDF_REPEAT_THRESHOLD, } from './constants.js';
export { createRepeatSignature } from './dedupe/repeat-grouper.js';
export { normalizeStackFrameLineCol, stackWindowSignature, } from './dedupe/stack-fingerprint.js';
export { detectLogSources } from './detection/source-detector.js';
export { type ContentClassification, type ContentKind, type ContentSampleLimits, ContentSampler, classifyContent, } from './detection/content-kind.js';
export { type TextContentClaim, claimTextContent, } from './detection/content-claim.js';
export { type MultilineMode, isContinuationLine, } from './multiline/multiline-buffer.js';
export { effectiveMultilineMode, resolveAutoMultiline, } from './multiline/auto-multiline-resolver.js';
export { type BudgetLine, type BudgetResult, applyTokenBudget, } from './budget/token-budget.js';
export { type AdaptiveAfterBounds, buildAdaptiveAfterBounds, neutralErrorGap, resolveAdaptiveAfterWindow, } from './context/adaptive-window.js';
export { isCascadeNoiseLine } from './scoring/cascade-filter.js';
export { isPassingTestLine } from './scoring/passing-test.js';
export { type HeaderLogLevel, detectHeaderLogLevel, } from './scoring/log-level.js';
export { isMultilingualDiagnosticLine } from './scoring/multilingual-keywords.js';
export { type BlockDedupeOp, type BlockDedupePlan, planBlockDedupe, } from './dedupe/block-deduper.js';
export { JSON_GROUP_MARKER, JSON_META_MARKER, JSON_META_NOTE_MARKER, JSON_REPORT_MAX_BYTES, JSON_REPORT_MAX_VARIANT_VALUES, JSON_REPORT_MIN_REFERENCE_LENGTH, type ClaimedJsonDocument, type JsonDocumentClaim, type JsonReportCompression, claimJsonDocument, compressJsonReport, } from './formats/json-report.js';
export { maskSecrets, sanitizeLine } from './sanitize/sanitize-line.js';
export { ENTROPY_MIN_TOKEN_LENGTH, ENTROPY_SECRET_THRESHOLD, maskHighEntropyTokens, shannonEntropy, } from './sanitize/entropy-secret.js';
export { createPemBlockState, maskPemBlock, maskPemBlockInText, type PemBlockState, } from './sanitize/pem-block.js';
export { estimateTokens, isAccessLogNoiseLine, isInternalStackTraceLine, isCiNoiseLine, isProgressBarLine, isStackFrameLine, looksLikeDiagnosticLine, scoreLineRelevance, shouldKeepLine, } from './scoring/relevance-score.js';
export { KNOWN_LOG_SOURCES, LOG_SOURCE_SIGNATURES } from './sources/catalog.js';
export type { Aggressiveness, LogStripDecisionReason, LogStripErrorCode, LogStripFileJob, LogStripLineDecision, LogStripOptions, LogStripResult, LogStripStats, LogStripStringResult, StaticAggressiveness, } from './types.js';
export { parseLogStripConfig, resolveConfigPath, } from './logstrip-config.js';
export type { LogStripCustomConfig, LogStripSourceSignature, SanitizeRule, } from './logstrip-config.js';
export { type TelemetryEntry, type TelemetryStore, formatTelemetrySummary, loadTelemetry, recordTelemetry, saveTelemetry, } from './telemetry/telemetry-store';
export declare class LogStripError extends Error {
    readonly code: LogStripErrorCode;
    constructor(code: LogStripErrorCode, message: string);
}
export declare function buildMergedConfig(options?: LogStripOptions): LogStripCustomConfig & {
    mergedSources: readonly (readonly [string, readonly string[]])[];
};
export declare function processLogStream(input: NodeJS.ReadableStream, output: Writable, options?: LogStripOptions): Promise<LogStripResult>;
export declare function processLogFile(inputPath: string, outputPath: string, options?: LogStripOptions): Promise<LogStripResult>;
export declare function processLogFiles(jobs: readonly LogStripFileJob[], options?: LogStripOptions): Promise<LogStripResult[]>;
export declare function processLogString(inputText: string, options?: LogStripOptions): Promise<LogStripStringResult>;
export interface LogStripTransform extends Transform {
    readonly result: Promise<LogStripResult>;
}
export declare function createLogStripTransform(options?: LogStripOptions): LogStripTransform;
export declare function explainLogLine(line: string, options?: LogStripOptions): LogStripLineDecision;
export declare function pathsReferToSameFile(inputPath: string, outputPath: string): boolean;
export declare function processLogStreamWithTimeout(input: NodeJS.ReadableStream, output: Writable, options?: LogStripOptions, timeoutMs?: number): Promise<LogStripResult>;
