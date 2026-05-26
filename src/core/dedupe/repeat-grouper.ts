import { MAX_REPEAT_DELTA_VALUES } from '../constants.js';

export interface RepeatGroup {
  firstLine: string;
  firstTokens: string[];
  signature: string;
  deltas: Map<number, RepeatDelta>;
  count: number;
}

interface RepeatTokenValue {
  prefix: string;
  value: string;
}

interface RepeatDelta {
  prefix: string;
  values: string[];
  hasMoreValues: boolean;
}

const STANDALONE_REPEAT_VALUE_PATTERN = /^\d+(?:[.:,-]\d+)*$/u;
const STANDALONE_REPEAT_LABELS = new Set([
  'child',
  'pid',
  'slot',
  'state',
]);

export function createRepeatSignature(line: string): string {
  const tokens = tokenizeRepeatLine(line);

  return tokens
    .map((token, index) => {
      const tokenValue = splitRepeatToken(token, tokens[index - 1]);
      return tokenValue === undefined
        ? token
        : `${tokenValue.prefix}[VALUE]`;
    })
    .join(' ');
}

export function createRepeatGroup(line: string): RepeatGroup {
  return {
    firstLine: line,
    firstTokens: tokenizeRepeatLine(line),
    signature: createRepeatSignature(line),
    deltas: new Map<number, RepeatDelta>(),
    count: 1,
  };
}

export function addRepeatGroupLine(group: RepeatGroup, line: string): void {
  const tokens = tokenizeRepeatLine(line);

  for (const [index, firstToken] of group.firstTokens.entries()) {
    const firstValue = splitRepeatToken(
      firstToken,
      group.firstTokens[index - 1],
    );
    const nextValue = splitRepeatToken(tokens[index], tokens[index - 1]);

    if (
      firstValue === undefined ||
      nextValue === undefined ||
      firstValue.prefix !== nextValue.prefix ||
      firstValue.value === nextValue.value
    ) {
      continue;
    }

    const delta = group.deltas.get(index) ?? {
      prefix: firstValue.prefix,
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

  group.count += 1;
}

export function renderRepeatGroup(group: RepeatGroup): string {
  if (group.deltas.size === 0) {
    return group.firstLine;
  }

  const tokens = [...group.firstTokens];

  for (const [index, delta] of group.deltas) {
    const values = delta.hasMoreValues
      ? [...delta.values, '…']
      : delta.values;
    tokens[index] = `${delta.prefix}[${values.join(' | ')}]`;
  }

  return tokens.join(' ');
}

function tokenizeRepeatLine(line: string): string[] {
  return line.trim().split(/\s+/u);
}

function splitRepeatToken(
  token: string,
  previousToken?: string,
): RepeatTokenValue | undefined {
  const separator = token.indexOf('=');

  if (separator > 0 && separator < token.length - 1) {
    return {
      prefix: token.slice(0, separator + 1),
      value: token.slice(separator + 1),
    };
  }

  if (
    previousToken !== undefined &&
    STANDALONE_REPEAT_LABELS.has(previousToken.toLowerCase()) &&
    STANDALONE_REPEAT_VALUE_PATTERN.test(token)
  ) {
    return {
      prefix: '',
      value: token,
    };
  }

  return undefined;
}
