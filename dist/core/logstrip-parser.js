"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_SOURCE_SIGNATURES = exports.KNOWN_LOG_SOURCES = exports.shouldKeepLine = exports.scoreLineRelevance = exports.looksLikeDiagnosticLine = exports.isInternalStackTraceLine = exports.estimateTokens = exports.sanitizeLine = exports.detectLogSources = exports.createRepeatSignature = exports.TFIDF_REPEAT_THRESHOLD = exports.TFIDF_PENALTY = exports.TFIDF_MAP_LIMIT = exports.SCORE_KEEP_THRESHOLD = exports.MAX_REPEAT_DELTA_VALUES = exports.INTERNAL_STACK_MARKER = exports.CONTEXT_WINDOW_BEFORE = exports.CONTEXT_WINDOW_AFTER = exports.parseAggressiveness = void 0;
exports.buildMergedConfig = buildMergedConfig;
exports.processLogStream = processLogStream;
exports.processLogFile = processLogFile;
exports.pathsReferToSameFile = pathsReferToSameFile;
const node_events_1 = require("node:events");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_readline_1 = require("node:readline");
const promises_1 = require("node:stream/promises");
const logstrip_config_js_1 = require("./logstrip-config.js");
const levels_js_1 = require("./aggressiveness/levels.js");
const dynamic_js_1 = require("./aggressiveness/dynamic.js");
const constants_js_1 = require("./constants.js");
const repeat_grouper_js_1 = require("./dedupe/repeat-grouper.js");
const source_detector_js_1 = require("./detection/source-detector.js");
const sanitize_line_js_1 = require("./sanitize/sanitize-line.js");
const relevance_score_js_1 = require("./scoring/relevance-score.js");
const catalog_js_1 = require("./sources/catalog.js");
var levels_js_2 = require("./aggressiveness/levels.js");
Object.defineProperty(exports, "parseAggressiveness", { enumerable: true, get: function () { return levels_js_2.parseAggressiveness; } });
var constants_js_2 = require("./constants.js");
Object.defineProperty(exports, "CONTEXT_WINDOW_AFTER", { enumerable: true, get: function () { return constants_js_2.CONTEXT_WINDOW_AFTER; } });
Object.defineProperty(exports, "CONTEXT_WINDOW_BEFORE", { enumerable: true, get: function () { return constants_js_2.CONTEXT_WINDOW_BEFORE; } });
Object.defineProperty(exports, "INTERNAL_STACK_MARKER", { enumerable: true, get: function () { return constants_js_2.INTERNAL_STACK_MARKER; } });
Object.defineProperty(exports, "MAX_REPEAT_DELTA_VALUES", { enumerable: true, get: function () { return constants_js_2.MAX_REPEAT_DELTA_VALUES; } });
Object.defineProperty(exports, "SCORE_KEEP_THRESHOLD", { enumerable: true, get: function () { return constants_js_2.SCORE_KEEP_THRESHOLD; } });
Object.defineProperty(exports, "TFIDF_MAP_LIMIT", { enumerable: true, get: function () { return constants_js_2.TFIDF_MAP_LIMIT; } });
Object.defineProperty(exports, "TFIDF_PENALTY", { enumerable: true, get: function () { return constants_js_2.TFIDF_PENALTY; } });
Object.defineProperty(exports, "TFIDF_REPEAT_THRESHOLD", { enumerable: true, get: function () { return constants_js_2.TFIDF_REPEAT_THRESHOLD; } });
var repeat_grouper_js_2 = require("./dedupe/repeat-grouper.js");
Object.defineProperty(exports, "createRepeatSignature", { enumerable: true, get: function () { return repeat_grouper_js_2.createRepeatSignature; } });
var source_detector_js_2 = require("./detection/source-detector.js");
Object.defineProperty(exports, "detectLogSources", { enumerable: true, get: function () { return source_detector_js_2.detectLogSources; } });
var sanitize_line_js_2 = require("./sanitize/sanitize-line.js");
Object.defineProperty(exports, "sanitizeLine", { enumerable: true, get: function () { return sanitize_line_js_2.sanitizeLine; } });
var relevance_score_js_2 = require("./scoring/relevance-score.js");
Object.defineProperty(exports, "estimateTokens", { enumerable: true, get: function () { return relevance_score_js_2.estimateTokens; } });
Object.defineProperty(exports, "isInternalStackTraceLine", { enumerable: true, get: function () { return relevance_score_js_2.isInternalStackTraceLine; } });
Object.defineProperty(exports, "looksLikeDiagnosticLine", { enumerable: true, get: function () { return relevance_score_js_2.looksLikeDiagnosticLine; } });
Object.defineProperty(exports, "scoreLineRelevance", { enumerable: true, get: function () { return relevance_score_js_2.scoreLineRelevance; } });
Object.defineProperty(exports, "shouldKeepLine", { enumerable: true, get: function () { return relevance_score_js_2.shouldKeepLine; } });
var catalog_js_2 = require("./sources/catalog.js");
Object.defineProperty(exports, "KNOWN_LOG_SOURCES", { enumerable: true, get: function () { return catalog_js_2.KNOWN_LOG_SOURCES; } });
Object.defineProperty(exports, "LOG_SOURCE_SIGNATURES", { enumerable: true, get: function () { return catalog_js_2.LOG_SOURCE_SIGNATURES; } });
function buildMergedConfig(options = {}) {
    const config = (0, logstrip_config_js_1.loadLogStripConfig)(options.configPath);
    const mergedSources = [
        ...catalog_js_1.LOG_SOURCE_SIGNATURES,
    ];
    for (const sig of config.sources) {
        const existing = mergedSources.find(([name]) => name === sig.name);
        if (existing !== undefined) {
            const merged = [...new Set([...existing[1], ...sig.markers])];
            const idx = mergedSources.indexOf(existing);
            mergedSources[idx] = [sig.name, merged];
        }
        else {
            mergedSources.push([sig.name, sig.markers]);
        }
    }
    return { ...config, mergedSources };
}
async function processLogStream(input, output, options = {}) {
    const requestedAggressiveness = (0, levels_js_1.parseAggressiveness)(options.aggressiveness);
    const dynamicAggressiveness = (0, dynamic_js_1.createDynamicAggressivenessState)(requestedAggressiveness);
    const merged = buildMergedConfig(options);
    // Compile custom patterns once per stream
    const customDiagnosticRegexes = merged.diagnosticPatterns.map((p) => new RegExp(p, 'u'));
    const customIgnoreRegexes = merged.ignorePatterns.map((p) => new RegExp(p, 'u'));
    const customInternalStackRegexes = merged.internalStackPatterns.map((p) => new RegExp(p, 'u'));
    const customSanitizeRules = merged.sanitizePatterns.map((r) => ({ regex: new RegExp(r.pattern, r.flags ?? 'gu'), replacement: r.replacement }));
    const stats = createEmptyStats();
    const detectedSourceState = (0, source_detector_js_1.createSourceDetectionState)(merged.mergedSources);
    // TF-IDF: frequency map for sanitized lines (bounded for memory safety)
    const seenLines = new Map();
    // Context window: ring-buffer of soft-scored lines pending near-error promotion
    const contextBefore = [];
    let afterContextRemaining = 0;
    const lines = (0, node_readline_1.createInterface)({ input, crlfDelay: Infinity });
    let previousGroup;
    let hidingInternalStack = false;
    const recordDecision = (decision) => {
        (0, dynamic_js_1.recordLineDecision)(dynamicAggressiveness, decision);
    };
    const flushPreviousLine = async () => {
        if (previousGroup === undefined) {
            return;
        }
        const line = previousGroup.count > 1
            ? `[x${previousGroup.count}] ${(0, repeat_grouper_js_1.renderRepeatGroup)(previousGroup)}`
            : previousGroup.firstLine;
        if (previousGroup.count > 1) {
            stats.duplicateLines += previousGroup.count - 1;
        }
        await writeOutputLine(output, line, stats);
        previousGroup = undefined;
    };
    const emitCandidate = async (line) => {
        const signature = (0, repeat_grouper_js_1.createRepeatSignature)(line);
        if (previousGroup?.signature === signature) {
            (0, repeat_grouper_js_1.addRepeatGroupLine)(previousGroup, line);
            return;
        }
        await flushPreviousLine();
        previousGroup = (0, repeat_grouper_js_1.createRepeatGroup)(line);
    };
    // Flush buffered context lines (retroactive promotion near an error)
    const flushContextBefore = async () => {
        for (const buffered of contextBefore) {
            await emitCandidate(buffered);
        }
        contextBefore.length = 0;
    };
    for await (const rawLine of lines) {
        const line = String(rawLine);
        (0, source_detector_js_1.collectDetectedSourceHits)(line, detectedSourceState);
        stats.inputLines += 1;
        stats.inputWords += countWords(line);
        stats.inputBytes += Buffer.byteLength(`${line}\n`, 'utf8');
        // Empty lines always dropped; don't disturb context state
        if (line.trim().length === 0) {
            stats.droppedLines += 1;
            recordDecision({
                kept: false,
                dropped: true,
                hardKeep: false,
                repeated: false,
            });
            continue;
        }
        // Custom ignore patterns (drop matching lines early)
        if (customIgnoreRegexes.some((r) => r.test(line))) {
            stats.droppedLines += 1;
            hidingInternalStack = false;
            recordDecision({
                kept: false,
                dropped: true,
                hardKeep: false,
                repeated: false,
            });
            continue;
        }
        // Noise tags (INFO/DEBUG/TRACE/VERBOSE) are silently dropped without
        // disturbing afterContextRemaining so that sparse INFO lines between
        // errors do not close the context window prematurely.
        if ((0, relevance_score_js_1.isIgnoredLogLine)(line)) {
            stats.droppedLines += 1;
            hidingInternalStack = false;
            recordDecision({
                kept: false,
                dropped: true,
                hardKeep: false,
                repeated: false,
            });
            continue;
        }
        let sanitized = (0, sanitize_line_js_1.sanitizeLine)(line);
        // Apply custom sanitize rules
        for (const rule of customSanitizeRules) {
            sanitized = sanitized.replace(rule.regex, rule.replacement);
        }
        // Internal stack-frame collapsing (priority over scoring)
        const isCustomInternalStack = customInternalStackRegexes.length > 0 &&
            customInternalStackRegexes.some((r) => r.test(sanitized));
        if ((0, relevance_score_js_1.isInternalStackTraceLine)(sanitized) || isCustomInternalStack) {
            stats.hiddenInternalStackLines += 1;
            if (!hidingInternalStack) {
                await flushContextBefore();
                await emitCandidate(constants_js_1.INTERNAL_STACK_MARKER);
                hidingInternalStack = true;
                afterContextRemaining = 0;
            }
            recordDecision({
                kept: true,
                dropped: false,
                hardKeep: false,
                repeated: false,
            });
            continue;
        }
        hidingInternalStack = false;
        // TF-IDF: track how many times this sanitized form has appeared.
        let seenCount = (seenLines.get(sanitized) ?? 0) + 1;
        if (seenCount === 1 && seenLines.size >= constants_js_1.TFIDF_MAP_LIMIT) {
            seenLines.clear();
            seenCount = 1;
        }
        seenLines.set(sanitized, seenCount);
        // Score the sanitized line (built-in + custom diagnostic patterns)
        const effectiveAggressiveness = dynamicAggressiveness.effective;
        let score = (0, relevance_score_js_1.scoreLineRelevance)(sanitized, effectiveAggressiveness, seenCount);
        // Custom diagnostic patterns contribute +50 per match (same as built-in DIAGNOSTIC_PATTERN)
        for (const regex of customDiagnosticRegexes) {
            if (regex.test(sanitized)) {
                score += 50;
                break;
            }
        }
        score += (0, source_detector_js_1.scoreSourceDiagnosticBoost)(sanitized, detectedSourceState);
        if (score >= constants_js_1.SCORE_KEEP_THRESHOLD) {
            // Hard keep: flush buffered context, emit, open after-context window
            await flushContextBefore();
            await emitCandidate(sanitized);
            afterContextRemaining = constants_js_1.CONTEXT_WINDOW_AFTER;
            recordDecision({
                kept: true,
                dropped: false,
                hardKeep: true,
                repeated: seenCount > 1,
            });
        }
        else if (afterContextRemaining > 0) {
            // Inside after-context window: emit regardless of score
            await emitCandidate(sanitized);
            afterContextRemaining -= 1;
            recordDecision({
                kept: true,
                dropped: false,
                hardKeep: false,
                repeated: seenCount > 1,
            });
        }
        else if (score >= 0) {
            // Soft: buffer in context ring (oldest evicted & counted as dropped)
            let droppedBufferedLine = false;
            if (contextBefore.length >= constants_js_1.CONTEXT_WINDOW_BEFORE) {
                contextBefore.shift();
                stats.droppedLines += 1;
                droppedBufferedLine = true;
            }
            contextBefore.push(sanitized);
            recordDecision({
                kept: false,
                dropped: droppedBufferedLine,
                hardKeep: false,
                repeated: seenCount > 1,
            });
        }
        else {
            // Hard drop (score < 0): negative TF-IDF or aggressive WARN suppression
            stats.droppedLines += 1;
            afterContextRemaining = 0;
            recordDecision({
                kept: false,
                dropped: true,
                hardKeep: false,
                repeated: seenCount > 1,
            });
        }
    }
    // Context lines left without a triggering error are discarded
    stats.droppedLines += contextBefore.length;
    contextBefore.length = 0;
    await flushPreviousLine();
    const inputTokens = (0, relevance_score_js_1.estimateTokens)(stats.inputWords);
    const outputTokens = (0, relevance_score_js_1.estimateTokens)(stats.outputWords);
    const savedTokens = Math.max(inputTokens - outputTokens, 0);
    const savingsPercent = inputTokens === 0 ? 0 : Math.round((savedTokens / inputTokens) * 10000) / 100;
    return {
        stats,
        inputTokens,
        outputTokens,
        savedTokens,
        savingsPercent,
        detectedSources: (0, source_detector_js_1.rankDetectedSources)(detectedSourceState),
    };
}
async function processLogFile(inputPath, outputPath, options = {}) {
    if (pathsReferToSameFile(inputPath, outputPath)) {
        throw new Error('Input and output paths must be different; refusing to overwrite the input log');
    }
    const input = (0, node_fs_1.createReadStream)(inputPath, { encoding: 'utf8' });
    const output = (0, node_fs_1.createWriteStream)(outputPath, { encoding: 'utf8' });
    try {
        const result = await processLogStream(input, output, options);
        output.end();
        await (0, promises_1.finished)(output);
        return { ...result, outputPath };
    }
    catch (error) {
        input.destroy();
        output.destroy();
        throw error;
    }
}
function pathsReferToSameFile(inputPath, outputPath) {
    return (node_path_1.default.resolve(inputPath).toLowerCase() ===
        node_path_1.default.resolve(outputPath).toLowerCase());
}
function createEmptyStats() {
    return {
        inputLines: 0,
        outputLines: 0,
        inputWords: 0,
        outputWords: 0,
        inputBytes: 0,
        outputBytes: 0,
        droppedLines: 0,
        duplicateLines: 0,
        hiddenInternalStackLines: 0,
    };
}
function countWords(line) {
    return line.trim().match(/\S+/gu)?.length ?? 0;
}
async function writeOutputLine(output, line, stats) {
    const rendered = `${line}\n`;
    stats.outputLines += 1;
    stats.outputWords += countWords(line);
    stats.outputBytes += Buffer.byteLength(rendered, 'utf8');
    if (!output.write(rendered)) {
        await (0, node_events_1.once)(output, 'drain');
    }
}
