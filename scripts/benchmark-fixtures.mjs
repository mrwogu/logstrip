#!/usr/bin/env node
// Per-fixture compression benchmark for data-driven threshold tuning.
//
// Runs the built parser over every tests/fixtures/*.log and prints one row
// per fixture: line counts, token counts, token savings and the per-reason
// drop histogram. Token counts use the same word-based estimate as the CLI
// (--stats), so before/after tables stay comparable across commits.
// Use it before changing scoring weights, regex tables or smoke-case
// thresholds (minSavingsPercent) so the numbers are grounded, not guessed.
//
//   npm run build && npm run bench
//   npm run bench -- nginx          # only fixtures whose name contains "nginx"

import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(here, '../tests/fixtures');
const require = createRequire(import.meta.url);

let parser;
try {
  parser = require('../dist/core/logstrip-parser.js');
} catch {
  process.stderr.write('benchmark: dist/ not found - run `npm run build` first\n');
  process.exit(1);
}

const filter = process.argv[2];
const entries = (await readdir(fixturesDir))
  .filter((name) => name.endsWith('.log') && !name.endsWith('.logstrip.log'))
  .filter((name) => (filter === undefined ? true : name.includes(filter)))
  .sort();

if (entries.length === 0) {
  process.stderr.write('benchmark: no fixtures matched\n');
  process.exit(1);
}

const rows = [];
for (const name of entries) {
  const text = await readFile(path.join(fixturesDir, name), 'utf8');
  const reasons = new Map();
  const started = process.hrtime.bigint();
  const result = await parser.processLogString(text, {
    onDecision: (decision) => {
      if (decision.dropped) {
        reasons.set(decision.reason, (reasons.get(decision.reason) ?? 0) + 1);
      }
    },
  });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  const topReasons = [...reasons.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(' ');

  rows.push({
    fixture: name,
    in: result.stats.inputLines,
    out: result.stats.outputLines,
    inTok: result.inputTokens,
    outTok: result.outputTokens,
    savings: `${result.savingsPercent.toFixed(1)}%`,
    ms: elapsedMs.toFixed(1),
    topReasons,
  });
}

const headers = ['fixture', 'in', 'out', 'inTok', 'outTok', 'savings', 'ms', 'top drop reasons'];
const keys = ['fixture', 'in', 'out', 'inTok', 'outTok', 'savings', 'ms'];
const widths = keys.map((key, index) =>
  Math.max(...rows.map((row) => String(row[key]).length), headers[index].length),
);

const pad = (value, width) => String(value).padEnd(width);
const padNum = (value, width) => String(value).padStart(width);
const formatRow = (cells, reasons) =>
  `${cells.map((cell, index) => (index === 0 ? pad(cell, widths[0]) : padNum(cell, widths[index]))).join('  ')}  ${reasons}\n`;

process.stdout.write(formatRow(headers.slice(0, keys.length), headers[keys.length]));
for (const row of rows) {
  process.stdout.write(
    formatRow(
      keys.map((key) => row[key]),
      row.topReasons,
    ),
  );
}

const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
const totalIn = sum('in');
const totalOut = sum('out');
const totalInTok = sum('inTok');
const totalOutTok = sum('outTok');
process.stdout.write(
  `\n${rows.length} fixtures, ${totalIn} lines in, ${totalOut} lines out (${(100 - (totalOut / totalIn) * 100).toFixed(1)}% line reduction)\n` +
    `${totalInTok} tokens in, ${totalOutTok} tokens out (${(100 - (totalOutTok / totalInTok) * 100).toFixed(1)}% token reduction)\n`,
);
