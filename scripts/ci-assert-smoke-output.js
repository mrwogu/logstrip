#!/usr/bin/env node
const { existsSync, readFileSync } = require('node:fs');

const outputPath = process.argv[2] ?? 'raw.logstrip.log';
const expected = '[x2] [ERROR] request [ID] failed';

if (!existsSync(outputPath)) {
  console.error(`missing output file: ${outputPath}`);
  process.exit(1);
}

const output = readFileSync(outputPath, 'utf8');
if (!output.split(/\r?\n/).includes(expected)) {
  console.error(`output did not contain exact line: ${expected}`);
  process.exit(1);
}
