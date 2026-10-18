import type { LogStripResult } from '../types.js';
export interface TelemetryEntry {
    timestamp: string;
    inputLines: number;
    outputLines: number;
    inputTokens: number;
    outputTokens: number;
    savedTokens: number;
    savingsPercent: number;
    detectedSources?: readonly string[];
}
export interface TelemetryStore {
    version: number;
    totalRuns: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalSavedTokens: number;
    lastRun: string;
    entries: TelemetryEntry[];
}
export declare function loadTelemetry(): TelemetryStore;
export declare function saveTelemetry(store: TelemetryStore): void;
export declare function recordTelemetry(result: LogStripResult): TelemetryStore;
export declare function formatTelemetrySummary(store: TelemetryStore): string;
