"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogStripError = exports.saveTelemetry = exports.recordTelemetry = exports.loadTelemetry = exports.formatTelemetrySummary = exports.resolveConfigPath = exports.parseLogStripConfig = exports.LOG_SOURCE_SIGNATURES = exports.KNOWN_LOG_SOURCES = exports.shouldKeepLine = exports.scoreLineRelevance = exports.looksLikeDiagnosticLine = exports.isProgressBarLine = exports.isCiNoiseLine = exports.isInternalStackTraceLine = exports.isAccessLogNoiseLine = exports.estimateTokens = exports.sanitizeLine = exports.isContinuationLine = exports.detectLogSources = exports.createRepeatSignature = exports.TFIDF_REPEAT_THRESHOLD = exports.TFIDF_PENALTY = exports.TFIDF_MAP_LIMIT = exports.SCORE_KEEP_THRESHOLD = exports.MAX_REPEAT_DELTA_VALUES = exports.INTERNAL_STACK_MARKER = exports.CONTEXT_WINDOW_BEFORE = exports.CONTEXT_WINDOW_AFTER = exports.parseAggressiveness = exports.detectFormat = exports.passesSeverityFilter = exports.parseSeverityLevel = exports.inferSeverity = void 0;
exports.buildMergedConfig = buildMergedConfig;
exports.processLogStream = processLogStream;
exports.processLogFile = processLogFile;
exports.processLogFiles = processLogFiles;
exports.processLogString = processLogString;
exports.createLogStripTransform = createLogStripTransform;
exports.explainLogLine = explainLogLine;
exports.pathsReferToSameFile = pathsReferToSameFile;
exports.processLogStreamWithTimeout = processLogStreamWithTimeout;
const node_events_1 = require("node:events");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_readline_1 = require("node:readline");
const node_stream_1 = require("node:stream");
const promises_1 = require("node:stream/promises");
const logstrip_config_js_1 = require("./logstrip-config.js");
const levels_js_1 = require("./aggressiveness/levels.js");
const dynamic_js_1 = require("./aggressiveness/dynamic.js");
const constants_js_1 = require("./constants.js");
const repeat_grouper_js_1 = require("./dedupe/repeat-grouper.js");
const source_detector_js_1 = require("./detection/source-detector.js");
const multiline_buffer_js_1 = require("./multiline/multiline-buffer.js");
const format_detector_js_1 = require("./formats/format-detector.js");
const sanitize_line_js_1 = require("./sanitize/sanitize-line.js");
const severity_filter_js_1 = require("./severity/severity-filter.js");
const relevance_score_js_1 = require("./scoring/relevance-score.js");
const catalog_js_1 = require("./sources/catalog.js");
var severity_filter_js_2 = require("./severity/severity-filter.js");
Object.defineProperty(exports, "inferSeverity", { enumerable: true, get: function () { return severity_filter_js_2.inferSeverity; } });
Object.defineProperty(exports, "parseSeverityLevel", { enumerable: true, get: function () { return severity_filter_js_2.parseSeverityLevel; } });
Object.defineProperty(exports, "passesSeverityFilter", { enumerable: true, get: function () { return severity_filter_js_2.passesSeverityFilter; } });
var format_detector_js_2 = require("./formats/format-detector.js");
Object.defineProperty(exports, "detectFormat", { enumerable: true, get: function () { return format_detector_js_2.detectFormat; } });
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
var multiline_buffer_js_2 = require("./multiline/multiline-buffer.js");
Object.defineProperty(exports, "isContinuationLine", { enumerable: true, get: function () { return multiline_buffer_js_2.isContinuationLine; } });
var sanitize_line_js_2 = require("./sanitize/sanitize-line.js");
Object.defineProperty(exports, "sanitizeLine", { enumerable: true, get: function () { return sanitize_line_js_2.sanitizeLine; } });
var relevance_score_js_2 = require("./scoring/relevance-score.js");
Object.defineProperty(exports, "estimateTokens", { enumerable: true, get: function () { return relevance_score_js_2.estimateTokens; } });
Object.defineProperty(exports, "isAccessLogNoiseLine", { enumerable: true, get: function () { return relevance_score_js_2.isAccessLogNoiseLine; } });
Object.defineProperty(exports, "isInternalStackTraceLine", { enumerable: true, get: function () { return relevance_score_js_2.isInternalStackTraceLine; } });
Object.defineProperty(exports, "isCiNoiseLine", { enumerable: true, get: function () { return relevance_score_js_2.isCiNoiseLine; } });
Object.defineProperty(exports, "isProgressBarLine", { enumerable: true, get: function () { return relevance_score_js_2.isProgressBarLine; } });
Object.defineProperty(exports, "looksLikeDiagnosticLine", { enumerable: true, get: function () { return relevance_score_js_2.looksLikeDiagnosticLine; } });
Object.defineProperty(exports, "scoreLineRelevance", { enumerable: true, get: function () { return relevance_score_js_2.scoreLineRelevance; } });
Object.defineProperty(exports, "shouldKeepLine", { enumerable: true, get: function () { return relevance_score_js_2.shouldKeepLine; } });
var catalog_js_2 = require("./sources/catalog.js");
Object.defineProperty(exports, "KNOWN_LOG_SOURCES", { enumerable: true, get: function () { return catalog_js_2.KNOWN_LOG_SOURCES; } });
Object.defineProperty(exports, "LOG_SOURCE_SIGNATURES", { enumerable: true, get: function () { return catalog_js_2.LOG_SOURCE_SIGNATURES; } });
var logstrip_config_js_2 = require("./logstrip-config.js");
Object.defineProperty(exports, "parseLogStripConfig", { enumerable: true, get: function () { return logstrip_config_js_2.parseLogStripConfig; } });
Object.defineProperty(exports, "resolveConfigPath", { enumerable: true, get: function () { return logstrip_config_js_2.resolveConfigPath; } });
var telemetry_store_1 = require("./telemetry/telemetry-store");
Object.defineProperty(exports, "formatTelemetrySummary", { enumerable: true, get: function () { return telemetry_store_1.formatTelemetrySummary; } });
Object.defineProperty(exports, "loadTelemetry", { enumerable: true, get: function () { return telemetry_store_1.loadTelemetry; } });
Object.defineProperty(exports, "recordTelemetry", { enumerable: true, get: function () { return telemetry_store_1.recordTelemetry; } });
Object.defineProperty(exports, "saveTelemetry", { enumerable: true, get: function () { return telemetry_store_1.saveTelemetry; } });
class LogStripError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'LogStripError';
        this.code = code;
    }
}
exports.LogStripError = LogStripError;
// ---- Multiline-aware line reader ----
async function* readLogicalLines(lines, multilineMode) {
    if (multilineMode === 'off') {
        yield* lines;
        return;
    }
    const ctx = (0, multiline_buffer_js_1.createContinuationContext)(multilineMode);
    let buffer = [];
    for await (const line of lines) {
        if (buffer.length > 0 && (0, multiline_buffer_js_1.isContinuationLine)(line, ctx)) {
            buffer.push(line);
            ctx.groupLineCount += 1;
            ctx.groupByteCount += Buffer.byteLength(line, 'utf8');
            continue;
        }
        if (buffer.length > 0) {
            yield buffer.join('\n');
        }
        ctx.previousLine = line;
        ctx.groupLineCount = 1;
        ctx.groupByteCount = Buffer.byteLength(line, 'utf8');
        buffer = [line];
    }
    if (buffer.length > 0) {
        yield buffer.join('\n');
    }
}
function buildMergedConfig(options = {}) {
    const fileConfig = (0, logstrip_config_js_1.loadLogStripConfig)(options.configPath);
    const config = mergeCustomConfigs(fileConfig, options.config);
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
function mergeCustomConfigs(base, override) {
    if (override === undefined) {
        return base;
    }
    return {
        sources: [...base.sources, ...override.sources],
        diagnosticPatterns: [
            ...base.diagnosticPatterns,
            ...override.diagnosticPatterns,
        ],
        ignorePatterns: [...base.ignorePatterns, ...override.ignorePatterns],
        sanitizePatterns: [...base.sanitizePatterns, ...override.sanitizePatterns],
        internalStackPatterns: [
            ...base.internalStackPatterns,
            ...override.internalStackPatterns,
        ],
    };
}
async function processLogStream(input, output, options = {}) {
    if (options.timeoutMs !== undefined) {
        const { timeoutMs, ...streamOptions } = options;
        return processLogStreamWithTimeout(input, output, streamOptions, timeoutMs);
    }
    throwIfAborted(options.signal);
    const requestedAggressiveness = (0, levels_js_1.parseAggressiveness)(options.aggressiveness);
    const dynamicAggressiveness = (0, dynamic_js_1.createDynamicAggressivenessState)(requestedAggressiveness);
    const merged = buildMergedConfig(options);
    const multilineMode = options.multiline ?? 'off';
    const severityLevel = options.severity;
    const maxLineLength = Math.max(1, Math.floor(options.maxLineLength ?? 100_000));
    const includePattern = options.include;
    const excludePattern = options.exclude;
    const sampleSize = options.sampleSize;
    const contextWindowBefore = Math.max(0, Math.floor(options.contextBefore ?? constants_js_1.CONTEXT_WINDOW_BEFORE));
    const contextWindowAfter = Math.max(0, Math.floor(options.contextAfter ?? constants_js_1.CONTEXT_WINDOW_AFTER));
    const dedupeEnabled = options.dedupe !== false && options.outputFormat !== 'jsonl-preserve';
    const tokenEstimator = options.tokenEstimator;
    let inputTokensFromEstimator = 0;
    let outputTokensFromEstimator = 0;
    // Compile custom patterns once per stream
    const customDiagnosticRegexes = merged.diagnosticPatterns.map((p) => compileConfigRegex(p, 'u'));
    const customIgnoreRegexes = merged.ignorePatterns.map((p) => compileConfigRegex(p, 'u'));
    const customInternalStackRegexes = merged.internalStackPatterns.map((p) => compileConfigRegex(p, 'u'));
    const customSanitizeRules = merged.sanitizePatterns.map((r) => ({ regex: compileConfigRegex(r.pattern, r.flags ?? 'gu'), replacement: r.replacement }));
    const stats = createEmptyStats();
    const detectedSourceState = (0, source_detector_js_1.createSourceDetectionState)(merged.mergedSources);
    // TF-IDF: frequency map for sanitized lines (bounded for memory safety)
    const seenLines = new Map();
    // Context window: ring-buffer of soft-scored lines pending near-error promotion
    const contextBefore = [];
    let afterContextRemaining = 0;
    const rawLines = (0, node_readline_1.createInterface)({ input, crlfDelay: Infinity });
    const lines = readLogicalLines(rawLines, multilineMode);
    let previousGroup;
    let hidingInternalStack = false;
    let detectedFormat;
    let outputLineCount = 0;
    const recordDecision = (decision) => {
        options.onDecision?.(decision);
        (0, dynamic_js_1.recordLineDecision)(dynamicAggressiveness, decision);
    };
    const emitOutputLine = async (line) => {
        if (sampleSize !== undefined && outputLineCount >= sampleSize) {
            stats.droppedLines += line.split('\n').length;
            recordDecision({
                line,
                kept: false,
                dropped: true,
                hardKeep: false,
                repeated: false,
                reason: 'sample-limit',
            });
            return false;
        }
        outputLineCount += 1;
        if (tokenEstimator !== undefined) {
            outputTokensFromEstimator += estimateLineTokens(tokenEstimator, `${line}\n`);
        }
        await writeOutputLine(output, line, stats);
        return true;
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
        await emitOutputLine(line);
        previousGroup = undefined;
    };
    const emitCandidate = async (line) => {
        if (!dedupeEnabled) {
            await flushPreviousLine();
            await emitOutputLine(line);
            return;
        }
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
    const dropLine = (line, physicalLineCount, reason) => {
        stats.droppedLines += physicalLineCount;
        hidingInternalStack = false;
        recordDecision({
            line,
            kept: false,
            dropped: true,
            hardKeep: false,
            repeated: false,
            reason,
        });
    };
    for await (const rawLine of lines) {
        throwIfAborted(options.signal);
        let line = String(rawLine);
        const physicalLineCount = line.split('\n').length;
        (0, source_detector_js_1.collectDetectedSourceHits)(line, detectedSourceState);
        stats.inputLines += physicalLineCount;
        stats.inputWords += countWords(line);
        stats.inputBytes += Buffer.byteLength(`${line}\n`, 'utf8');
        if (tokenEstimator !== undefined) {
            inputTokensFromEstimator += estimateLineTokens(tokenEstimator, `${line}\n`);
        }
        if (detectedFormat === undefined && line.trim().length > 0) {
            const fmt = (0, format_detector_js_1.detectFormat)(line);
            if (fmt !== 'unknown')
                detectedFormat = fmt;
        }
        // Empty lines always dropped; don't disturb context state
        if (line.trim().length === 0) {
            stats.droppedLines += physicalLineCount;
            recordDecision({
                line,
                kept: false,
                dropped: true,
                hardKeep: false,
                repeated: false,
                reason: 'empty',
            });
            continue;
        }
        if (includePattern !== undefined && !testRegex(includePattern, line)) {
            dropLine(line, physicalLineCount, 'include-filter');
            continue;
        }
        if (excludePattern !== undefined && testRegex(excludePattern, line)) {
            dropLine(line, physicalLineCount, 'exclude-filter');
            continue;
        }
        if (line.length > maxLineLength) {
            stats.truncatedLines = Number(stats.truncatedLines) + physicalLineCount;
            line = `${line.slice(0, maxLineLength)}… [truncated]`;
        }
        // Custom ignore patterns (drop matching lines early)
        if (customIgnoreRegexes.some((r) => testRegex(r, line))) {
            dropLine(line, physicalLineCount, 'custom-ignore');
            continue;
        }
        // Severity filter (Phase 1.4): drop lines below threshold
        if (severityLevel !== undefined && !(0, severity_filter_js_1.passesSeverityFilter)(line, severityLevel)) {
            dropLine(line, physicalLineCount, 'severity');
            continue;
        }
        // CI noise: timestamp-only, K8s Normal, rate-limited
        if ((0, relevance_score_js_1.isCiNoiseLine)(line)) {
            dropLine(line, physicalLineCount, 'ci-noise');
            continue;
        }
        // CI noise: progress bars
        if ((0, relevance_score_js_1.isProgressBarLine)(line)) {
            dropLine(line, physicalLineCount, 'progress');
            continue;
        }
        // Access log noise: health checks, static assets, metrics with non-error status
        if ((0, relevance_score_js_1.isAccessLogNoiseLine)(line)) {
            dropLine(line, physicalLineCount, 'ci-noise');
            continue;
        }
        // Noise tags (INFO/DEBUG/TRACE/VERBOSE) are silently dropped without
        // disturbing afterContextRemaining so that sparse INFO lines between
        // errors do not close the context window prematurely.
        if ((0, relevance_score_js_1.isIgnoredLogLine)(line)) {
            dropLine(line, physicalLineCount, 'ignored-tag');
            continue;
        }
        let sanitized = (0, sanitize_line_js_1.sanitizeLine)(line);
        // Apply custom sanitize rules
        for (const rule of customSanitizeRules) {
            sanitized = sanitized.replace(rule.regex, rule.replacement);
        }
        // Internal stack-frame collapsing (priority over scoring)
        const isCustomInternalStack = customInternalStackRegexes.length > 0 &&
            customInternalStackRegexes.some((r) => testRegex(r, sanitized));
        if ((0, relevance_score_js_1.isInternalStackTraceLine)(sanitized) || isCustomInternalStack) {
            stats.hiddenInternalStackLines += physicalLineCount;
            if (!hidingInternalStack) {
                await flushContextBefore();
                await emitCandidate(constants_js_1.INTERNAL_STACK_MARKER);
                hidingInternalStack = true;
                afterContextRemaining = 0;
            }
            recordDecision({
                line,
                sanitizedLine: constants_js_1.INTERNAL_STACK_MARKER,
                kept: true,
                dropped: false,
                hardKeep: false,
                repeated: false,
                reason: 'internal-stack',
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
            if (testRegex(regex, sanitized)) {
                score += 50;
                break;
            }
        }
        score += (0, source_detector_js_1.scoreSourceDiagnosticBoost)(sanitized, detectedSourceState);
        if (score >= constants_js_1.SCORE_KEEP_THRESHOLD) {
            // Hard keep: flush buffered context, emit, open after-context window
            await flushContextBefore();
            await emitCandidate(sanitized);
            afterContextRemaining = contextWindowAfter;
            recordDecision({
                line,
                sanitizedLine: sanitized,
                kept: true,
                dropped: false,
                hardKeep: true,
                repeated: seenCount > 1,
                reason: 'hard-keep',
                score,
            });
        }
        else if (afterContextRemaining > 0) {
            // Inside after-context window: emit regardless of score
            await emitCandidate(sanitized);
            afterContextRemaining -= 1;
            recordDecision({
                line,
                sanitizedLine: sanitized,
                kept: true,
                dropped: false,
                hardKeep: false,
                repeated: seenCount > 1,
                reason: 'after-context',
                score,
            });
        }
        else if (score >= 0) {
            // Soft: buffer in context ring (oldest evicted & counted as dropped)
            let droppedBufferedLine = false;
            if (contextWindowBefore === 0) {
                stats.droppedLines += physicalLineCount;
                recordDecision({
                    line,
                    sanitizedLine: sanitized,
                    kept: false,
                    dropped: true,
                    hardKeep: false,
                    repeated: seenCount > 1,
                    reason: 'context-disabled',
                    score,
                });
                continue;
            }
            if (contextBefore.length >= contextWindowBefore) {
                contextBefore.shift();
                stats.droppedLines += 1;
                droppedBufferedLine = true;
            }
            contextBefore.push(sanitized);
            recordDecision({
                line,
                sanitizedLine: sanitized,
                kept: false,
                dropped: droppedBufferedLine,
                hardKeep: false,
                repeated: seenCount > 1,
                reason: 'context-buffered',
                score,
            });
        }
        else {
            // Hard drop (score < 0): negative TF-IDF or aggressive WARN suppression
            stats.droppedLines += physicalLineCount;
            afterContextRemaining = 0;
            recordDecision({
                line,
                sanitizedLine: sanitized,
                kept: false,
                dropped: true,
                hardKeep: false,
                repeated: seenCount > 1,
                reason: 'low-score',
                score,
            });
        }
    }
    // Context lines left without a triggering error are discarded
    stats.droppedLines += contextBefore.length;
    contextBefore.length = 0;
    await flushPreviousLine();
    const inputTokens = tokenEstimator === undefined
        ? (0, relevance_score_js_1.estimateTokens)(stats.inputWords)
        : inputTokensFromEstimator;
    const outputTokens = tokenEstimator === undefined
        ? (0, relevance_score_js_1.estimateTokens)(stats.outputWords)
        : outputTokensFromEstimator;
    const savedTokens = Math.max(inputTokens - outputTokens, 0);
    const savingsPercent = inputTokens === 0 ? 0 : Math.round((savedTokens / inputTokens) * 10000) / 100;
    return {
        stats,
        inputTokens,
        outputTokens,
        savedTokens,
        savingsPercent,
        detectedSources: (0, source_detector_js_1.rankDetectedSources)(detectedSourceState),
        detectedFormat,
    };
}
async function processLogFile(inputPath, outputPath, options = {}) {
    if (pathsReferToSameFile(inputPath, outputPath)) {
        throw new LogStripError('SAME_INPUT_OUTPUT', 'Input and output paths must be different; refusing to overwrite the input log');
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
async function processLogFiles(jobs, options = {}) {
    const results = [];
    for (const job of jobs) {
        results.push(await processLogFile(job.inputPath, job.outputPath, {
            ...options,
            ...job.options,
        }));
    }
    return results;
}
async function processLogString(inputText, options = {}) {
    const chunks = [];
    const output = new node_stream_1.Writable({
        write(chunk, _encoding, callback) {
            chunks.push(String(chunk));
            callback();
        },
    });
    const result = await processLogStream(node_stream_1.Readable.from([inputText]), output, options);
    return { ...result, output: chunks.join('') };
}
function createLogStripTransform(options = {}) {
    const input = new node_stream_1.PassThrough();
    let transform;
    let releaseBackpressure;
    const output = new node_stream_1.Writable({
        write(chunk, encoding, callback) {
            if (transform.push(chunk, encoding)) {
                callback();
                return;
            }
            releaseBackpressure = callback;
        },
    });
    const result = processLogStream(input, output, options);
    transform = new node_stream_1.Transform({
        highWaterMark: 1,
        transform(chunk, encoding, callback) {
            input.write(chunk, encoding, callback);
        },
        flush(callback) {
            input.end();
            result.then(() => callback(), callback);
        },
        read(size) {
            node_stream_1.Transform.prototype._read.call(this, size);
            const release = releaseBackpressure;
            releaseBackpressure = undefined;
            release?.();
        },
        destroy(error, callback) {
            input.destroy();
            output.destroy();
            callback(error);
        },
    });
    result.catch((error) => {
        transform.destroy(error);
    });
    return Object.assign(transform, { result });
}
function explainLogLine(line, options = {}) {
    const merged = buildMergedConfig(options);
    const includePattern = options.include;
    const excludePattern = options.exclude;
    const severityLevel = options.severity;
    if (line.trim().length === 0) {
        return createDecision(line, undefined, false, 'empty');
    }
    if (includePattern !== undefined && !testRegex(includePattern, line)) {
        return createDecision(line, undefined, false, 'include-filter');
    }
    if (excludePattern !== undefined && testRegex(excludePattern, line)) {
        return createDecision(line, undefined, false, 'exclude-filter');
    }
    const customIgnoreRegexes = merged.ignorePatterns.map((p) => compileConfigRegex(p, 'u'));
    if (customIgnoreRegexes.some((r) => testRegex(r, line))) {
        return createDecision(line, undefined, false, 'custom-ignore');
    }
    if (severityLevel !== undefined && !(0, severity_filter_js_1.passesSeverityFilter)(line, severityLevel)) {
        return createDecision(line, undefined, false, 'severity');
    }
    if ((0, relevance_score_js_1.isCiNoiseLine)(line)) {
        return createDecision(line, undefined, false, 'ci-noise');
    }
    if ((0, relevance_score_js_1.isProgressBarLine)(line)) {
        return createDecision(line, undefined, false, 'progress');
    }
    if ((0, relevance_score_js_1.isAccessLogNoiseLine)(line)) {
        return createDecision(line, undefined, false, 'ci-noise');
    }
    if ((0, relevance_score_js_1.isIgnoredLogLine)(line)) {
        return createDecision(line, undefined, false, 'ignored-tag');
    }
    let sanitized = (0, sanitize_line_js_1.sanitizeLine)(line);
    for (const rule of merged.sanitizePatterns) {
        sanitized = sanitized.replace(compileConfigRegex(rule.pattern, rule.flags ?? 'gu'), rule.replacement);
    }
    const customInternalStackRegexes = merged.internalStackPatterns.map((p) => compileConfigRegex(p, 'u'));
    const isCustomInternalStack = customInternalStackRegexes.length > 0 &&
        customInternalStackRegexes.some((r) => testRegex(r, sanitized));
    if ((0, relevance_score_js_1.isInternalStackTraceLine)(sanitized) || isCustomInternalStack) {
        return createDecision(line, constants_js_1.INTERNAL_STACK_MARKER, true, 'internal-stack');
    }
    let score = (0, relevance_score_js_1.scoreLineRelevance)(sanitized, requestedStaticAggressiveness(options.aggressiveness));
    const customDiagnosticRegexes = merged.diagnosticPatterns.map((p) => compileConfigRegex(p, 'u'));
    for (const regex of customDiagnosticRegexes) {
        if (testRegex(regex, sanitized)) {
            score += 50;
            break;
        }
    }
    if (score >= constants_js_1.SCORE_KEEP_THRESHOLD) {
        return createDecision(line, sanitized, true, 'hard-keep', score);
    }
    return createDecision(line, sanitized, false, 'low-score', score);
}
function pathsReferToSameFile(inputPath, outputPath) {
    return (node_path_1.default.resolve(inputPath).toLowerCase() ===
        node_path_1.default.resolve(outputPath).toLowerCase());
}
function compileConfigRegex(pattern, flags) {
    try {
        return new RegExp(pattern, flags);
    }
    catch (error) {
        throw new LogStripError('INVALID_CONFIG', `Invalid logstrip config regex "${pattern}": ${String(error)}`);
    }
}
function createDecision(line, sanitizedLine, kept, reason, score) {
    return {
        line,
        sanitizedLine,
        kept,
        dropped: !kept,
        hardKeep: kept && reason === 'hard-keep',
        repeated: false,
        reason,
        score,
    };
}
function estimateLineTokens(estimator, line) {
    return Math.max(0, Math.ceil(estimator(line)));
}
function requestedStaticAggressiveness(aggressiveness) {
    return (0, levels_js_1.toStaticAggressiveness)((0, levels_js_1.parseAggressiveness)(aggressiveness));
}
function testRegex(regex, line) {
    regex.lastIndex = 0;
    return regex.test(line);
}
function throwIfAborted(signal) {
    if (signal?.aborted === true) {
        throw new LogStripError('ABORTED', 'Processing aborted');
    }
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
        truncatedLines: 0,
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
// ---- Timeout wrapper ----
async function processLogStreamWithTimeout(input, output, options = {}, timeoutMs) {
    if (timeoutMs === undefined) {
        return processLogStream(input, output, options);
    }
    let rejectTimeout;
    const timeoutPromise = new Promise((_, reject) => {
        rejectTimeout = reject;
    });
    const timer = setTimeout(() => rejectTimeout(new LogStripError('TIMEOUT', 'Processing timed out')), timeoutMs);
    const { timeoutMs: _ignoredTimeoutMs, ...streamOptions } = options;
    try {
        return await Promise.race([
            processLogStream(input, output, streamOptions),
            timeoutPromise,
        ]);
    }
    catch (error) {
        if (error instanceof LogStripError && error.code === 'TIMEOUT') {
            input.destroy();
            return {
                stats: createEmptyStats(),
                inputTokens: 0,
                outputTokens: 0,
                savedTokens: 0,
                savingsPercent: 0,
                timedOut: true,
            };
        }
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
