#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { chmodSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { delimiter, join, resolve } = require('node:path');

const repoRoot = resolve(__dirname, '..');
const sourcePluginRoot = resolve(repoRoot, 'plugins', 'logstrip');
const cliPath = resolve(repoRoot, 'dist', 'cli', 'index.js');
const expectedLine = '[x2] [ERROR] request [ID] failed';
const expectedHookCommand = 'logstrip hook';
const pluginManifestPaths = [
  '.factory-plugin/plugin.json',
  '.claude-plugin/plugin.json',
  '.github/plugin.json',
  '.codex-plugin/plugin.json',
  '.cursor-plugin/plugin.json',
];
const rawLog = [
  '[INFO] boot ok',
  '[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed',
  '[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed',
  '2024-01-15 10:23:47.789 [WARN] retrying connection',
  '2024-01-15 10:23:48.012 [INFO] boot ok',
  '',
].join('\n');

function fail(message, result) {
  console.error(message);
  if (result?.stdout) {
    console.error(result.stdout);
  }
  if (result?.stderr) {
    console.error(result.stderr);
  }
  process.exit(1);
}

function createCliWrapper(binDir) {
  mkdirSync(binDir, { recursive: true });

  if (process.platform === 'win32') {
    writeFileSync(
      join(binDir, 'logstrip.cmd'),
      `@echo off\r\nnode "${cliPath}" %*\r\n`,
    );
    return;
  }

  const wrapperPath = join(binDir, 'logstrip');
  writeFileSync(wrapperPath, `#!/bin/sh\nexec node "${cliPath}" "$@"\n`);
  chmodSync(wrapperPath, 0o755);
}

function runHook(command, env, input, label) {
  if (command !== expectedHookCommand) {
    fail(`${label} hook command is not "${expectedHookCommand}": ${command}`);
  }

  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    input: JSON.stringify(input),
    env,
    timeout: 30_000,
  });

  if (result.status !== 0) {
    fail(`${label} hook command failed: ${command}`, result);
  }

  if (!result.stdout.trim()) {
    fail(`${label} hook command produced no JSON: ${command}`, result);
  }

  return JSON.parse(result.stdout);
}

function smokePreToolUse(command, pluginRoot, env, label) {
  const fixtureDir = join(pluginRoot, 'fixtures', label.replaceAll(/[^\w-]/g, '-'));
  mkdirSync(fixtureDir, { recursive: true });
  const inputPath = join(fixtureDir, 'raw.log');
  writeFileSync(inputPath, rawLog);

  const preToolUseResult = runHook(
    command,
    env,
    {
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: inputPath },
      session_id: 'plugin-smoke',
    },
    label,
  );

  if (preToolUseResult?.hookSpecificOutput?.permissionDecision !== 'deny') {
    fail(`${label} PreToolUse hook did not deny the raw read`);
  }

  const outputPath = `${inputPath}.logstrip.log`;
  if (!existsSync(outputPath)) {
    fail(`${label} PreToolUse hook did not create output file: ${outputPath}`);
  }

  const compressed = readFileSync(outputPath, 'utf8');
  if (!compressed.split(/\r?\n/).includes(expectedLine)) {
    fail(`${label} compressed output did not contain exact line: ${expectedLine}`);
  }
}

function smokeSharedHooks(manifestPath, pluginRoot, manifest, env) {
  if (manifest.hooks !== './hooks/hooks.json') {
    fail(`${manifestPath} did not point at ./hooks/hooks.json`);
  }

  const hooksConfig = JSON.parse(
    readFileSync(resolve(pluginRoot, manifest.hooks), 'utf8'),
  );
  const preToolUseCommand = hooksConfig.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command;
  const userPromptCommand = hooksConfig.hooks?.UserPromptSubmit?.[0]?.hooks?.[0]?.command;

  if (typeof preToolUseCommand !== 'string' || typeof userPromptCommand !== 'string') {
    fail(`${manifestPath} hooks config is missing expected commands`);
  }

  smokePreToolUse(preToolUseCommand, pluginRoot, env, manifestPath);

  const userPromptResult = runHook(
    userPromptCommand,
    env,
    {
      hook_event_name: 'UserPromptSubmit',
      prompt: rawLog,
      session_id: 'plugin-smoke',
    },
    manifestPath,
  );

  if (
    typeof userPromptResult?.hookSpecificOutput?.additionalContext !== 'string'
    || !userPromptResult.hookSpecificOutput.additionalContext.includes('logstrip <file>')
  ) {
    fail(`${manifestPath} UserPromptSubmit hook did not inject the expected context`);
  }
}

function smokeCursorHooks(manifestPath, pluginRoot, manifest, env) {
  if (manifest.hooks !== './hooks/cursor-hooks.json') {
    fail(`${manifestPath} did not point at ./hooks/cursor-hooks.json`);
  }

  const hooksConfig = JSON.parse(
    readFileSync(resolve(pluginRoot, manifest.hooks), 'utf8'),
  );
  const preToolUseCommand = hooksConfig.hooks?.preToolUse?.[0]?.command;

  if (typeof preToolUseCommand !== 'string') {
    fail(`${manifestPath} cursor hooks config is missing the preToolUse command`);
  }

  smokePreToolUse(preToolUseCommand, pluginRoot, env, manifestPath);
}

function main() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'logstrip plugin smoke '));
  const pluginRoot = join(tempRoot, 'plugin root');
  cpSync(sourcePluginRoot, pluginRoot, { recursive: true });

  try {
    const binDir = join(tempRoot, 'bin');
    createCliWrapper(binDir);

    const env = {
      ...process.env,
      PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
    };

    for (const manifestPath of pluginManifestPaths) {
      const manifest = JSON.parse(
        readFileSync(join(pluginRoot, manifestPath), 'utf8'),
      );

      if (manifest.hooks === './hooks/hooks.json') {
        smokeSharedHooks(manifestPath, pluginRoot, manifest, env);
        continue;
      }

      if (manifest.hooks === './hooks/cursor-hooks.json') {
        smokeCursorHooks(manifestPath, pluginRoot, manifest, env);
        continue;
      }

      fail(`${manifestPath} has unsupported hooks path: ${manifest.hooks ?? 'missing'}`);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();
