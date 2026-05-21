import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
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

const STORE_PATH = join(
  process.env.LOGSTRIP_TELEMETRY_DIR ?? join(homedir(), '.logstrip'),
  'telemetry.json',
);

const MAX_ENTRIES = 1000;

function ensureDir(): void {
  try { mkdirSync(join(process.env.LOGSTRIP_TELEMETRY_DIR ?? join(homedir(), '.logstrip')), { recursive: true }); } catch {}
}

export function loadTelemetry(): TelemetryStore {
  try { return JSON.parse(readFileSync(STORE_PATH, 'utf8')) as TelemetryStore; }
  catch { return { version: 1, totalRuns: 0, totalInputTokens: 0, totalOutputTokens: 0, totalSavedTokens: 0, lastRun: '', entries: [] }; }
}

export function saveTelemetry(store: TelemetryStore): void {
  try { ensureDir(); writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8'); } catch {}
}

export function recordTelemetry(result: LogStripResult): TelemetryStore {
  const store = loadTelemetry();
  const entry: TelemetryEntry = {
    timestamp: new Date().toISOString(),
    inputLines: result.stats.inputLines,
    outputLines: result.stats.outputLines,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    savedTokens: result.savedTokens,
    savingsPercent: result.savingsPercent,
    detectedSources: result.detectedSources,
  };
  store.entries.unshift(entry);
  if (store.entries.length > MAX_ENTRIES) store.entries = store.entries.slice(0, MAX_ENTRIES);
  store.totalRuns += 1;
  store.totalInputTokens += result.inputTokens;
  store.totalOutputTokens += result.outputTokens;
  store.totalSavedTokens += result.savedTokens;
  store.lastRun = entry.timestamp;
  saveTelemetry(store);
  return store;
}

export function formatTelemetrySummary(store: TelemetryStore): string {
  const avgSavings = store.totalInputTokens === 0 ? 0 : Math.round((store.totalSavedTokens / store.totalInputTokens) * 10000) / 100;
  const lines = [
    'LogStrip Telemetry',
    `  total runs       : ${store.totalRuns}`,
    `  input tokens     : ${store.totalInputTokens.toLocaleString()}`,
    `  output tokens    : ${store.totalOutputTokens.toLocaleString()}`,
    `  saved tokens     : ${store.totalSavedTokens.toLocaleString()}`,
    `  average savings  : ${avgSavings.toFixed(2)}%`,
    `  last run         : ${store.lastRun || 'never'}`,
  ];
  if (store.entries.length > 0) {
    lines.push(`\n  Last ${Math.min(5, store.entries.length)} runs:`);
    for (const entry of store.entries.slice(0, 5))
      lines.push(`    ${entry.timestamp.slice(0, 19)}  saved=${entry.savedTokens.toLocaleString()}  (${entry.savingsPercent.toFixed(1)}%)`);
  }
  return `${lines.join('\n')}\n`;
}

