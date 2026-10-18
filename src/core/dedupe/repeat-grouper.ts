import { MAX_REPEAT_DELTA_VALUES } from '../constants.js';

export interface RepeatGroup {
  firstLine: string;
  firstTokens: string[];
  signature: string;
  deltas: Map<number, RepeatDelta>;
  count: number;
  firstSeen: number | null;
  lastSeen: number | null;
  /** Highest relevance score seen across the collapsed lines (for budgeting). */
  score: number;
}

interface RepeatTokenValue {
  prefix: string;
  value: string;
  suffix: string;
}

interface RepeatDelta {
  prefix: string;
  suffix: string;
  values: string[];
  hasMoreValues: boolean;
}

// Classic (allowlist) mode keeps the strict bare-number form.
const CLASSIC_REPEAT_VALUE_PATTERN = /^\d+(?:[.:,-]\d+)*$/u;
// A standalone number, optionally with a duration or size unit ("12s",
// "250ms", "3.4MB", "45%"), wrapped in the punctuation logs put around it:
// "(attempt 3)", "retry 2,", "(0.19s)". Group 1 and 3 are kept verbatim.
const STANDALONE_REPEAT_VALUE_PATTERN =
  /^(\(?)(\d+(?:[.:,-]\d+)*(?:ms|us|\u00b5s|ns|s|m|h|d|%|[kKMGT]i?B|B)?)([)\],;.]*)$/u;
// Labels that precede an enumerable instance counter. Numbers after these
// collapse into a single delta-tracked group so otherwise-identical lines
// fold via [xN]. Intentionally excludes labels whose numbers carry meaning
// (e.g. "error"/"code"/"status"/"exit") to avoid merging distinct diagnostics.
const STANDALONE_REPEAT_LABELS = new Set([
  'attempt',
  'batch',
  'child',
  'chunk',
  'connection',
  'epoch',
  'iteration',
  'job',
  'partition',
  'pid',
  'replica',
  'retry',
  'session',
  'shard',
  'slot',
  'state',
  'task',
  'thread',
  'worker',
]);

// Template mining inverts the allowlist: a standalone number after ANY word
// label merges into a delta, except after labels whose numbers carry
// diagnostic meaning (exit codes, statuses, line numbers, versions).
const STANDALONE_VALUE_BLOCKLIST = new Set([
  'code',
  'errno',
  'error',
  'exit',
  'line',
  'signal',
  'status',
  'version',
]);

// A label may open a parenthesis: "(attempt 3)".
const TEMPLATE_LABEL_PATTERN = /^\(?[A-Za-z][\w-]*:?$/u;

export function createRepeatSignature(line: string, template = false): string {
  const tokens = tokenizeRepeatLine(line);

  return tokens
    .map((token, index) => {
      const tokenValue = splitRepeatToken(token, tokens[index - 1], template);
      return tokenValue === undefined
        ? token
        : `${tokenValue.prefix}[VALUE]${tokenValue.suffix}`;
    })
    .join(' ');
}

export function createRepeatGroup(
  line: string,
  score = 0,
  signature?: string,
): RepeatGroup {
  const ts = extractTimestampMs(line);
  return {
    firstLine: line,
    firstTokens: tokenizeRepeatLine(line),
    signature: signature ?? createRepeatSignature(line),
    deltas: new Map<number, RepeatDelta>(),
    count: 1,
    firstSeen: ts,
    lastSeen: ts,
    score,
  };
}

export function addRepeatGroupLine(
  group: RepeatGroup,
  line: string,
  score = 0,
  template = false,
): void {
  const tokens = tokenizeRepeatLine(line);
  if (score > group.score) {
    group.score = score;
  }

  for (const [index, firstToken] of group.firstTokens.entries()) {
    const firstValue = splitRepeatToken(
      firstToken,
      group.firstTokens[index - 1],
      template,
    );
    const nextValue = splitRepeatToken(tokens[index], tokens[index - 1], template);

    if (
      firstValue === undefined ||
      nextValue === undefined ||
      firstValue.prefix !== nextValue.prefix ||
      firstValue.suffix !== nextValue.suffix ||
      firstValue.value === nextValue.value
    ) {
      continue;
    }

    const delta = group.deltas.get(index) ?? {
      prefix: firstValue.prefix,
      suffix: firstValue.suffix,
      values: [firstValue.value],
      hasMoreValues: false,
    };

    if (!group.deltas.has(index)) {
      group.deltas.set(index, delta);
    }

    if (delta.values.includes(nextValue.value)) {
      continue;
    }

    if (delta.values.length < MAX_REPEAT_DELTA_VALUES) {
      delta.values.push(nextValue.value);
    } else {
      delta.hasMoreValues = true;
    }
  }

  const ts = extractTimestampMs(line);
  if (ts !== null && (group.lastSeen === null || ts > group.lastSeen)) {
    group.lastSeen = ts;
  }

  group.count += 1;
}

const TIMESTAMP_CANDIDATE = /\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?)\b/u;

function extractTimestampMs(line: string): number | null {
  const match = TIMESTAMP_CANDIDATE.exec(line);
  if (!match) return null;
  const ms = Date.parse(match[1]);
  return Number.isFinite(ms) ? ms : null;
}

export function getRepeatGroupSpreadMs(group: RepeatGroup): number | null {
  if (group.firstSeen === null || group.lastSeen === null) return null;
  return group.lastSeen - group.firstSeen;
}

export function renderRepeatGroup(group: RepeatGroup): string {
  const baseTokens =
    group.deltas.size === 0 ? group.firstTokens : mergeDeltaTokens(group);

  let line = baseTokens.join(' ');

  const spread = getRepeatGroupSpreadMs(group);
  if (spread !== null && spread > 5000) {
    const spreadStr = formatDurationMs(spread);
    line += ` [~${spreadStr}]`;
  }

  return line;
}

function mergeDeltaTokens(group: RepeatGroup): string[] {
  const tokens = [...group.firstTokens];
  for (const [index, delta] of group.deltas) {
    const values = delta.hasMoreValues
      ? [...delta.values, '…']
      : delta.values;
    tokens[index] = `${delta.prefix}[${values.join(' | ')}]${delta.suffix}`;
  }
  return tokens;
}

function formatDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function tokenizeRepeatLine(line: string): string[] {
  return line.trim().split(/\s+/u);
}

function splitRepeatToken(
  token: string,
  previousToken?: string,
  template = false,
): RepeatTokenValue | undefined {
  const separator = token.indexOf('=');

  if (separator > 0 && separator < token.length - 1) {
    return {
      prefix: token.slice(0, separator + 1),
      value: token.slice(separator + 1),
      suffix: '',
    };
  }

  const standalone = template ? STANDALONE_REPEAT_VALUE_PATTERN.exec(token) : null;
  if (
    standalone !== null &&
    previousToken !== undefined &&
    isTemplateMergeLabel(previousToken)
  ) {
    return {
      prefix: standalone[1],
      value: standalone[2],
      suffix: standalone[3],
    };
  }

  if (
    !template &&
    previousToken !== undefined &&
    CLASSIC_REPEAT_VALUE_PATTERN.test(token) &&
    STANDALONE_REPEAT_LABELS.has(previousToken.toLowerCase())
  ) {
    return {
      prefix: '',
      value: token,
      suffix: '',
    };
  }

  return undefined;
}

// A response size follows the status code in common/combined access logs:
// '"GET /x HTTP/1.1" 502 150 ...'. Sizes differ on every line of a burst.
const HTTP_STATUS_TOKEN_PATTERN = /^[1-5]\d{2}$/u;

function isTemplateMergeLabel(previousToken: string): boolean {
  if (HTTP_STATUS_TOKEN_PATTERN.test(previousToken)) {
    return true;
  }
  if (!TEMPLATE_LABEL_PATTERN.test(previousToken)) {
    return false;
  }
  const label = previousToken.replace(/^\(/u, '').replace(/:$/u, '').toLowerCase();
  return !STANDALONE_VALUE_BLOCKLIST.has(label);
}
