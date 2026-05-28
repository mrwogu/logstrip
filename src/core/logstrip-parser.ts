import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { PassThrough, Readable, Transform, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import {
  type LogStripCustomConfig,
  type LogStripSourceSignature,
  loadLogStripConfig,
} from './logstrip-config.js';
import { parseAggressiveness, toStaticAggressiveness } from './aggressiveness/levels.js';
import {
  createDynamicAggressivenessState,
  recordLineDecision,
} from './aggressiveness/dynamic.js';
import {
  CONTEXT_WINDOW_AFTER,
  CONTEXT_WINDOW_BEFORE,
  INTERNAL_STACK_MARKER,
  SCORE_KEEP_THRESHOLD,
  TFIDF_MAP_LIMIT,
  TFIDF_PENALTY,
  TFIDF_REPEAT_THRESHOLD,
} from './constants.js';
import {
  addRepeatGroupLine,
  createRepeatGroup,
  createRepeatSignature,
  renderRepeatGroup,
  type RepeatGroup,
} from './dedupe/repeat-grouper.js';
import {
  collectDetectedSourceHits,
  createSourceDetectionState,
  rankDetectedSources,
  scoreSourceDiagnosticBoost,
} from './detection/source-detector.js';
import {
  type MultilineMode,
  createContinuationContext,
  isContinuationLine,
} from './multiline/multiline-buffer.js';
import { detectFormat } from './formats/format-detector.js';
import { sanitizeLine } from './sanitize/sanitize-line.js';
import { passesSeverityFilter } from './severity/severity-filter.js';
import type { SeverityLevel } from './severity/severity-filter.js';
import {
  estimateTokens,
  isAccessLogNoiseLine,
  isCiNoiseLine,
  isIgnoredLogLine,
  isInternalStackTraceLine,
  isProgressBarLine,
  scoreLineRelevance,
} from './scoring/relevance-score.js';
import { LOG_SOURCE_SIGNATURES } from './sources/catalog.js';
import type {
  Aggressiveness,
  LogStripDecisionReason,
  LogStripErrorCode,
  LogStripFileJob,
  LogStripLineDecision,
  LogStripOptions,
  LogStripResult,
  LogStripStats,
  LogStripStringResult,
  StaticAggressiveness,
} from './types.js';

export { inferSeverity, parseSeverityLevel, passesSeverityFilter } from './severity/severity-filter.js';
export type { SeverityLevel } from './severity/severity-filter.js';
export { detectFormat } from './formats/format-detector.js';
export { parseAggressiveness } from './aggressiveness/levels.js';
export {
  CONTEXT_WINDOW_AFTER,
  CONTEXT_WINDOW_BEFORE,
  INTERNAL_STACK_MARKER,
  MAX_REPEAT_DELTA_VALUES,
  SCORE_KEEP_THRESHOLD,
  TFIDF_MAP_LIMIT,
  TFIDF_PENALTY,
  TFIDF_REPEAT_THRESHOLD,
} from './constants.js';
export { createRepeatSignature } from './dedupe/repeat-grouper.js';
export { detectLogSources } from './detection/source-detector.js';
export {
  type MultilineMode,
  isContinuationLine,
} from './multiline/multiline-buffer.js';
export { sanitizeLine } from './sanitize/sanitize-line.js';
export {
  estimateTokens,
  isAccessLogNoiseLine,
  isInternalStackTraceLine,
  isCiNoiseLine,
  isProgressBarLine,
  looksLikeDiagnosticLine,
  scoreLineRelevance,
  shouldKeepLine,
} from './scoring/relevance-score.js';
export { KNOWN_LOG_SOURCES, LOG_SOURCE_SIGNATURES } from './sources/catalog.js';
export type {
  Aggressiveness,
  LogStripDecisionReason,
  LogStripErrorCode,
  LogStripFileJob,
  LogStripLineDecision,
  LogStripOptions,
  LogStripResult,
  LogStripStats,
  LogStripStringResult,
  StaticAggressiveness,
} from './types.js';
export {
  parseLogStripConfig,
  resolveConfigPath,
} from './logstrip-config.js';
export type {
  LogStripCustomConfig,
  LogStripSourceSignature,
  SanitizeRule,
} from './logstrip-config.js';
export {
  type TelemetryEntry,
  type TelemetryStore,
  formatTelemetrySummary,
  loadTelemetry,
  recordTelemetry,
  saveTelemetry,
} from './telemetry/telemetry-store';

export class LogStripError extends Error {
  public readonly code: LogStripErrorCode;

  constructor(code: LogStripErrorCode, message: string) {
    super(message);
    this.name = 'LogStripError';
    this.code = code;
  }
}

// ---- Multiline-aware line reader ----

async function* readLogicalLines(
  lines: AsyncIterable<string>,
  multilineMode: MultilineMode,
): AsyncIterable<string> {
  if (multilineMode === 'off') {
    yield* lines;
    return;
  }

  const ctx = createContinuationContext(multilineMode);
  let buffer: string[] = [];

  for await (const line of lines) {
    if (buffer.length > 0 && isContinuationLine(line, ctx)) {
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

export function buildMergedConfig(
  options: LogStripOptions = {},
): LogStripCustomConfig & { mergedSources: readonly (readonly [string, readonly string[]])[] } {
  const fileConfig = loadLogStripConfig(options.configPath);
  const config = mergeCustomConfigs(fileConfig, options.config);
  const mergedSources: (readonly [string, readonly string[]])[] = [
    ...LOG_SOURCE_SIGNATURES,
  ];

  for (const sig of config.sources) {
    const existing = mergedSources.find(([name]) => name === sig.name);
    if (existing !== undefined) {
      const merged = [...new Set([...existing[1], ...sig.markers])];
      const idx = mergedSources.indexOf(existing);
      mergedSources[idx] = [sig.name, merged] as const;
    } else {
      mergedSources.push([sig.name, sig.markers] as const);
    }
  }

  return { ...config, mergedSources };
}

function mergeCustomConfigs(
  base: LogStripCustomConfig,
  override?: LogStripCustomConfig,
): LogStripCustomConfig {
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

export async function processLogStream(
  input: NodeJS.ReadableStream,
  output: Writable,
  options: LogStripOptions = {},
): Promise<LogStripResult> {
  if (options.timeoutMs !== undefined) {
    const { timeoutMs, ...streamOptions } = options;
    return processLogStreamWithTimeout(input, output, streamOptions, timeoutMs);
  }

  throwIfAborted(options.signal);

  const requestedAggressiveness = parseAggressiveness(options.aggressiveness);
  const dynamicAggressiveness =
    createDynamicAggressivenessState(requestedAggressiveness);
  const merged = buildMergedConfig(options);
  const multilineMode = options.multiline ?? 'off';
  const severityLevel: SeverityLevel | undefined = options.severity;
  const maxLineLength = Math.max(1, Math.floor(options.maxLineLength ?? 100_000));
  const includePattern = options.include;
  const excludePattern = options.exclude;
  const sampleSize = options.sampleSize;
  const contextWindowBefore = Math.max(
    0,
    Math.floor(options.contextBefore ?? CONTEXT_WINDOW_BEFORE),
  );
  const contextWindowAfter = Math.max(
    0,
    Math.floor(options.contextAfter ?? CONTEXT_WINDOW_AFTER),
  );
  const dedupeEnabled =
    options.dedupe !== false && options.outputFormat !== 'jsonl-preserve';
  const tokenEstimator = options.tokenEstimator;
  let inputTokensFromEstimator = 0;
  let outputTokensFromEstimator = 0;

  // Compile custom patterns once per stream
  const customDiagnosticRegexes = merged.diagnosticPatterns.map(
    (p) => compileConfigRegex(p, 'u'),
  );
  const customIgnoreRegexes = merged.ignorePatterns.map(
    (p) => compileConfigRegex(p, 'u'),
  );
  const customInternalStackRegexes = merged.internalStackPatterns.map(
    (p) => compileConfigRegex(p, 'u'),
  );
  const customSanitizeRules = merged.sanitizePatterns.map(
    (r) => ({ regex: compileConfigRegex(r.pattern, r.flags ?? 'gu'), replacement: r.replacement }),
  );

  const stats = createEmptyStats();
  const detectedSourceState = createSourceDetectionState(merged.mergedSources);

  // TF-IDF: frequency map for sanitized lines (bounded for memory safety)
  const seenLines = new Map<string, number>();

  // Context window: ring-buffer of soft-scored lines pending near-error promotion
  const contextBefore: string[] = [];
  let afterContextRemaining = 0;

  const rawLines = createInterface({ input, crlfDelay: Infinity });
  const lines = readLogicalLines(rawLines, multilineMode);
  let previousGroup: RepeatGroup | undefined;
  let hidingInternalStack = false;
  let detectedFormat: string | undefined;
  let outputLineCount = 0;

  const recordDecision = (decision: LogStripLineDecision): void => {
    options.onDecision?.(decision);
    recordLineDecision(dynamicAggressiveness, decision);
  };

  const emitOutputLine = async (line: string): Promise<boolean> => {
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

  const flushPreviousLine = async (): Promise<void> => {
    if (previousGroup === undefined) {
      return;
    }

    const line =
      previousGroup.count > 1
        ? `[x${previousGroup.count}] ${renderRepeatGroup(previousGroup)}`
        : previousGroup.firstLine;

    if (previousGroup.count > 1) {
      stats.duplicateLines += previousGroup.count - 1;
    }

    await emitOutputLine(line);
    previousGroup = undefined;
  };

  const emitCandidate = async (line: string): Promise<void> => {
    if (!dedupeEnabled) {
      await flushPreviousLine();
      await emitOutputLine(line);
      return;
    }

    const signature = createRepeatSignature(line);

    if (previousGroup?.signature === signature) {
      addRepeatGroupLine(previousGroup, line);
      return;
    }

    await flushPreviousLine();
    previousGroup = createRepeatGroup(line);
  };

  // Flush buffered context lines (retroactive promotion near an error)
  const flushContextBefore = async (): Promise<void> => {
    for (const buffered of contextBefore) {
      await emitCandidate(buffered);
    }

    contextBefore.length = 0;
  };

  const dropLine = (
    line: string,
    physicalLineCount: number,
    reason: LogStripDecisionReason,
  ): void => {
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
    collectDetectedSourceHits(line, detectedSourceState);
    stats.inputLines += physicalLineCount;
    stats.inputWords += countWords(line);
    stats.inputBytes += Buffer.byteLength(`${line}\n`, 'utf8');
    if (tokenEstimator !== undefined) {
      inputTokensFromEstimator += estimateLineTokens(tokenEstimator, `${line}\n`);
    }

    if (detectedFormat === undefined && line.trim().length > 0) {
      const fmt = detectFormat(line);
      if (fmt !== 'unknown') detectedFormat = fmt;
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
    if (severityLevel !== undefined && !passesSeverityFilter(line, severityLevel)) {
      dropLine(line, physicalLineCount, 'severity');
      continue;
    }

    // CI noise: timestamp-only, K8s Normal, rate-limited
    if (isCiNoiseLine(line)) {
      dropLine(line, physicalLineCount, 'ci-noise');
      continue;
    }

    // CI noise: progress bars
    if (isProgressBarLine(line)) {
      dropLine(line, physicalLineCount, 'progress');
      continue;
    }

    // Access log noise: health checks, static assets, metrics with non-error status
    if (isAccessLogNoiseLine(line)) {
      dropLine(line, physicalLineCount, 'ci-noise');
      continue;
    }

    // Noise tags (INFO/DEBUG/TRACE/VERBOSE) are silently dropped without
    // disturbing afterContextRemaining so that sparse INFO lines between
    // errors do not close the context window prematurely.
    if (isIgnoredLogLine(line)) {
      dropLine(line, physicalLineCount, 'ignored-tag');
      continue;
    }

    let sanitized = sanitizeLine(line);

    // Apply custom sanitize rules
    for (const rule of customSanitizeRules) {
      sanitized = sanitized.replace(rule.regex, rule.replacement);
    }

    // Internal stack-frame collapsing (priority over scoring)
    const isCustomInternalStack =
      customInternalStackRegexes.length > 0 &&
      customInternalStackRegexes.some((r) => testRegex(r, sanitized));
    if (isInternalStackTraceLine(sanitized) || isCustomInternalStack) {
      stats.hiddenInternalStackLines += physicalLineCount;

      if (!hidingInternalStack) {
        await flushContextBefore();
        await emitCandidate(INTERNAL_STACK_MARKER);
        hidingInternalStack = true;
        afterContextRemaining = 0;
      }

      recordDecision({
        line,
        sanitizedLine: INTERNAL_STACK_MARKER,
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
    if (seenCount === 1 && seenLines.size >= TFIDF_MAP_LIMIT) {
      seenLines.clear();
      seenCount = 1;
    }

    seenLines.set(sanitized, seenCount);

    // Score the sanitized line (built-in + custom diagnostic patterns)
    const effectiveAggressiveness: StaticAggressiveness =
      dynamicAggressiveness.effective;
    let score = scoreLineRelevance(
      sanitized,
      effectiveAggressiveness,
      seenCount,
    );

    // Custom diagnostic patterns contribute +50 per match (same as built-in DIAGNOSTIC_PATTERN)
    for (const regex of customDiagnosticRegexes) {
      if (testRegex(regex, sanitized)) {
        score += 50;
        break;
      }
    }
    score += scoreSourceDiagnosticBoost(sanitized, detectedSourceState);

    if (score >= SCORE_KEEP_THRESHOLD) {
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
    } else if (afterContextRemaining > 0) {
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
    } else if (score >= 0) {
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
    } else {
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

  const inputTokens =
    tokenEstimator === undefined
      ? estimateTokens(stats.inputWords)
      : inputTokensFromEstimator;
  const outputTokens =
    tokenEstimator === undefined
      ? estimateTokens(stats.outputWords)
      : outputTokensFromEstimator;
  const savedTokens = Math.max(inputTokens - outputTokens, 0);
  const savingsPercent =
    inputTokens === 0 ? 0 : Math.round((savedTokens / inputTokens) * 10000) / 100;

  return {
    stats,
    inputTokens,
    outputTokens,
    savedTokens,
    savingsPercent,
    detectedSources: rankDetectedSources(detectedSourceState),
    detectedFormat,
  };
}

export async function processLogFile(
  inputPath: string,
  outputPath: string,
  options: LogStripOptions = {},
): Promise<LogStripResult> {
  if (pathsReferToSameFile(inputPath, outputPath)) {
    throw new LogStripError(
      'SAME_INPUT_OUTPUT',
      'Input and output paths must be different; refusing to overwrite the input log',
    );
  }

  const input = createReadStream(inputPath, { encoding: 'utf8' });
  const output = createWriteStream(outputPath, { encoding: 'utf8' });

  try {
    const result = await processLogStream(input, output, options);
    output.end();
    await finished(output);
    return { ...result, outputPath };
  } catch (error) {
    input.destroy();
    output.destroy();
    throw error;
  }
}

export async function processLogFiles(
  jobs: readonly LogStripFileJob[],
  options: LogStripOptions = {},
): Promise<LogStripResult[]> {
  const results: LogStripResult[] = [];

  for (const job of jobs) {
    results.push(
      await processLogFile(job.inputPath, job.outputPath, {
        ...options,
        ...job.options,
      }),
    );
  }

  return results;
}

export async function processLogString(
  inputText: string,
  options: LogStripOptions = {},
): Promise<LogStripStringResult> {
  const chunks: string[] = [];
  const output = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  const result = await processLogStream(
    Readable.from([inputText]),
    output,
    options,
  );

  return { ...result, output: chunks.join('') };
}

export interface LogStripTransform extends Transform {
  readonly result: Promise<LogStripResult>;
}

export function createLogStripTransform(
  options: LogStripOptions = {},
): LogStripTransform {
  const input = new PassThrough();
  let transform: Transform;
  let releaseBackpressure: (() => void) | undefined;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (transform.push(chunk, encoding)) {
        callback();
        return;
      }
      releaseBackpressure = callback;
    },
  });

  const result = processLogStream(input, output, options);
  transform = new Transform({
    highWaterMark: 1,
    transform(chunk, encoding, callback) {
      input.write(chunk, encoding, callback);
    },
    flush(callback) {
      input.end();
      result.then(() => callback(), callback);
    },
    read(size) {
      Transform.prototype._read.call(this, size);
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

  result.catch((error: unknown) => {
    transform.destroy(error as Error);
  });

  return Object.assign(transform, { result }) as LogStripTransform;
}

export function explainLogLine(
  line: string,
  options: LogStripOptions = {},
): LogStripLineDecision {
  const merged = buildMergedConfig(options);
  const includePattern = options.include;
  const excludePattern = options.exclude;
  const severityLevel: SeverityLevel | undefined = options.severity;

  if (line.trim().length === 0) {
    return createDecision(line, undefined, false, 'empty');
  }
  if (includePattern !== undefined && !testRegex(includePattern, line)) {
    return createDecision(line, undefined, false, 'include-filter');
  }
  if (excludePattern !== undefined && testRegex(excludePattern, line)) {
    return createDecision(line, undefined, false, 'exclude-filter');
  }

  const customIgnoreRegexes = merged.ignorePatterns.map((p) =>
    compileConfigRegex(p, 'u'),
  );
  if (customIgnoreRegexes.some((r) => testRegex(r, line))) {
    return createDecision(line, undefined, false, 'custom-ignore');
  }
  if (severityLevel !== undefined && !passesSeverityFilter(line, severityLevel)) {
    return createDecision(line, undefined, false, 'severity');
  }
  if (isCiNoiseLine(line)) {
    return createDecision(line, undefined, false, 'ci-noise');
  }
  if (isProgressBarLine(line)) {
    return createDecision(line, undefined, false, 'progress');
  }
  if (isAccessLogNoiseLine(line)) {
    return createDecision(line, undefined, false, 'ci-noise');
  }
  if (isIgnoredLogLine(line)) {
    return createDecision(line, undefined, false, 'ignored-tag');
  }

  let sanitized = sanitizeLine(line);
  for (const rule of merged.sanitizePatterns) {
    sanitized = sanitized.replace(
      compileConfigRegex(rule.pattern, rule.flags ?? 'gu'),
      rule.replacement,
    );
  }

  const customInternalStackRegexes = merged.internalStackPatterns.map((p) =>
    compileConfigRegex(p, 'u'),
  );
  const isCustomInternalStack =
    customInternalStackRegexes.length > 0 &&
    customInternalStackRegexes.some((r) => testRegex(r, sanitized));
  if (isInternalStackTraceLine(sanitized) || isCustomInternalStack) {
    return createDecision(
      line,
      INTERNAL_STACK_MARKER,
      true,
      'internal-stack',
    );
  }

  let score = scoreLineRelevance(
    sanitized,
    requestedStaticAggressiveness(options.aggressiveness),
  );
  const customDiagnosticRegexes = merged.diagnosticPatterns.map((p) =>
    compileConfigRegex(p, 'u'),
  );
  for (const regex of customDiagnosticRegexes) {
    if (testRegex(regex, sanitized)) {
      score += 50;
      break;
    }
  }

  if (score >= SCORE_KEEP_THRESHOLD) {
    return createDecision(line, sanitized, true, 'hard-keep', score);
  }

  return createDecision(line, sanitized, false, 'low-score', score);
}

export function pathsReferToSameFile(
  inputPath: string,
  outputPath: string,
): boolean {
  return (
    path.resolve(inputPath).toLowerCase() ===
    path.resolve(outputPath).toLowerCase()
  );
}

function compileConfigRegex(pattern: string, flags: string): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    throw new LogStripError(
      'INVALID_CONFIG',
      `Invalid logstrip config regex "${pattern}": ${String(error)}`,
    );
  }
}

function createDecision(
  line: string,
  sanitizedLine: string | undefined,
  kept: boolean,
  reason: LogStripDecisionReason,
  score?: number,
): LogStripLineDecision {
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

function estimateLineTokens(
  estimator: (line: string) => number,
  line: string,
): number {
  return Math.max(0, Math.ceil(estimator(line)));
}

function requestedStaticAggressiveness(
  aggressiveness: Aggressiveness | undefined,
): StaticAggressiveness {
  return toStaticAggressiveness(parseAggressiveness(aggressiveness));
}

function testRegex(regex: RegExp, line: string): boolean {
  regex.lastIndex = 0;
  return regex.test(line);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new LogStripError('ABORTED', 'Processing aborted');
  }
}

function createEmptyStats(): LogStripStats {
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

function countWords(line: string): number {
  return line.trim().match(/\S+/gu)?.length ?? 0;
}

async function writeOutputLine(
  output: Writable,
  line: string,
  stats: LogStripStats,
): Promise<void> {
  const rendered = `${line}\n`;
  stats.outputLines += 1;
  stats.outputWords += countWords(line);
  stats.outputBytes += Buffer.byteLength(rendered, 'utf8');

  if (!output.write(rendered)) {
    await once(output, 'drain');
  }
}

// ---- Timeout wrapper ----

export async function processLogStreamWithTimeout(
  input: NodeJS.ReadableStream,
  output: Writable,
  options: LogStripOptions = {},
  timeoutMs?: number,
): Promise<LogStripResult> {
  if (timeoutMs === undefined) {
    return processLogStream(input, output, options);
  }

  let rejectTimeout!: (reason?: unknown) => void;
  const timeoutPromise = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });
  const timer = setTimeout(
    () => rejectTimeout(new LogStripError('TIMEOUT', 'Processing timed out')),
    timeoutMs,
  );
  const { timeoutMs: _ignoredTimeoutMs, ...streamOptions } = options;

  try {
    return await Promise.race([
      processLogStream(input, output, streamOptions),
      timeoutPromise,
    ]);
  } catch (error) {
    if (error instanceof LogStripError && error.code === 'TIMEOUT') {
      (input as Readable).destroy();
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
  } finally {
    clearTimeout(timer);
  }
}
