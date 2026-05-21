import type { SeverityLevel } from './severity/severity-filter.js';

export type StaticAggressiveness = 'low' | 'medium' | 'high' | 'aggressive';
export type Aggressiveness = StaticAggressiveness | 'auto';
export type MultilineMode = 'auto' | 'python' | 'node' | 'java' | 'go' | 'rust' | 'off';

export interface LogStripOptions {
  aggressiveness?: Aggressiveness;
  configPath?: string;
  multiline?: MultilineMode;
  severity?: SeverityLevel;
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
}

export interface LogStripResult {
  stats: LogStripStats;
  inputTokens: number;
  outputTokens: number;
  savedTokens: number;
  savingsPercent: number;
  detectedSources?: readonly string[];
  outputPath?: string;
}
