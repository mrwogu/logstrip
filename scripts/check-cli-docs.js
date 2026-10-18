#!/usr/bin/env node
// Fails when a --flag in the CLI help text is not documented in
// docs/reference/cli.md or README.md. The flag list is parsed from HELP_TEXT
// in dist/cli/index.js, so run `npm run build` first.
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const cliEntry = resolve(root, 'dist', 'cli', 'index.js');
const docFiles = ['docs/reference/cli.md', 'README.md'];

const FLAG_PATTERN = /--[a-z][a-z0-9-]*/g;
// An option line in the help text: indented, optional short alias, then the long flag.
const OPTION_LINE_PATTERN = /^\s+(?:-[a-zA-Z],\s+)?(--[a-z][a-z0-9-]*)/;

function fail(message) {
  console.error(`docs:check: ${message}`);
  process.exit(1);
}

function helpFlags(helpText) {
  const flags = new Set();
  let inOptions = false;
  for (const line of helpText.split(/\r?\n/)) {
    if (/^Options:\s*$/.test(line)) {
      inOptions = true;
      continue;
    }
    if (inOptions && /^\S/.test(line)) break;
    const match = inOptions ? OPTION_LINE_PATTERN.exec(line) : null;
    if (match) flags.add(match[1]);
  }
  return flags;
}

// Flags count as documented only where they are defined: the first column of a
// markdown table, or an option listing inside a fenced code block. A flag that
// is merely mentioned in prose does not count.
function documentedFlags(markdown) {
  const flags = new Set();
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      const match = OPTION_LINE_PATTERN.exec(line);
      if (match) flags.add(match[1]);
      continue;
    }
    const firstCell = /^\|\s*((?:\\\||[^|])*)\|/.exec(line);
    if (firstCell) {
      for (const flag of firstCell[1].match(FLAG_PATTERN) ?? []) flags.add(flag);
    }
  }
  return flags;
}

if (!existsSync(cliEntry)) fail(`missing ${cliEntry}; run "npm run build" first`);

const { HELP_TEXT } = require(cliEntry);
if (typeof HELP_TEXT !== 'string') fail('dist/cli/index.js does not export HELP_TEXT');

const expected = helpFlags(HELP_TEXT);
if (expected.size === 0) fail('found no flags in the "Options:" section of HELP_TEXT');

let failed = false;
for (const file of docFiles) {
  const path = resolve(root, file);
  if (!existsSync(path)) fail(`missing ${file}`);
  const documented = documentedFlags(readFileSync(path, 'utf8'));
  const missing = [...expected].filter((flag) => !documented.has(flag));
  if (missing.length > 0) {
    failed = true;
    console.error(`docs:check: ${file} is missing: ${missing.join(', ')}`);
  }
}

if (failed) process.exit(1);
console.log(`docs:check: ${expected.size} CLI flags documented in ${docFiles.join(' and ')}`);
