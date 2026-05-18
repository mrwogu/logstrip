#!/usr/bin/env node
const { chmodSync, readFileSync, writeFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const cliEntry = resolve(__dirname, '..', 'dist', 'cli', 'index.js');

if (!existsSync(cliEntry)) {
  console.error(`post-build: missing ${cliEntry}`);
  process.exit(1);
}

const source = readFileSync(cliEntry, 'utf8');
const shebang = '#!/usr/bin/env node\n';

if (!source.startsWith(shebang)) {
  writeFileSync(cliEntry, shebang + source.replace(/^#![^\n]*\n/, ''));
}

if (process.platform !== 'win32') {
  chmodSync(cliEntry, 0o755);
}
