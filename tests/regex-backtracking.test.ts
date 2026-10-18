import { describe, expect, it, vi } from 'vitest';
import { classifyContent } from '../src/core/detection/content-kind';
import { isPassingTestLine } from '../src/core/scoring/passing-test';
import { maskSecrets, sanitizeLine, stripAnsi } from '../src/core/sanitize/sanitize-line';

// The classifier only looks at the first CONTENT_LINE_SCAN_LIMIT characters of
// a line. Lift that cap so the whole adversarial line reaches the patterns.
vi.mock('../src/core/constants.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/constants.js')>();
  return { ...actual, CONTENT_LINE_SCAN_LIMIT: 1_000_000 };
});

const SIZE = 100_000;
// Well under a second: a linear pattern needs a few milliseconds for 100 KB,
// a quadratic or cubic one needs minutes.
const LIMIT_MS = 500;

function repeated(unit: string, prefix = '', suffix = ''): string {
  return prefix + unit.repeat(Math.ceil(SIZE / unit.length)) + suffix;
}

function elapsedMs(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

// Each line is built to make one pattern backtrack: a long run of the
// characters two neighbouring quantifiers share, and then a character that
// makes the match fail at the very end.
const ADVERSARIAL: ReadonlyArray<readonly [string, string]> = [
  ['spaces', ' '.repeat(SIZE)],
  ['dashes', '-'.repeat(SIZE)],
  ['letters', 'a'.repeat(SIZE)],
  ['equals signs', '='.repeat(SIZE)],
  ['tabs', '\t'.repeat(SIZE)],
  ['tabs after case', repeated('\t', 'case ', 'x')],
  ['tabs after import', repeated('\t', 'import ')],
  ['import with words', repeated('a ', 'import ', '!')],
  ['spaces after const', repeated(' ', 'const ', '!')],
  ['spaces after end', repeated(' ', 'end', 'x')],
  ['spaces after if', repeated(' ', 'if', 'x')],
  ['spaces after a condition', repeated(' ', 'if (a)', 'x')],
  ['spaces after return', repeated(' ', 'return a b c', 'x')],
  ['closing parentheses', repeated('a)', 'if (', 'x')],
  ['at signs after >', repeated('a@', '> ')],
  ['access log lines', repeated('10.0.0.1 GET /a ')],
  ['one address, then methods', repeated('GET a ', '1.1.1.1 ')],
  ['many addresses', repeated('1.1.1.1 ')],
  ['link openings', repeated('[a](b')],
  ['brackets', repeated('[')],
  ['rust use paths', repeated('::{', 'use a')],
  ['double colons in a word', repeated('a::', '', ' x')],
  ['double colons after PASSED', repeated('a::', 'PASSED ')],
  ['dots after Passed', repeated('a.', 'Passed ', ' x')],
  ['greater-than signs', repeated('a > ')],
  ['greater-than signs and PASSED', repeated('a > b PASSED ')],
  ['ok then spaces', repeated(' ', 'ok', 'x')],
  ['escape sequences', repeated('\u001b[0m')],
  ['unterminated escape sequences', repeated('\u001b]0;a')],
  ['secret references', repeated('password=${')],
  ['secret commands', repeated('password=$(')],
  ['secret quotes', repeated('password="')],
  ['secret escapes', repeated('password:\\"x')],
  ['secret labels', repeated('token: ')],
  ['secret names', repeated('auth ')],
];

describe('patterns do not backtrack on long lines', () => {
  it.each(ADVERSARIAL)('classifyContent: %s', (_name, line) => {
    expect(elapsedMs(() => classifyContent([line]))).toBeLessThan(LIMIT_MS);
  });

  it.each(ADVERSARIAL)('isPassingTestLine: %s', (_name, line) => {
    expect(elapsedMs(() => isPassingTestLine(line))).toBeLessThan(LIMIT_MS);
  });

  it.each(ADVERSARIAL)('stripAnsi: %s', (_name, line) => {
    expect(elapsedMs(() => stripAnsi(line))).toBeLessThan(LIMIT_MS);
  });

  it.each(ADVERSARIAL)('sanitizeLine and maskSecrets: %s', (_name, line) => {
    expect(
      elapsedMs(() => {
        sanitizeLine(line);
        maskSecrets(line);
      }),
    ).toBeLessThan(LIMIT_MS);
  });
});
