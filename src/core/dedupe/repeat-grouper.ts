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

export function createRepeatSignature(line: string): string {
  return tokenizeRepeatLine(line)
    .map((token) => {
      const tokenValue = splitRepeatToken(token);
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
    const firstValue = splitRepeatToken(firstToken);
    const nextValue = splitRepeatToken(tokens[index]);

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

function splitRepeatToken(token: string): RepeatTokenValue | undefined {
  const separator = token.indexOf('=');

  if (separator <= 0 || separator === token.length - 1) {
    return undefined;
  }

  return {
    prefix: token.slice(0, separator + 1),
    value: token.slice(separator + 1),
  };
}
