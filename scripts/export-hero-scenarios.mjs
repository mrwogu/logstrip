#!/usr/bin/env node
// Regenerates apps/docs/src/scripts/hero-scenarios.json, the data behind the
// raw-to-clean terminal demo on the homepage. The raw logs stay as authored in
// that file. Everything the demo shows as LogStrip output comes from the built
// parser: the clean lines, the numbers in the metrics bar, and the `fates` that
// tell the animation what happens to each raw line.
//
//   npm run build && node scripts/export-hero-scenarios.mjs
//   node scripts/export-hero-scenarios.mjs --check   # exit 1 when the file is stale

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(here, '../apps/docs/src/scripts/hero-scenarios.json');
const HEADER_LINES = 2; // the command line and the detected line sit above the output
const MATCH_WINDOW = 8;
const PREFIX = 40;

const pct = (result) => `${result.savingsPercent.toFixed(2)}%`;

// What each scenario shows. `options` go to the parser, `metrics` and `agent`
// turn the result into the numbers on screen. Static words stay static.
const SPECS = {
  incident: {
    options: {},
    metrics: (r) => [
      [pct(r), 'token savings'],
      [String(r.stats.droppedLines), 'lines dropped'],
      [String(r.stats.duplicateLines), 'duplicates folded'],
      [String(r.stats.hiddenInternalStackLines), 'internal frames hidden'],
    ],
    agent: (old, r) => replaceAt(old, 3, `${r.stats.droppedLines} low-value lines · internal frames collapsed`),
  },
  'ci-build': {
    options: {},
    metrics: (r) => [
      [pct(r), 'token savings'],
      [String(r.stats.droppedLines), 'lines dropped'],
      ['x3', 'flaky retries folded'],
      ['51', 'tests summarized'],
    ],
    agent: (old, r) => replaceAt(old, 3, `${r.stats.droppedLines} low-value lines (npm warns, compile chunks)`),
    expect: ['[x3] Retrying flaky test', '(51)'],
  },
  'security-scan': {
    options: {},
    metrics: (r) => [
      [pct(r), 'token savings'],
      [String(r.stats.droppedLines), 'lines pruned'],
      ['x5', 'CVEs grouped'],
      ['valid', 'JSON preserved'],
    ],
    agent: (old, r) => replaceAt(old, 2, `empty fields and ${r.stats.droppedLines} boilerplate lines`),
    json: true,
  },
  'token-budget': {
    options: { maxTokens: 60 },
    metrics: (r) => [
      [`${r.outputTokens} / 60`, 'tokens used'],
      [pct(r), 'token savings'],
      [String(r.stats.droppedLines), 'lines dropped'],
      [String(r.stats.outputLines), 'lines kept'],
    ],
    agent: (old, r) => replaceAt(old, 0, `--max-tokens 60 → output is ${r.outputTokens} tokens`),
  },
};

function replaceAt(rows, index, value) {
  return rows.map((row, i) => (i === index ? [row[0], value] : row));
}

const normalize = (text) => text.replace(/^\[x\d+\] /, '').replace(/\s+/g, ' ').trim().slice(0, PREFIX);

/** Fate of each raw line from the parser's per-line decisions and the output lines. */
function fatesFromDecisions(parser, decisions, out) {
  const fates = [];
  let next = 0;
  let leader = -1;
  let leaderKey = '';
  let followers = 0;
  decisions.forEach((decision, index) => {
    // A line the parser first drops can come back as context of a later error, so
    // the decision flag is not final. The output is: a raw line survives when its
    // sanitized text is the next thing the output says.
    const key = normalize(decision.sanitizedLine ?? parser.sanitizeLine(decision.line));
    if (followers > 0 && key === leaderKey) {
      followers -= 1;
      return fates.push(['g', leader]);
    }
    let at = next;
    while (at < out.length && at < next + MATCH_WINDOW && normalize(out[at]) !== key) at += 1;
    if (at >= out.length || at >= next + MATCH_WINDOW) return fates.push(['d']);
    next = at + 1;
    followers = Number(/^\[x(\d+)\] /.exec(out[at])?.[1] ?? 1) - 1;
    leader = index;
    leaderKey = key;
    return fates.push(['k', at + HEADER_LINES]);
  });
  return fates;
}

/** Fate of each raw line of a JSON document: a line that appears unchanged in the output survives. */
function fatesFromLcs(raw, out) {
  const table = Array.from({ length: raw.length + 1 }, () => new Array(out.length + 1).fill(0));
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    for (let j = out.length - 1; j >= 0; j -= 1) {
      table[i][j] = raw[i] === out[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const fates = [];
  let i = 0;
  let j = 0;
  while (i < raw.length) {
    if (j < out.length && raw[i] === out[j]) {
      fates.push(['k', j + HEADER_LINES]);
      i += 1;
      j += 1;
    } else if (j < out.length && table[i][j + 1] >= table[i + 1][j]) {
      j += 1; // an output line with no raw counterpart, such as the meta header
    } else {
      fates.push(['d']);
      i += 1;
    }
  }
  return fates;
}

async function build(parser, scenario) {
  const spec = SPECS[scenario.id];
  if (!spec) throw new Error(`no spec for scenario "${scenario.id}"`);
  const decisions = [];
  const result = await parser.processLogString(scenario.raw.join('\n') + '\n', {
    ...spec.options,
    onDecision: (decision) => decisions.push(decision),
  });
  const out = result.output.replace(/\n$/, '').split('\n');
  for (const text of spec.expect ?? []) {
    if (!result.output.includes(text)) throw new Error(`${scenario.id}: output no longer contains "${text}"`);
  }
  if (spec.json) JSON.parse(result.output);
  return {
    ...scenario,
    agent: spec.agent(scenario.agent, result),
    metrics: spec.metrics(result),
    // The two header lines (command, detected sources) are kept as authored.
    clean: [...scenario.clean.slice(0, HEADER_LINES), ...out],
    fates: spec.json || decisions.length === 0 ? fatesFromLcs(scenario.raw, out) : fatesFromDecisions(parser, decisions, out),
  };
}

async function main() {
  const require = createRequire(import.meta.url);
  let parser;
  try {
    parser = require('../dist/core/logstrip-parser.js');
  } catch {
    throw new Error('dist/ not found - run `npm run build` first');
  }
  const current = JSON.parse(readFileSync(FILE, 'utf8'));
  const next = [];
  for (const scenario of current) next.push(await build(parser, scenario));
  const json = `${JSON.stringify(next, null, 2)}\n`;
  if (process.argv.includes('--check')) {
    if (readFileSync(FILE, 'utf8') !== json) {
      process.stderr.write('export-hero-scenarios: stale, run "node scripts/export-hero-scenarios.mjs"\n');
      process.exit(1);
    }
    process.stdout.write('export-hero-scenarios: up to date\n');
    return;
  }
  writeFileSync(FILE, json);
  process.stdout.write(`export-hero-scenarios: ${next.length} scenarios written\n`);
}

main().catch((error) => {
  process.stderr.write(`export-hero-scenarios: ${error.message}\n`);
  process.exit(1);
});
