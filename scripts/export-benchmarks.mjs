#!/usr/bin/env node
// Measures every tests/fixtures/*.log with the built parser and writes the
// numbers the documentation shows:
//
//   apps/docs/src/data/benchmarks.json   read by the homepage at build time
//   docs/benchmarks.md                   generated blocks between bench markers
//
// Both come from one run, so the homepage and the benchmarks page cannot
// disagree. The output holds no timestamps and no timings: the same parser on
// the same fixtures writes the same bytes.
//
//   npm run build && npm run docs:bench
//   node scripts/export-benchmarks.mjs --check   # exit 1 when files are stale
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

export const KIND_LABELS = {
  single: 'Single-tool logs',
  mixed: 'Multi-tool samples',
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
    KIND_LABELS[fixture.kind],
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

const markerStart = (name) => `<!-- bench:${name}:start -->`;
const markerEnd = (name) => `<!-- bench:${name}:end -->`;

/** Replaces the text between the start and end markers of one block. */
export function injectBlock(markdown, name, content) {
  const start = markdown.indexOf(markerStart(name));
  const end = markdown.indexOf(markerEnd(name));
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`benchmarks page is missing the "${name}" markers`);
  }
  const head = markdown.slice(0, start + markerStart(name).length);
  return `${head}\n${content}\n${markdown.slice(end)}`;
}

/** The whole page with every generated block refreshed from the document. */
export function renderPage(markdown, doc) {
  return Object.entries(BLOCKS).reduce(
    (page, [name, render]) => injectBlock(page, name, render(doc)),
    markdown,
  );
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

async function main() {
  const check = process.argv.includes('--check');
  const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const doc = buildDocument(await measure(), version);
  const json = serializeDocument(doc);
  const page = renderPage(readFileSync(PAGE_PATH, 'utf8'), doc);

  if (check) {
    const stale = [];
    if (readFileSync(JSON_PATH, 'utf8') !== json) stale.push(path.relative(root, JSON_PATH));
    if (readFileSync(PAGE_PATH, 'utf8') !== page) stale.push(path.relative(root, PAGE_PATH));
    if (stale.length > 0) {
      process.stderr.write(`export-benchmarks: stale, run "npm run docs:bench": ${stale.join(', ')}\n`);
      process.exit(1);
    }
    process.stdout.write('export-benchmarks: up to date\n');
    return;
  }

  writeFileSync(JSON_PATH, json);
  writeFileSync(PAGE_PATH, page);
  process.stdout.write(
    `export-benchmarks: ${doc.totals.fixtures} fixtures, ${pct(doc.totals.savingsPercent)} saved overall\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`export-benchmarks: ${error.message}\n`);
    process.exit(1);
  });
}
