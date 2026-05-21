import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type TelemetryEntry,
  type TelemetryStore,
  formatTelemetrySummary,
  loadTelemetry,
  recordTelemetry,
  saveTelemetry,
} from '../src/core/telemetry/telemetry-store';

// The module-level STORE_PATH is computed at import time from
// process.env.LOGSTRIP_TELEMETRY_DIR. vi.hoisted runs before module
// imports are resolved, ensuring the env var is set first.
const TEMP_DIR = vi.hoisted(() => {
  const { join: pJoin } = require('node:path');
  const dir = pJoin(__dirname, '__telemetry_temp__');
  process.env.LOGSTRIP_TELEMETRY_DIR = dir;
  return dir;
});

const STORE_PATH = join(TEMP_DIR, 'telemetry.json');

const EMPTY_STORE: TelemetryStore = {
  version: 1,
  totalRuns: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalSavedTokens: 0,
  lastRun: '',
  entries: [],
};

const SAMPLE_RESULT = {
  stats: {
    inputLines: 100,
    outputLines: 20,
    inputWords: 500,
    outputWords: 100,
    inputBytes: 3000,
    outputBytes: 600,
    droppedLines: 80,
    duplicateLines: 10,
    hiddenInternalStackLines: 5,
  },
  inputTokens: 650,
  outputTokens: 130,
  savedTokens: 520,
  savingsPercent: 80,
};

function resetStore(): void {
  try { rmSync(TEMP_DIR, { force: true, recursive: true }); } catch {}
}

beforeEach(resetStore);
afterEach(resetStore);

describe('loadTelemetry', () => {
  it('returns an empty store when no file exists', () => {
    const store = loadTelemetry();
    expect(store.version).toBe(1);
    expect(store.totalRuns).toBe(0);
    expect(store.entries).toEqual([]);
  });

  it('loads a previously saved store', () => {
    const store: TelemetryStore = {
      ...EMPTY_STORE,
      totalRuns: 5,
      totalInputTokens: 1000,
      totalOutputTokens: 200,
      totalSavedTokens: 800,
      lastRun: '2026-01-01T00:00:00.000Z',
      entries: [
        {
          timestamp: '2026-01-01T00:00:00.000Z',
          inputLines: 100,
          outputLines: 20,
          inputTokens: 200,
          outputTokens: 40,
          savedTokens: 160,
          savingsPercent: 80,
        },
      ],
    };
    saveTelemetry(store);
    const loaded = loadTelemetry();
    expect(loaded.totalRuns).toBe(5);
    expect(loaded.entries.length).toBe(1);
  });

  it('returns empty store for corrupted JSON', () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    writeFileSync(STORE_PATH, 'not json{{{', 'utf8');
    const store = loadTelemetry();
    expect(store.totalRuns).toBe(0);
  });
});

describe('saveTelemetry', () => {
  it('persists a store to disk', () => {
    const store: TelemetryStore = {
      ...EMPTY_STORE,
      totalRuns: 1,
      totalSavedTokens: 42,
    };
    saveTelemetry(store);
    const loaded = loadTelemetry();
    expect(loaded.totalRuns).toBe(1);
    expect(loaded.totalSavedTokens).toBe(42);
  });

  it('handles ensureDir errors gracefully', () => {
    const origDir = process.env.LOGSTRIP_TELEMETRY_DIR;
    // ensureDir reads the env var at runtime; point it at an impossible path
    // so mkdirSync throws and the catch block is covered.
    process.env.LOGSTRIP_TELEMETRY_DIR = '/dev/null/impossible';
    const store: TelemetryStore = { ...EMPTY_STORE };
    // saveTelemetry calls ensureDir internally; it should not throw
    expect(() => saveTelemetry(store)).not.toThrow();
    process.env.LOGSTRIP_TELEMETRY_DIR = origDir;
  });
});

describe('recordTelemetry', () => {
  it('appends an entry and updates aggregate counters', () => {
    const store = recordTelemetry(SAMPLE_RESULT);
    expect(store.totalRuns).toBe(1);
    expect(store.totalInputTokens).toBe(650);
    expect(store.totalSavedTokens).toBe(520);
    expect(store.entries.length).toBe(1);
    expect(store.entries[0].savingsPercent).toBe(80);
    expect(store.lastRun).toBeTruthy();
  });

  it('accumulates across multiple calls', () => {
    recordTelemetry(SAMPLE_RESULT);
    const store = recordTelemetry(SAMPLE_RESULT);
    expect(store.totalRuns).toBe(2);
    expect(store.totalSavedTokens).toBe(1040);
    expect(store.entries.length).toBe(2);
  });

  it('trims entries beyond MAX_ENTRIES', () => {
    for (let i = 0; i < 1010; i++) {
      recordTelemetry({ ...SAMPLE_RESULT, savedTokens: i, savingsPercent: 50 });
    }
    const store = loadTelemetry();
    expect(store.entries.length).toBeLessThanOrEqual(1000);
  });

  it('preserves detectedSources in entries', () => {
    const resultWithSources = {
      ...SAMPLE_RESULT,
      detectedSources: ['npm', 'typescript'] as const,
    };
    const store = recordTelemetry(resultWithSources);
    expect(store.entries[0].detectedSources).toEqual(['npm', 'typescript']);
  });
});

describe('formatTelemetrySummary', () => {
  it('formats an empty store', () => {
    const text = formatTelemetrySummary(EMPTY_STORE);
    expect(text).toContain('total runs       : 0');
    expect(text).toContain('last run         : never');
    expect(text).not.toContain('Last');
  });

  it('formats a store with entries', () => {
    const store = recordTelemetry(SAMPLE_RESULT);
    const text = formatTelemetrySummary(store);
    expect(text).toContain('total runs       : 1');
    expect(text).toContain('average savings');
    expect(text).toContain('Last 1 runs');
  });

  it('computes average savings correctly', () => {
    const store: TelemetryStore = {
      version: 1,
      totalRuns: 2,
      totalInputTokens: 1000,
      totalOutputTokens: 200,
      totalSavedTokens: 800,
      lastRun: '2026-01-01T00:00:00.000Z',
      entries: [],
    };
    const text = formatTelemetrySummary(store);
    expect(text).toContain('average savings  : 80.00%');
  });

  it('handles zero input tokens without NaN', () => {
    const text = formatTelemetrySummary(EMPTY_STORE);
    expect(text).toContain('average savings  : 0.00%');
  });

  it('limits shown entries to at most 5', () => {
    for (let i = 0; i < 7; i++) {
      recordTelemetry(SAMPLE_RESULT);
    }
    const store = loadTelemetry();
    const text = formatTelemetrySummary(store);
    expect(text).toContain('Last 5 runs');
  });
});
