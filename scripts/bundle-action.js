#!/usr/bin/env node
const { buildSync } = require('esbuild');
const { resolve } = require('node:path');

const entryPoint = resolve(__dirname, '..', 'src', 'action', 'index.ts');
const outfile = resolve(__dirname, '..', 'dist', 'action', 'index.js');

buildSync({
  bundle: true,
  entryPoints: [entryPoint],
  format: 'cjs',
  logLevel: 'info',
  outfile,
  platform: 'node',
  sourcemap: false,
  target: 'node20',
});
