#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const rawLog = [
  '[INFO] boot ok',
  '[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed',
  '[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed',
  '',
].join('\n');
const expected = '[x2] [ERROR] request [ID] failed';
const cliPath = join('dist', 'cli', 'index.js');

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    ...options,
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    process.exit(result.status ?? 1);
  }

  return result;
}

function assertLine(value, line, label) {
  if (!value.split(/\r?\n/).includes(line)) {
    console.error(`${label} did not contain exact line: ${line}`);
    process.exit(1);
  }
}

writeFileSync('raw.log', rawLog);

run(['raw.log', '-o', 'logstrip.log', '--stats']);
assertLine(readFileSync('logstrip.log', 'utf8'), expected, 'file output');

const stdinRun = run([], { input: rawLog });
writeFileSync('logstrip-stdin.log', stdinRun.stdout);
assertLine(stdinRun.stdout, expected, 'stdin output');

const jsonRun = run(['raw.log', '-o', 'logstrip.log', '--json']);
const report = JSON.parse(jsonRun.stdout);
if (typeof report.savingsPercent !== 'number') {
  console.error('json missing savingsPercent');
  process.exit(1);
}

// Text that is not a log is copied through unchanged; --force compresses it.
const notes = [
  '# Release notes',
  '',
  'This release improves the way the parser handles very long input files.',
  '',
  '- Faster startup for small inputs.',
  '- Better handling of repeated errors in watch mode.',
  '',
].join('\n');
const notesRun = run([], { input: notes });
if (notesRun.stdout !== notes) {
  console.error('text passthrough changed the input');
  process.exit(1);
}
const forcedRun = run(['--force'], { input: notes });
if (forcedRun.stdout === notes) {
  console.error('--force did not compress the text input');
  process.exit(1);
}
