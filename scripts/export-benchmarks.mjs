#!/usr/bin/env node
// Measures every tests/fixtures/*.log with the built parser and writes the
// numbers the documentation shows:
//
//   apps/docs/src/data/benchmarks.json   read by the homepage at build time
//   docs/benchmarks.md                   generated blocks between bench markers
//   README.md                            benchmark block and comparison table
//   assets/tags/stat-*.svg               the savings and fixture-count badges
//
// All of it comes from one run, so the homepage, the benchmarks page and the
// README cannot disagree. The README comparison table is copied from
// docs/compare.md. The output holds no timestamps and no timings: the same
// parser on the same fixtures writes the same bytes.
//
//   npm run build && npm run docs:bench
//   node scripts/export-benchmarks.mjs --check   # exit 1 when files are stale
//
// --check compares numbers only. It keeps the LogStrip version already in the
// committed data, so a release PR that bumps package.json does not fail it.
//
// Token counts are the project's own estimate (words * 1.3, the same number
// `--stats` prints), not a model tokenizer.

import { readFileSync, writeFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const FIXTURES_DIR = path.join(root, 'tests/fixtures');
export const JSON_PATH = path.join(root, 'apps/docs/src/data/benchmarks.json');
export const PAGE_PATH = path.join(root, 'docs/benchmarks.md');
export const README_PATH = path.join(root, 'README.md');
export const COMPARE_PATH = path.join(root, 'docs/compare.md');
export const BADGES = {
  savings: path.join(root, 'assets/tags/stat-savings.svg'),
  fixtures: path.join(root, 'assets/tags/stat-fixtures.svg'),
};
const SITE = 'https://mrwogu.github.io/logstrip';

export const KIND_LABELS = {
  single: 'Single-tool logs',
  mixed: 'Multi-tool samples',
};

// The per-fixture table is narrow, so it uses the short form.
const KIND_SHORT = {
  single: 'Single-tool',
  mixed: 'Multi-tool',
};

// Fixtures that mix a few lines from many tools. They were written to test
// source detection, so they hold little repetition. Every other fixture is one
// tool and one failure story, which is closer to what gets pasted into a chat.
const MIXED_FIXTURES = new Set([
  'ai-ml-ecosystem',
  'all-sources-detection',
  'auth-secrets-config',
  'backup-docs-messaging',
  'build-test-systems',
  'build-toolchains',
  'ci-pkg-managers',
  'ci-platforms',
  'cloud-serverless',
  'data-search-analytics',
  'data-telemetry-scanners',
  'ecosystem-signals-realistic',
  'email-ci-infra',
  'go-rust-ruby-frameworks',
  'infra-cloud',
  'iot-game-embedded',
  'java-enterprise',
  'mobile-desktop-cms',
  'networking-edge-serverless',
  'observability-analytics',
  'orm-db-migrations',
  'python-lint-async',
  'realtime-graphql',
  'security-scanners',
  'terraform-ansible-systemd',
  'web-frameworks-node',
]);

export function kindOf(id) {
  return MIXED_FIXTURES.has(id) ? 'mixed' : 'single';
}

/** Percent to one decimal, as the bench script prints it. */
export function percent(inputTokens, outputTokens) {
  if (inputTokens === 0) return 0;
  return Math.round((1 - outputTokens / inputTokens) * 1000) / 10;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
}

/** Totals over a set of fixture rows. */
export function summarize(rows) {
  const savings = rows.map((row) => row.savingsPercent);
  const inputTokens = sum(rows, 'inputTokens');
  const outputTokens = sum(rows, 'outputTokens');
  return {
    fixtures: rows.length,
    inputLines: sum(rows, 'inputLines'),
    outputLines: sum(rows, 'outputLines'),
    inputTokens,
    outputTokens,
    savingsPercent: percent(inputTokens, outputTokens),
    medianSavingsPercent: median(savings),
    minSavingsPercent: Math.min(...savings),
    maxSavingsPercent: Math.max(...savings),
  };
}

/** The JSON document, from rows sorted by fixture id. */
export function buildDocument(rows, logstripVersion) {
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return {
    logstripVersion,
    tokenEstimate: 'words * 1.3',
    totals: summarize(sorted),
    fixtures: sorted,
  };
}

const number = (value) => value.toLocaleString('en-US');
const pct = (value) => `${value.toFixed(1)}%`;

function table(header, align, bodyRows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(header), line(align), ...bodyRows.map(line)].join('\n');
}

/** Savings first, then name, so the order never depends on the file system. */
export function bySavings(rows) {
  return [...rows].sort(
    (a, b) => b.savingsPercent - a.savingsPercent || a.id.localeCompare(b.id),
  );
}

export function renderSummary(doc) {
  const { totals } = doc;
  return [
    `- Fixtures: ${totals.fixtures}`,
    `- Lines: ${number(totals.inputLines)} in, ${number(totals.outputLines)} out`,
    `- Tokens: ${number(totals.inputTokens)} in, ${number(totals.outputTokens)} out, ${pct(totals.savingsPercent)} saved`,
    `- Per-fixture savings: median ${pct(totals.medianSavingsPercent)}, lowest ${pct(totals.minSavingsPercent)}, highest ${pct(totals.maxSavingsPercent)}`,
    `- Measured with LogStrip ${doc.logstripVersion}`,
  ].join('\n');
}

export function renderKindTable(doc) {
  const rows = Object.entries(KIND_LABELS).map(([kind, label]) => {
    const group = doc.fixtures.filter((fixture) => fixture.kind === kind);
    const totals = summarize(group);
    return [
      label,
      String(totals.fixtures),
      number(totals.inputTokens),
      number(totals.outputTokens),
      pct(totals.savingsPercent),
      pct(totals.medianSavingsPercent),
    ];
  });
  return table(
    ['Group', 'Fixtures', 'Input tokens', 'Output tokens', 'Savings', 'Median per fixture'],
    [':---', '---:', '---:', '---:', '---:', '---:'],
    rows,
  );
}

export function renderFixtureTable(doc) {
  const rows = bySavings(doc.fixtures).map((fixture) => [
    `\`${fixture.id}\``,
    KIND_SHORT[fixture.kind],
    `${number(fixture.inputLines)} / ${number(fixture.outputLines)}`,
    number(fixture.inputTokens),
    number(fixture.outputTokens),
    pct(fixture.savingsPercent),
  ]);
  return table(
    ['Fixture', 'Group', 'Lines in / out', 'Input tokens', 'Output tokens', 'Savings'],
    [':---', ':---', '---:', '---:', '---:', '---:'],
    rows,
  );
}

export const BLOCKS = {
  summary: renderSummary,
  groups: renderKindTable,
  fixtures: renderFixtureTable,
};

const markerStart = (prefix, name) => `<!-- ${prefix}:${name}:start -->`;
const markerEnd = (prefix, name) => `<!-- ${prefix}:${name}:end -->`;

/** Replaces the text between the start and end markers of one block. */
export function injectBlock(markdown, name, content, prefix = 'bench') {
  const start = markdown.indexOf(markerStart(prefix, name));
  const end = markdown.indexOf(markerEnd(prefix, name));
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`missing the "${prefix}:${name}" markers`);
  }
  const head = markdown.slice(0, start + markerStart(prefix, name).length);
  return `${head}\n${content}\n${markdown.slice(end)}`;
}

/** The whole page with every generated block refreshed from the document. */
export function renderPage(markdown, doc) {
  return Object.entries(BLOCKS).reduce(
    (page, [name, render]) => injectBlock(page, name, render(doc)),
    markdown,
  );
}

// The README shows the same ten rows as the homepage. The rule is the one in
// apps/docs/src/benchmarks.ts (a spec checks both pick the same fixtures): from
// the single-tool fixtures, the best few, the few nearest their median and the
// weakest few, so the list cannot be cherry-picked by hand.
export const README_SELECTION = { best: 6, middle: 2, weakest: 2 };

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function pickReadmeRows(doc, selection = README_SELECTION) {
  const single = doc.fixtures.filter((row) => row.kind === 'single');
  const ordered = bySavings(single);
  const best = ordered.slice(0, selection.best);
  const weakest = ordered.slice(Math.max(ordered.length - selection.weakest, 0));
  const taken = new Set([...best, ...weakest].map((row) => row.id));
  const median = medianOf(single.map((row) => row.savingsPercent));
  const middle = single
    .filter((row) => !taken.has(row.id))
    .sort(
      (a, b) =>
        Math.abs(a.savingsPercent - median) - Math.abs(b.savingsPercent - median) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, selection.middle);
  return bySavings([...best, ...middle, ...weakest]);
}

export function renderReadmeBenchmarks(doc) {
  const { totals } = doc;
  const rows = pickReadmeRows(doc);
  const single = doc.fixtures.filter((row) => row.kind === 'single').length;
  const { best, middle, weakest } = README_SELECTION;
  const intro =
    `Measured on the ${totals.fixtures} test fixtures in the repository, with LogStrip's own token estimate (words times 1.3): ` +
    `**${pct(totals.savingsPercent)}** fewer tokens overall (${number(totals.inputTokens)} to ${number(totals.outputTokens)}). ` +
    `Per fixture the median is ${pct(totals.medianSavingsPercent)}, the lowest ${pct(totals.minSavingsPercent)} and the highest ${pct(totals.maxSavingsPercent)}. ` +
    'These are small logs that we wrote, so run `logstrip --stats` on yours.';
  const note = `${rows.length} of the ${single} single-tool fixtures, best first: the ${best} best, the ${middle} nearest the median and the ${weakest} weakest.`;
  const body = table(
    ['Fixture', 'Lines in / out', 'Input tokens', 'Output tokens', 'Savings'],
    [':---', '---:', '---:', '---:', '---:'],
    rows.map((row) => [
      `\`${row.id}\``,
      `${number(row.inputLines)} / ${number(row.outputLines)}`,
      number(row.inputTokens),
      number(row.outputTokens),
      pct(row.savingsPercent),
    ]),
  );
  return `${intro}\n\n${note}\n\n${body}`;
}

// Rows of docs/compare.md that the README repeats, in this order.
export const README_COMPARE_ROWS = [
  'Needs a model',
  'Needs network',
  'Cost per run',
  'Same input, same output',
  'Lines stay whole',
  'Stack frames',
  'Identifiers and line numbers',
  'Repeats',
  'Secrets',
  'Streams with bounded memory',
];

/** `[text](guides/x.md)` becomes a link to the published page, so it works on npm. */
export function absoluteDocLinks(markdown) {
  return markdown.replaceAll(
    /\]\((?!https?:|#)([^)\s]+?)\.md(#[^)\s]*)?\)/g,
    (_link, page, hash = '') => `](${SITE}/${page}/${hash})`,
  );
}

/** The README comparison table, copied row by row from docs/compare.md. */
export function renderReadmeComparison(compareMarkdown) {
  const lines = compareMarkdown.split('\n');
  const headerAt = lines.findIndex((line) => line.startsWith('| | '));
  if (headerAt === -1) throw new Error('docs/compare.md has no comparison table');
  const rows = new Map();
  for (const line of lines) {
    const label = /^\| \*\*(.+?)\*\* \|/.exec(line)?.[1];
    if (label) rows.set(label, line);
  }
  const picked = README_COMPARE_ROWS.map((label) => {
    const row = rows.get(label);
    if (!row) throw new Error(`docs/compare.md has no "${label}" row`);
    return row;
  });
  return absoluteDocLinks([lines[headerAt], lines[headerAt + 1], ...picked].join('\n'));
}

/** README with the benchmark block and the comparison table refreshed. */
export function renderReadme(readme, doc, compareMarkdown) {
  const withBenchmarks = injectBlock(readme, 'readme', renderReadmeBenchmarks(doc));
  return injectBlock(withBenchmarks, 'readme', renderReadmeComparison(compareMarkdown), 'compare');
}

/** A stat badge in the style of the other assets/tags/stat-*.svg files. */
export function renderBadge({ width, split, label, value, valueColor }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" viewBox="0 0 ${width} 28">
  <rect width="${width}" height="28" rx="4" fill="#161818"/>
  <rect x="0" y="0" width="${split}" height="28" rx="4" fill="#1d1f20"/>
  <text x="${Math.round(split / 2)}" y="18" text-anchor="middle" fill="#a4a298" font-family="system-ui,sans-serif" font-size="11" font-weight="600">${label}</text>
  <text x="${Math.round(split + (width - split) / 2)}" y="18" text-anchor="middle" fill="${valueColor}" font-family="system-ui,sans-serif" font-size="12" font-weight="700">${value}</text>
</svg>
`;
}

export function renderBadges(doc) {
  return {
    [BADGES.savings]: renderBadge({
      width: 200,
      split: 122,
      label: 'FIXTURE SAVINGS',
      value: pct(doc.totals.savingsPercent),
      valueColor: '#a4ffaf',
    }),
    [BADGES.fixtures]: renderBadge({
      width: 150,
      split: 85,
      label: 'FIXTURES',
      value: String(doc.totals.fixtures),
      valueColor: '#f4e7a1',
    }),
  };
}

export function serializeDocument(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

async function measure() {
  const require = createRequire(import.meta.url);
  let parser;
  try {
    parser = require('../dist/core/logstrip-parser.js');
  } catch {
    throw new Error('dist/ not found - run `npm run build` first');
  }
  const names = (await readdir(FIXTURES_DIR)).filter((name) => name.endsWith('.log')).sort();
  const rows = [];
  for (const name of names) {
    const text = await readFile(path.join(FIXTURES_DIR, name), 'utf8');
    const result = await parser.processLogString(text);
    const id = name.replace(/\.log$/, '');
    rows.push({
      id,
      kind: kindOf(id),
      inputLines: result.stats.inputLines,
      outputLines: result.stats.outputLines,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      // Same rounding as `npm run bench`, so the two outputs match digit for digit.
      savingsPercent: Number(result.savingsPercent.toFixed(1)),
    });
  }
  return rows;
}

/** Every generated file and its new content. */
export function renderOutputs(doc) {
  return {
    [JSON_PATH]: serializeDocument(doc),
    [PAGE_PATH]: renderPage(readFileSync(PAGE_PATH, 'utf8'), doc),
    [README_PATH]: renderReadme(
      readFileSync(README_PATH, 'utf8'),
      doc,
      readFileSync(COMPARE_PATH, 'utf8'),
    ),
    ...renderBadges(doc),
  };
}

async function main() {
  const check = process.argv.includes('--check');
  const rows = await measure();
  const version = check
    ? JSON.parse(readFileSync(JSON_PATH, 'utf8')).logstripVersion
    : JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const doc = buildDocument(rows, version);
  const outputs = renderOutputs(doc);

  if (check) {
    const stale = Object.entries(outputs)
      .filter(([file, content]) => readFileSync(file, 'utf8') !== content)
      .map(([file]) => path.relative(root, file));
    if (stale.length > 0) {
      process.stderr.write(`export-benchmarks: stale, run "npm run docs:bench": ${stale.join(', ')}\n`);
      process.exit(1);
    }
    process.stdout.write('export-benchmarks: up to date\n');
    return;
  }

  for (const [file, content] of Object.entries(outputs)) writeFileSync(file, content);
  process.stdout.write(
    `export-benchmarks: ${doc.totals.fixtures} fixtures, ${pct(doc.totals.savingsPercent)} saved overall, ${Object.keys(outputs).length} files written\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`export-benchmarks: ${error.message}\n`);
    process.exit(1);
  });
}
