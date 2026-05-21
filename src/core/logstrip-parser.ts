import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import {
  type LogStripCustomConfig,
  type LogStripSourceSignature,
  loadLogStripConfig,
} from './logstrip-config.js';
import { parseAggressiveness } from './aggressiveness/levels.js';
import {
  createDynamicAggressivenessState,
  recordLineDecision,
  type LineDecision,
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
  isIgnoredLogLine,
  isInternalStackTraceLine,
  scoreLineRelevance,
} from './scoring/relevance-score.js';
import { LOG_SOURCE_SIGNATURES } from './sources/catalog.js';
import type {
  Aggressiveness,
  LogStripOptions,
  LogStripResult,
  LogStripStats,
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
  isInternalStackTraceLine,
  looksLikeDiagnosticLine,
  scoreLineRelevance,
  shouldKeepLine,
} from './scoring/relevance-score.js';
export { KNOWN_LOG_SOURCES, LOG_SOURCE_SIGNATURES } from './sources/catalog.js';
export type {
  Aggressiveness,
  LogStripOptions,
  LogStripResult,
  LogStripStats,
  StaticAggressiveness,
} from './types.js';


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
  const config = loadLogStripConfig(options.configPath);
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

export async function processLogStream(
  input: NodeJS.ReadableStream,
  output: Writable,
  options: LogStripOptions = {},
): Promise<LogStripResult> {
  const requestedAggressiveness = parseAggressiveness(options.aggressiveness);
  const dynamicAggressiveness =
    createDynamicAggressivenessState(requestedAggressiveness);
  const merged = buildMergedConfig(options);
  const multilineMode = options.multiline ?? 'off';
  const severityLevel: SeverityLevel | undefined = options.severity;

  // Compile custom patterns once per stream
  const customDiagnosticRegexes = merged.diagnosticPatterns.map(
    (p) => new RegExp(p, 'u'),
  );
  const customIgnoreRegexes = merged.ignorePatterns.map(
    (p) => new RegExp(p, 'u'),
  );
  const customInternalStackRegexes = merged.internalStackPatterns.map(
    (p) => new RegExp(p, 'u'),
  );
  const customSanitizeRules = merged.sanitizePatterns.map(
    (r) => ({ regex: new RegExp(r.pattern, r.flags ?? 'gu'), replacement: r.replacement }),
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

  const recordDecision = (decision: LineDecision): void => {
    recordLineDecision(dynamicAggressiveness, decision);
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

    await writeOutputLine(output, line, stats);
    previousGroup = undefined;
  };

  const emitCandidate = async (line: string): Promise<void> => {
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

  for await (const rawLine of lines) {
    const line = String(rawLine);
    const physicalLineCount = line.split('\n').length;
    collectDetectedSourceHits(line, detectedSourceState);
    stats.inputLines += physicalLineCount;
    stats.inputWords += countWords(line);
    stats.inputBytes += Buffer.byteLength(`${line}\n`, 'utf8');

    if (detectedFormat === undefined && line.trim().length > 0) {
      const fmt = detectFormat(line);
      if (fmt !== 'unknown') detectedFormat = fmt;
    }

    // Empty lines always dropped; don't disturb context state
    if (line.trim().length === 0) {
      stats.droppedLines += physicalLineCount;
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
      stats.droppedLines += physicalLineCount;
      hidingInternalStack = false;
      recordDecision({
        kept: false,
        dropped: true,
        hardKeep: false,
        repeated: false,
      });
      continue;
    }

    // Severity filter (Phase 1.4): drop lines below threshold
    if (severityLevel !== undefined && !passesSeverityFilter(line, severityLevel)) {
      stats.droppedLines += physicalLineCount;
      hidingInternalStack = false;
      recordDecision({
        kept: false, dropped: true, hardKeep: false, repeated: false,
      });
      continue;
    }

    // Noise tags (INFO/DEBUG/TRACE/VERBOSE) are silently dropped without
    // disturbing afterContextRemaining so that sparse INFO lines between
    // errors do not close the context window prematurely.
    if (isIgnoredLogLine(line)) {
      stats.droppedLines += physicalLineCount;
      hidingInternalStack = false;
      recordDecision({
        kept: false,
        dropped: true,
        hardKeep: false,
        repeated: false,
      });
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
      customInternalStackRegexes.some((r) => r.test(sanitized));
    if (isInternalStackTraceLine(sanitized) || isCustomInternalStack) {
      stats.hiddenInternalStackLines += physicalLineCount;

      if (!hidingInternalStack) {
        await flushContextBefore();
        await emitCandidate(INTERNAL_STACK_MARKER);
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
      if (regex.test(sanitized)) {
        score += 50;
        break;
      }
    }
    score += scoreSourceDiagnosticBoost(sanitized, detectedSourceState);

    if (score >= SCORE_KEEP_THRESHOLD) {
      // Hard keep: flush buffered context, emit, open after-context window
      await flushContextBefore();
      await emitCandidate(sanitized);
      afterContextRemaining = CONTEXT_WINDOW_AFTER;
      recordDecision({
        kept: true,
        dropped: false,
        hardKeep: true,
        repeated: seenCount > 1,
      });
    } else if (afterContextRemaining > 0) {
      // Inside after-context window: emit regardless of score
      await emitCandidate(sanitized);
      afterContextRemaining -= 1;
      recordDecision({
        kept: true,
        dropped: false,
        hardKeep: false,
        repeated: seenCount > 1,
      });
    } else if (score >= 0) {
      // Soft: buffer in context ring (oldest evicted & counted as dropped)
      let droppedBufferedLine = false;
      if (contextBefore.length >= CONTEXT_WINDOW_BEFORE) {
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
    } else {
      // Hard drop (score < 0): negative TF-IDF or aggressive WARN suppression
      stats.droppedLines += physicalLineCount;
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

  const inputTokens = estimateTokens(stats.inputWords);
  const outputTokens = estimateTokens(stats.outputWords);
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
    throw new Error(
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

export function pathsReferToSameFile(
  inputPath: string,
  outputPath: string,
): boolean {
  return (
    path.resolve(inputPath).toLowerCase() ===
    path.resolve(outputPath).toLowerCase()
  );
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
