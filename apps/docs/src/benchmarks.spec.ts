import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BLOCKS,
  JSON_PATH,
  PAGE_PATH,
  bySavings,
  buildDocument,
  injectBlock,
  kindOf,
  percent,
  renderFixtureTable,
  renderKindTable,
  renderPage,
  renderSummary,
  summarize,
} from '../../../scripts/export-benchmarks.mjs';

const row = (id: string, inputTokens: number, outputTokens: number) => ({
  id,
  kind: kindOf(id),
  inputLines: 10,
  outputLines: 4,
  inputTokens,
  outputTokens,
  savingsPercent: percent(inputTokens, outputTokens),
});

const ROWS = [row('jest-noisy', 284, 63), row('all-sources-detection', 1000, 600), row('b', 100, 50)];

describe('percent', () => {
  it('rounds to one decimal and handles an empty input', () => {
    expect(percent(284, 63)).toBe(77.8);
    expect(percent(0, 0)).toBe(0);
  });
});

describe('summarize', () => {
  it('adds up the rows and reports median, lowest and highest savings', () => {
    const totals = summarize(ROWS);

    expect(totals).toMatchObject({
      fixtures: 3,
      inputTokens: 1384,
      outputTokens: 713,
      savingsPercent: 48.5,
      medianSavingsPercent: 50,
      minSavingsPercent: 40,
      maxSavingsPercent: 77.8,
    });
  });

  it('averages the two middle values for an even count', () => {
    expect(summarize([row('a', 100, 50), row('b', 100, 30)]).medianSavingsPercent).toBe(60);
  });
});

describe('buildDocument', () => {
  it('sorts fixtures by id and keeps the estimate method', () => {
    const doc = buildDocument(ROWS, '9.9.9');

    expect(doc.fixtures.map((item: { id: string }) => item.id)).toEqual([
      'all-sources-detection',
      'b',
      'jest-noisy',
    ]);
    expect(doc.logstripVersion).toBe('9.9.9');
    expect(doc.tokenEstimate).toBe('words * 1.3');
  });
});

describe('rendering', () => {
  const doc = buildDocument(ROWS, '9.9.9');

  it('orders the fixture table by savings, then by name', () => {
    const sorted = bySavings([row('b', 100, 50), row('a', 100, 50), row('c', 100, 10)]);

    expect(sorted.map((item: { id: string }) => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('renders one table row per fixture with thousands separators', () => {
    const table = renderFixtureTable(doc).split('\n');

    expect(table).toHaveLength(2 + 3);
    expect(table[2]).toBe('| `jest-noisy` | Single-tool | 10 / 4 | 284 | 63 | 77.8% |');
  });

  it('renders the two groups and the summary list', () => {
    expect(renderKindTable(doc).split('\n')).toHaveLength(4);
    expect(renderSummary(doc)).toContain('- Tokens: 1,384 in, 713 out, 48.5% saved');
    expect(renderSummary(doc)).toContain('- Measured with LogStrip 9.9.9');
  });

  it('classifies the detection samples as multi-tool', () => {
    expect(kindOf('all-sources-detection')).toBe('mixed');
    expect(kindOf('jest-noisy')).toBe('single');
  });
});

describe('injectBlock', () => {
  it('replaces only the text between the markers', () => {
    const page = 'a\n<!-- bench:x:start -->\nold\n<!-- bench:x:end -->\nb';

    expect(injectBlock(page, 'x', 'new')).toBe(
      'a\n<!-- bench:x:start -->\nnew\n<!-- bench:x:end -->\nb'
    );
  });

  it('fails loudly when a marker is missing', () => {
    expect(() => injectBlock('no markers', 'x', 'new')).toThrow(/"x" markers/);
  });
});

describe('committed benchmark files', () => {
  const doc = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  const page = readFileSync(PAGE_PATH, 'utf8');

  it('keep every row consistent with its tokens, within rounding', () => {
    for (const item of doc.fixtures) {
      expect(item.outputTokens).toBeLessThanOrEqual(item.inputTokens);
      const exact = percent(item.inputTokens, item.outputTokens);
      expect(Math.abs(item.savingsPercent - exact)).toBeLessThan(0.11);
    }
  });

  it('have totals that match the rows', () => {
    expect(doc.totals).toEqual(summarize(doc.fixtures));
    expect(doc.totals.fixtures).toBe(50);
  });

  it('are the source of every generated block on the benchmarks page', () => {
    expect(renderPage(page, doc)).toBe(page);
    for (const name of Object.keys(BLOCKS)) {
      expect(page).toContain(`<!-- bench:${name}:start -->`);
    }
  });
});
