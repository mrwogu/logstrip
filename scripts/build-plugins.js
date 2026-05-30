#!/usr/bin/env node
// Assembles PromptScript-generated instruction bodies into the agent plugin
// package layout (plugins/logstrip/**). The plugin package format is defined by
// each platform's plugin loader (./skills/, ./commands/, ./hooks/, ...), which
// differs from PromptScript's repo-config output layout, so this script bridges
// the two: it compiles the dedicated plugin build profiles to a staging dir and
// copies the relevant files into the package, stripping formatter artifacts.
//
// Manifests (.*/plugin.json) and hooks (hooks/*.json) are hand-maintained and
// never touched here. Requires the PromptScript CLI (`prs`) on PATH.
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { resolve, dirname, join } = require('node:path');
const { tmpdir } = require('node:os');

const repoRoot = resolve(__dirname, '..');
const pluginConfig = resolve(repoRoot, '.promptscript', 'plugin', 'promptscript.plugin.yaml');

// profile: named build in promptscript.plugin.yaml
// staged: file emitted by the target inside the staging dir
// dest: destination inside the plugin package (relative to repoRoot)
const BUILDS = [
  { profile: 'plugin-codex', staged: 'AGENTS.md', dest: 'plugins/logstrip/codex/AGENTS.md' },
  { profile: 'plugin-opencode', staged: 'OPENCODE.md', dest: 'plugins/logstrip/opencode/AGENTS.md' },
];

// Strip the formatter scaffolding (an optional "# <FILE>.md" title, the
// PromptScript marker comment, and the "## Project" section wrapper) so the
// plugin file starts at its own top-level heading.
function toPluginBody(raw) {
  let lines = raw.split('\n');
  const trimLeading = () => {
    while (lines.length && lines[0].trim() === '') lines.shift();
  };
  trimLeading();
  if (lines.length && /^#\s+[A-Za-z0-9._-]+\.md\s*$/.test(lines[0])) {
    lines.shift();
    trimLeading();
  }
  if (lines.length && /^<!--\s*PromptScript\b.*-->\s*$/.test(lines[0])) {
    lines.shift();
    trimLeading();
  }
  if (lines.length && lines[0].trim() === '## Project') {
    lines.shift();
    trimLeading();
  }
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.join('\n') + '\n';
}

function run() {
  const staging = mkdtempSync(join(tmpdir(), 'logstrip-plugins-'));
  try {
    for (const build of BUILDS) {
      const outDir = join(staging, build.profile);
      execFileSync(
        'prs',
        ['build', build.profile, '-c', pluginConfig, '-o', outDir, '--force'],
        { cwd: repoRoot, stdio: ['ignore', 'ignore', 'inherit'] },
      );
      const stagedPath = join(outDir, build.staged);
      const body = toPluginBody(readFileSync(stagedPath, 'utf8'));
      const destPath = resolve(repoRoot, build.dest);
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, body);
      console.log(`build-plugins: wrote ${build.dest}`);
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

try {
  run();
} catch (err) {
  if (err && err.code === 'ENOENT') {
    console.error('build-plugins: PromptScript CLI (`prs`) not found on PATH. Install it with `npm i -g @promptscript/cli`.');
  } else {
    console.error(`build-plugins: ${err && err.message ? err.message : err}`);
  }
  process.exit(1);
}
