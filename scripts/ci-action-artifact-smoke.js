#!/usr/bin/env node
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const actionPackage = process.argv[2] ?? 'action-package';
const parserPath = resolve(actionPackage, 'dist', 'core', 'logstrip-parser.js');
const { processLogFile } = require(parserPath);
const expected = '[x2] [ERROR] request [ID] failed';

async function main() {
  writeFileSync(
    'raw.log',
    [
      '[INFO] boot ok',
      '[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed',
      '[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed',
      '',
    ].join('\n'),
  );

  await processLogFile('raw.log', 'logstrip.log');
  const output = readFileSync('logstrip.log', 'utf8');

  if (!output.split(/\r?\n/).includes(expected)) {
    console.error(
      `parser artifact output did not contain exact line: ${expected}`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
