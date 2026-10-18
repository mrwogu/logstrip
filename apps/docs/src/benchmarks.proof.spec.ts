import { describe, expect, it } from 'vitest';
import doc from './data/benchmarks.json';
import {
  HOME_SELECTION,
  keptWidth,
  pickProofRows,
  proofHtml,
  type BenchmarkDocument,
  type BenchmarkRow,
} from './benchmarks';

const DOC = doc as BenchmarkDocument;

const row = (id: string, savings: number, kind: 'single' | 'mixed' = 'single'): BenchmarkRow => ({
  id,
  kind,
  inputLines: 10,
  outputLines: 5,
  inputTokens: 1000,
  outputTokens: Math.round(1000 - savings * 10),
  savingsPercent: savings,
});

const SMALL: BenchmarkDocument = {
  logstripVersion: '0.0.0',
  tokenEstimate: 'words * 1.3',
  totals: {
    fixtures: 6,
    inputLines: 60,
    outputLines: 30,
    inputTokens: 6000,
    outputTokens: 3000,
    savingsPercent: 50,
    medianSavingsPercent: 50,
    minSavingsPercent: 10,
    maxSavingsPercent: 90,
  },
  fixtures: [
    row('a', 90),
    row('b', 70),
    row('c', 50),
    row('d', 45),
    row('e', 30),
    row('f', 10),
    row('mixed-high', 95, 'mixed'),
  ],
};

describe('pickProofRows', () => {
  it('takes the best, the nearest to the median and the weakest single-tool fixtures', () => {
    const ids = pickProofRows(SMALL, { best: 2, middle: 1, weakest: 1 }).map((item) => item.id);

    expect(ids).toEqual(['a', 'b', 'c', 'f']);
  });

  it('never includes multi-tool samples and never repeats a fixture', () => {
    const ids = pickProofRows(SMALL, { best: 3, middle: 3, weakest: 3 }).map((item) => item.id);

    expect(ids).not.toContain('mixed-high');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(6);
  });

  it('returns rows best first', () => {
    const rows = pickProofRows(DOC);
    const savings = rows.map((item) => item.savingsPercent);

    expect(savings).toEqual([...savings].sort((a, b) => b - a));
  });

  it('shows the lowest single-tool fixture of the committed data, not only the best', () => {
    const rows = pickProofRows(DOC);
    const lowestSingle = Math.min(
      ...DOC.fixtures.filter((item) => item.kind === 'single').map((item) => item.savingsPercent)
    );

    expect(rows).toHaveLength(
      HOME_SELECTION.best + HOME_SELECTION.middle + HOME_SELECTION.weakest
    );
    expect(Math.min(...rows.map((item) => item.savingsPercent))).toBe(lowestSingle);
  });
});

describe('keptWidth', () => {
  it('is the share of tokens that survive', () => {
    expect(keptWidth(row('x', 75))).toBe('25.00%');
    expect(keptWidth({ ...row('x', 0), inputTokens: 0, outputTokens: 0 })).toBe('100%');
  });
});

describe('proofHtml', () => {
  it('renders the totals line, one list item per row and a legend', () => {
    const html = proofHtml(SMALL, [row('a', 90)]);

    expect(html).toContain('<strong>50.0%</strong> fewer tokens across all 6 fixtures');
    expect(html).toContain('6,000 to 3,000');
    expect(html.match(/<li class="hp-row">/g)).toHaveLength(1);
    expect(html).toContain('90.0%');
    expect(html).toContain('hp-key--stripped');
  });

  it('escapes fixture names', () => {
    expect(proofHtml(SMALL, [row('<b>', 10)])).toContain('&lt;b&gt;');
  });

  it('reports the committed totals', () => {
    expect(proofHtml(DOC)).toContain(`${DOC.totals.savingsPercent.toFixed(1)}%`);
  });
});
