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

run(['raw.log', '-o', 'bonsai.log', '--stats']);
assertLine(readFileSync('bonsai.log', 'utf8'), expected, 'file output');

const stdinRun = run([], { input: rawLog });
writeFileSync('bonsai-stdin.log', stdinRun.stdout);
assertLine(stdinRun.stdout, expected, 'stdin output');

const jsonRun = run(['raw.log', '-o', 'bonsai.log', '--json']);
const report = JSON.parse(jsonRun.stdout);
if (typeof report.savingsPercent !== 'number') {
  console.error('json missing savingsPercent');
  process.exit(1);
}
