#!/usr/bin/env node
// Assembles the agent plugin package (plugins/logstrip/**) from PromptScript.
//
// The plugin package format is defined by each platform's plugin loader
// (./skills/, ./commands/, ./agents/, ./rules/, codex/.codex/**, ...), which
// differs from PromptScript's repo-config output layout. This script bridges
// the two: it compiles the dedicated plugin build profiles to a staging dir and
// copies each emitted file into its package path.
//
// PromptScript emits every instruction body, but a few package frontmatter
// fields cannot be expressed in the language (Cursor rule globs/alwaysApply,
// command argument-hint, GitHub prompt `mode`, instructions `applyTo`). For
// those, this script owns the frontmatter and wraps/injects the PromptScript
// body. The non-deterministic generated-at comment is stripped so re-running
// the build is idempotent.
//
// Manifests (.*-plugin/plugin.json, .github/plugin.json) and hooks
// (hooks/*.json) are hand-maintained and never touched here.
// Requires the PromptScript CLI (`prs`) on PATH.
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { resolve, dirname, join } = require('node:path');
const { tmpdir } = require('node:os');

const repoRoot = resolve(__dirname, '..');
const pluginConfig = resolve(repoRoot, '.promptscript', 'plugin', 'promptscript.plugin.yaml');

const CURSOR_RULE_MAIN_FM = [
  '---',
  'description: Compress noisy logs with LogStrip before investigating failures.',
  'globs: **/*.log,**/*.out,**/*.txt',
  'alwaysApply: false',
  '---',
].join('\n');

const CURSOR_RULE_PASTE_FM = [
  '---',
  'description: Auto-detect pasted log output and compress it with LogStrip before analysis.',
  'alwaysApply: true',
  '---',
].join('\n');

const GITHUB_INSTRUCTIONS_FM = ['---', 'applyTo: "**/*.log,**/*.out,**/*.txt"', '---'].join('\n');

const COMMAND_ARGUMENT_HINT =
  'argument-hint: <input-log> [--output <output-log>] [--aggressiveness low|medium|high|aggressive|auto]';

// profile: named build in promptscript.plugin.yaml
// staged: path emitted by the target inside the staging dir
// dest: package destination(s) relative to repoRoot
// op: how to turn the staged file into the package file
//   - 'body':   strip PromptScript scaffolding -> body only
//   - 'copy':   keep native frontmatter+body, drop the generated-at comment
//   - 'inject': like 'copy' but add extra frontmatter lines
//   - 'wrap':   body + a script-owned frontmatter block
const FILES = [
  { profile: 'plugin-codex', staged: 'AGENTS.md', dest: 'plugins/logstrip/codex/AGENTS.md', op: 'body' },
  { profile: 'plugin-codex', staged: '.agents/skills/logstrip/SKILL.md', dest: 'plugins/logstrip/codex/.codex/skills/logstrip/SKILL.md', op: 'copy' },
  { profile: 'plugin-opencode', staged: 'OPENCODE.md', dest: 'plugins/logstrip/opencode/AGENTS.md', op: 'body' },
  { profile: 'plugin-opencode', staged: '.opencode/skills/logstrip/SKILL.md', dest: 'plugins/logstrip/opencode/.opencode/skills/logstrip/SKILL.md', op: 'copy' },
  { profile: 'plugin-opencode-command', staged: '.opencode/commands/logstrip.md', dest: 'plugins/logstrip/opencode/.opencode/commands/logstrip.md', op: 'copy' },
  { profile: 'plugin-claude', staged: '.claude/skills/logstrip/SKILL.md', dest: 'plugins/logstrip/skills/logstrip/SKILL.md', op: 'copy' },
  { profile: 'plugin-claude', staged: '.claude/commands/logstrip.md', dest: 'plugins/logstrip/commands/logstrip.md', op: 'inject', inject: [COMMAND_ARGUMENT_HINT] },
  { profile: 'plugin-claude', staged: '.claude/agents/logstrip-reviewer.md', dest: 'plugins/logstrip/agents/logstrip-reviewer.md', op: 'copy' },
  { profile: 'plugin-claude', staged: '.claude/agents/logstrip-fixture-author.md', dest: 'plugins/logstrip/agents/logstrip-fixture-author.md', op: 'copy' },
  { profile: 'plugin-github', staged: '.github/copilot-instructions.md', dest: 'plugins/logstrip/.github/copilot-instructions.md', op: 'body' },
  { profile: 'plugin-github', staged: '.github/prompts/logstrip.prompt.md', dest: 'plugins/logstrip/.github/prompts/logstrip.prompt.md', op: 'inject', inject: ['mode: agent'] },
  { profile: 'plugin-factory', staged: '.factory/droids/logstrip-reviewer.md', dest: 'plugins/logstrip/droids/logstrip-reviewer.md', op: 'copy' },
  { profile: 'plugin-factory', staged: '.factory/droids/logstrip-fixture-author.md', dest: 'plugins/logstrip/droids/logstrip-fixture-author.md', op: 'copy' },
  { profile: 'plugin-cursor-rule-main', staged: 'AGENTS.md', dest: ['plugins/logstrip/rules/logstrip.mdc', 'plugins/logstrip/cursor/.cursor/rules/logstrip.mdc'], op: 'wrap', frontmatter: CURSOR_RULE_MAIN_FM },
  { profile: 'plugin-cursor-rule-paste', staged: 'AGENTS.md', dest: ['plugins/logstrip/rules/logstrip-paste-detect.mdc', 'plugins/logstrip/cursor/.cursor/rules/logstrip-paste-detect.mdc'], op: 'wrap', frontmatter: CURSOR_RULE_PASTE_FM },
  { profile: 'plugin-github-instructions', staged: 'AGENTS.md', dest: 'plugins/logstrip/.github/instructions/logstrip.instructions.md', op: 'wrap', frontmatter: GITHUB_INSTRUCTIONS_FM },
];

// Strip the formatter scaffolding so the file starts at its own top-level
// heading. The reliable anchor is the marker comment: everything up to and
// including it (an optional file-label title the formatter prepends) is
// scaffolding, followed by an optional "## Project" section wrapper.
function toBody(raw) {
  let lines = raw.split('\n');
  const trimLeading = () => {
    while (lines.length && lines[0].trim() === '') lines.shift();
  };
  const markerIdx = lines.findIndex((l) => /^<!--\s*PromptScript\b.*-->\s*$/.test(l));
  if (markerIdx !== -1) {
    lines = lines.slice(markerIdx + 1);
  }
  trimLeading();
  if (lines.length && /^##\s+project\s*$/i.test(lines[0])) {
    lines.shift();
    trimLeading();
  }
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.join('\n') + '\n';
}

// Drop the non-deterministic generated-at comment from a YAML frontmatter
// block so repeated builds are byte-stable.
function dropGeneratedComment(raw) {
  return raw
    .split('\n')
    .filter((line) => !/^#\s*promptscript-generated:/.test(line))
    .join('\n');
}

// Insert extra frontmatter lines just before the closing delimiter.
function injectFrontmatter(raw, extraLines) {
  const lines = dropGeneratedComment(raw).split('\n');
  if (lines[0].trim() !== '---') {
    throw new Error('injectFrontmatter: expected leading frontmatter delimiter');
  }
  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      close = i;
      break;
    }
  }
  if (close === -1) throw new Error('injectFrontmatter: unterminated frontmatter');
  lines.splice(close, 0, ...extraLines);
  return lines.join('\n');
}

function transform(raw, file) {
  switch (file.op) {
    case 'body':
      return toBody(raw);
    case 'copy':
      return dropGeneratedComment(raw);
    case 'inject':
      return injectFrontmatter(raw, file.inject);
    case 'wrap':
      return file.frontmatter + '\n\n' + toBody(raw);
    default:
      throw new Error('unknown op: ' + file.op);
  }
}

function run() {
  const staging = mkdtempSync(join(tmpdir(), 'logstrip-plugins-'));
  try {
    const profiles = [...new Set(FILES.map((f) => f.profile))];
    for (const profile of profiles) {
      execFileSync('prs', ['build', profile, '-c', pluginConfig, '-o', join(staging, profile), '--force'], {
        cwd: repoRoot,
        stdio: ['ignore', 'ignore', 'inherit'],
      });
    }
    for (const file of FILES) {
      const raw = readFileSync(join(staging, file.profile, file.staged), 'utf8');
      const out = transform(raw, file);
      for (const dest of [].concat(file.dest)) {
        const destPath = resolve(repoRoot, dest);
        mkdirSync(dirname(destPath), { recursive: true });
        writeFileSync(destPath, out);
        console.log('build-plugins: wrote ' + dest);
      }
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
    console.error('build-plugins: ' + (err && err.message ? err.message : err));
  }
  process.exit(1);
}
