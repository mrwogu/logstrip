"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTelemetry = loadTelemetry;
exports.saveTelemetry = saveTelemetry;
exports.recordTelemetry = recordTelemetry;
exports.formatTelemetrySummary = formatTelemetrySummary;
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const STORE_PATH = (0, node_path_1.join)(process.env.LOGSTRIP_TELEMETRY_DIR ?? (0, node_path_1.join)((0, node_os_1.homedir)(), '.logstrip'), 'telemetry.json');
const MAX_ENTRIES = 1000;
function ensureDir() {
    try {
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(process.env.LOGSTRIP_TELEMETRY_DIR ?? (0, node_path_1.join)((0, node_os_1.homedir)(), '.logstrip')), { recursive: true });
    }
    catch { }
}
function loadTelemetry() {
    try {
        return JSON.parse((0, node_fs_1.readFileSync)(STORE_PATH, 'utf8'));
    }
    catch {
        return { version: 1, totalRuns: 0, totalInputTokens: 0, totalOutputTokens: 0, totalSavedTokens: 0, lastRun: '', entries: [] };
    }
}
function saveTelemetry(store) {
    try {
        ensureDir();
        (0, node_fs_1.writeFileSync)(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
    }
    catch { }
}
function recordTelemetry(result) {
    const store = loadTelemetry();
    const entry = {
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
    if (store.entries.length > MAX_ENTRIES)
        store.entries = store.entries.slice(0, MAX_ENTRIES);
    store.totalRuns += 1;
    store.totalInputTokens += result.inputTokens;
    store.totalOutputTokens += result.outputTokens;
    store.totalSavedTokens += result.savedTokens;
    store.lastRun = entry.timestamp;
    saveTelemetry(store);
    return store;
}
function formatTelemetrySummary(store) {
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
