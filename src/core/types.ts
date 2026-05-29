import type { SeverityLevel } from './severity/severity-filter.js';
import type { LogStripCustomConfig } from './logstrip-config.js';

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
  | 'progress'
  | 'sample-limit'
  | 'severity';

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
  timedOut?: boolean;
}
