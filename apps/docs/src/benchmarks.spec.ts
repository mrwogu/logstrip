import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickProofRows, type BenchmarkDocument } from './benchmarks';
import {
  BADGES,
  BLOCKS,
  COMPARE_PATH,
  JSON_PATH,
  PAGE_PATH,
  README_COMPARE_ROWS,
  README_PATH,
  absoluteDocLinks,
  bySavings,
  buildDocument,
  injectBlock,
  kindOf,
  percent,
  pickReadmeRows,
  renderBadge,
  renderBadges,
  renderFixtureTable,
  renderKindTable,
  renderPage,
  renderReadme,
  renderReadmeBenchmarks,
  renderReadmeComparison,
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
    expect(() => injectBlock('no markers', 'x', 'new')).toThrow(/"bench:x" markers/);
  });

  it('works with another marker prefix, as the README comparison block does', () => {
    const page = '<!-- compare:t:start -->\nold\n<!-- compare:t:end -->';

    expect(injectBlock(page, 't', 'new', 'compare')).toBe(
      '<!-- compare:t:start -->\nnew\n<!-- compare:t:end -->'
    );
  });
});

describe('README output', () => {
  const doc = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as BenchmarkDocument;

  it('shows the same fixtures as the homepage, picked by the same rule', () => {
    expect(pickReadmeRows(doc).map((row: { id: string }) => row.id)).toEqual(
      pickProofRows(doc).map((row) => row.id)
    );
  });

  it('quotes the totals, the median and ten rows, best first', () => {
    const block = renderReadmeBenchmarks(doc);

    expect(block).toContain(`**${doc.totals.savingsPercent.toFixed(1)}%** fewer tokens overall`);
    expect(block).toContain(`the median is ${doc.totals.medianSavingsPercent.toFixed(1)}%`);
    expect(block.match(/^\| `/gm)).toHaveLength(10);
  });

  const COMPARE = [
    '| | LogStrip | Other |',
    '| :--- | :--- | :--- |',
    ...README_COMPARE_ROWS.map(
      (label: string) => `| **${label}** | yes, see [Security](guides/security.md#x) | no |`
    ),
    '| **Extra row** | left out | left out |',
  ].join('\n');

  it('copies the chosen comparison rows from compare.md and points links at the site', () => {
    const lines = renderReadmeComparison(COMPARE).split('\n');

    expect(lines).toHaveLength(2 + README_COMPARE_ROWS.length);
    expect(lines[0]).toBe('| | LogStrip | Other |');
    expect(lines[2]).toContain('**Needs a model**');
    expect(lines.join('\n')).not.toContain('Extra row');
    expect(lines[2]).toContain('(https://mrwogu.github.io/logstrip/guides/security/#x)');
  });

  it('fails when compare.md loses a row or its table', () => {
    expect(() => renderReadmeComparison(COMPARE.replace('**Repeats**', '**Renamed**'))).toThrow(/"Repeats"/);
    expect(() => renderReadmeComparison('no table')).toThrow(/no comparison table/);
  });

  it('only rewrites relative Markdown links', () => {
    expect(absoluteDocLinks('[a](x/y.md) [b](https://e.com/z.md) [c](#top)')).toBe(
      '[a](https://mrwogu.github.io/logstrip/x/y/) [b](https://e.com/z.md) [c](#top)'
    );
  });

  it('keeps the badge format of the other stat badges', () => {
    expect(renderBadge({ width: 150, split: 85, label: 'FIXTURES', value: '41', valueColor: '#f4e7a1' })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="28" viewBox="0 0 150 28">
  <rect width="150" height="28" rx="4" fill="#161818"/>
  <rect x="0" y="0" width="85" height="28" rx="4" fill="#1d1f20"/>
  <text x="43" y="18" text-anchor="middle" fill="#a4a298" font-family="system-ui,sans-serif" font-size="11" font-weight="600">FIXTURES</text>
  <text x="118" y="18" text-anchor="middle" fill="#f4e7a1" font-family="system-ui,sans-serif" font-size="12" font-weight="700">41</text>
</svg>
`
    );
  });

  it('has the README, the comparison source and the badges in sync with the data', () => {
    const readme = readFileSync(README_PATH, 'utf8');

    expect(renderReadme(readme, doc, readFileSync(COMPARE_PATH, 'utf8'))).toBe(readme);
    for (const [file, svg] of Object.entries(renderBadges(doc))) {
      expect(readFileSync(file, 'utf8')).toBe(svg);
    }
    expect(Object.keys(renderBadges(doc))).toEqual(Object.values(BADGES));
  });

  it('no longer carries the unsupported claims', () => {
    const readme = readFileSync(README_PATH, 'utf8');

    expect(readme).not.toMatch(/80%\+|41 fixture|60-80%|20-40%|\$0\.01-\$1\.00/);
    expect(readme).toContain('Requires Node.js 22 or newer.');
    expect(readme).not.toMatch(/Node(\.js)? 20/);
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
    expect(doc.totals.fixtures).toBe(doc.fixtures.length);
  });

  it('are the source of every generated block on the benchmarks page', () => {
    expect(renderPage(page, doc)).toBe(page);
    for (const name of Object.keys(BLOCKS)) {
      expect(page).toContain(`<!-- bench:${name}:start -->`);
    }
  });
});
