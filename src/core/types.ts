import type { SeverityLevel } from './severity/severity-filter.js';
import type { LogStripCustomConfig } from './logstrip-config.js';
import type { ContentKind } from './detection/content-kind.js';

export type StaticAggressiveness = 'low' | 'medium' | 'high' | 'aggressive';
export type Aggressiveness = StaticAggressiveness | 'auto';
export type MultilineMode = 'auto' | 'auto-source' | 'python' | 'node' | 'java' | 'go' | 'rust' | 'off';
export type LogStripOutputFormat = 'text' | 'jsonl-preserve';
export type LogStripErrorCode =
  | 'ABORTED'
  | 'INVALID_CONFIG'
  | 'SAME_INPUT_OUTPUT'
  | 'TIMEOUT';
export type LogStripDecisionReason =
  | 'after-context'
  | 'cascade'
  | 'ci-noise'
  | 'context-buffered'
  | 'context-disabled'
  | 'custom-ignore'
  | 'empty'
  | 'exclude-filter'
  | 'hard-keep'
  | 'ignored-tag'
  | 'include-filter'
  | 'internal-stack'
  | 'low-score'
  | 'passthrough'
  | 'progress'
  | 'sample-limit'
  | 'severity'
  | 'stack-truncated';

export interface LogStripLineDecision {
  line: string;
  sanitizedLine?: string;
  kept: boolean;
  dropped: boolean;
  hardKeep: boolean;
  repeated: boolean;
  reason: LogStripDecisionReason;
  score?: number;
}

export interface LogStripStringResult extends LogStripResult {
  output: string;
}

export interface LogStripFileJob {
  inputPath: string;
  outputPath: string;
  options?: LogStripOptions;
}

export interface LogStripOptions {
  aggressiveness?: Aggressiveness;
  config?: LogStripCustomConfig;
  configPath?: string;
  multiline?: MultilineMode;
  severity?: SeverityLevel;
  maxLineLength?: number;
  include?: RegExp;
  exclude?: RegExp;
  sampleSize?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onDecision?: (decision: LogStripLineDecision) => void;
  outputFormat?: LogStripOutputFormat;
  contextBefore?: number;
  contextAfter?: number;
  dedupe?: boolean;
  tokenEstimator?: (line: string) => number;
  preserveIdSuffix?: number;
  maxTokens?: number;
  collapseRepeatedStacks?: boolean;
  dedupeWindow?: number;
  rootCause?: boolean;
  formatDetectionSampleSize?: number;
  multilingual?: boolean;
  collapseBlocks?: number;
  adaptiveContext?: boolean;
  /**
   * Merge near-identical lines whose only difference is a number after a
   * generic word label (template mining). Default: on; set false to require
   * exact post-sanitization matches for [xN] folding.
   */
  templateMining?: boolean;
  /**
   * Replace a run of lines that repeats an earlier run in the recent output
   * (the same stack trace printed again later) with one
   * "[... N lines repeated from above ...]" marker. Default: on; set false to
   * keep every repeated line. Ignored when `dedupe` is false.
   */
  collapseRepeatedBlocks?: boolean;
  /**
   * Keep at most N consecutive application stack frames per trace; the rest
   * collapse into a single "[... K more application stack frames ...]"
   * marker. Default: 10. Set 0 to keep every frame.
   */
  maxStackFrames?: number;
  /**
   * Auto-detect a structured JSON document (test report, scanner export) at
   * the head of the stream and compress it semantically instead of running
   * the line pipeline, which would drop structural lines and emit invalid
   * JSON. Default: on; set false to force line-oriented processing.
   */
  jsonReport?: boolean;
  /**
   * Buffering cap for JSON document detection. A candidate document larger
   * than this falls back to the streaming line pipeline. Default: 8 MiB.
   */
  jsonReportMaxBytes?: number;
  /**
   * Classify the first lines of the stream and, when they are plain text
   * (prose, markdown, source code, configuration, data) rather than a log,
   * copy the input through instead of compressing it: every line is kept and
   * filters and truncation do not apply. Credentials are still masked (tokens,
   * passwords, connection strings, PEM private keys, plus the custom sanitize
   * rules of the config); identifiers, timestamps and prose are not, so text
   * without secrets comes out unchanged. Line endings are normalized to "\n".
   * Output starts once the sample is classified: after about 8 lines for a
   * stream that already reads like a log, after at most 100 non-blank lines
   * or 256 KiB for text. Default: on; set false to force the log pipeline.
   */
  textPassthrough?: boolean;
}

export interface LogStripStats {
  inputLines: number;
  outputLines: number;
  inputWords: number;
  outputWords: number;
  inputBytes: number;
  outputBytes: number;
  droppedLines: number;
  duplicateLines: number;
  hiddenInternalStackLines: number;
  truncatedLines?: number;
}

export interface LogStripResult {
  stats: LogStripStats;
  inputTokens: number;
  outputTokens: number;
  savedTokens: number;
  savingsPercent: number;
  detectedSources?: readonly string[];
  outputPath?: string;
  detectedFormat?: string;
  /**
   * What the input was taken for: 'text' when it was copied through (see
   * `textPassthrough`), 'log' when it went through the log pipeline.
   * Absent when processing timed out before the input was classified.
   */
  contentKind?: ContentKind;
  timedOut?: boolean;
}
