#!/usr/bin/env node

const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const LOG_FILE_EXTENSIONS = ['.log', '.out', '.txt', '.trace', '.err'];
const LOGSTRIP_COMMAND = 'logstrip';
const COMMAND_LOOKUP = process.platform === 'win32' ? 'where.exe' : 'which';
const POWERSHELL_COMMAND = process.platform === 'win32' ? 'powershell.exe' : null;

function writeJson(value) {
  process.stdout.write(JSON.stringify(value));
}

function isAlreadyCompressed(filePath) {
  return filePath.endsWith('.logstrip.log') || filePath.includes('.logstrip.');
}

function isSupportedLogFile(filePath) {
  return LOG_FILE_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}

function resolveLogstripCommand() {
  const result = spawnSync(COMMAND_LOOKUP, [LOGSTRIP_COMMAND], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  const [commandPath] = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return commandPath || null;
}

function runLogstrip(commandPath, filePath, outputFile) {
  if (process.platform === 'win32') {
    const escapePowerShell = (value) => value.replaceAll('\'', '\'\'');

    return spawnSync(
      POWERSHELL_COMMAND,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `& '${escapePowerShell(commandPath)}' '${escapePowerShell(filePath)}' -o '${escapePowerShell(outputFile)}' --stats`,
      ],
      {
        stdio: 'ignore',
      },
    );
  }

  return spawnSync(
    commandPath,
    [filePath, '-o', outputFile, '--stats'],
    { stdio: 'ignore' },
  );
}

function countMatchingLines(text, pattern) {
  let count = 0;

  for (const line of text.split(/\r?\n/)) {
    pattern.lastIndex = 0;
    if (pattern.test(line)) {
      count += 1;
    }
  }

  return count;
}

function handlePreToolUse(input) {
  if (input.tool_name !== 'Read') {
    return;
  }

  const filePath = input.tool_input?.file_path;
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return;
  }

  if (isAlreadyCompressed(filePath) || !isSupportedLogFile(filePath) || !existsSync(filePath)) {
    return;
  }

  const commandPath = resolveLogstripCommand();
  if (!commandPath) {
    writeJson({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: 'LogStrip: this is a log file. Install logstrip (npm i -g logstrip) to auto-compress before analysis.',
      },
    });
    return;
  }

  const outputFile = `${filePath}.logstrip.log`;
  const result = runLogstrip(commandPath, filePath, outputFile);

  if (!result.error && result.status === 0) {
    writeJson({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `LogStrip: auto-compressed ${filePath} -> ${outputFile}. Read the compressed .logstrip.log file instead.`,
      },
    });
    return;
  }

  writeJson({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: 'LogStrip: compression failed for this log file. Analysing raw content.',
    },
  });
}

function handleUserPromptSubmit(input) {
  const prompt = input.prompt;
  if (typeof prompt !== 'string' || prompt.length === 0) {
    return;
  }

  const lines = prompt.split(/\r?\n/).length;
  if (lines < 5) {
    return;
  }

  let score = 0;

  if (countMatchingLines(prompt, /([0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}|[0-9]{2}:[0-9]{2}:[0-9]{2}[.,][0-9]{3})/) >= 2) {
    score += 1;
  }

  if (countMatchingLines(prompt, /\[(INFO|ERROR|WARN|DEBUG|TRACE|FATAL|WARNING)\]|(^|\s)(ERROR|WARNING|FATAL|INFO):|npm (ERR|WARN)!/i) >= 2) {
    score += 1;
  }

  const stackTraceLines = countMatchingLines(prompt, /at [a-zA-Z][a-zA-Z0-9_$]+\.[a-zA-Z]/);
  if (stackTraceLines >= 1) {
    score += 1;
  }
  if (stackTraceLines >= 3) {
    score += 1;
  }

  if (countMatchingLines(prompt, /(FAIL|PASS|SKIP|RUN)\b|npm ERR!|cargo (error|warning)|make\[|pytest|jest|mocha/i) >= 2) {
    score += 1;
  }

  if (countMatchingLines(prompt, /^\s*(npm ERR|npm WARN|yarn error|FAIL|PASS|SKIP|RUN|OK|ERR!|WARN!|\[ERROR\]|\[INFO\]|\[WARN\]|\[DEBUG\]|\[FATAL\]|\[TRACE\]|FATAL:|ERROR:|WARNING:)/i) >= 2) {
    score += 1;
  }

  if (score < 2) {
    return;
  }

  writeJson({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: 'LogStrip auto-activation: pasted log output detected. Before analysing, write the pasted content to a temp file and run `logstrip <file> -o <file>.logstrip.log --stats`, then read the compressed output. If logstrip is not installed, suggest `npm i -g logstrip`. Do not analyse the raw pasted logs line-by-line.',
    },
  });
}

async function main() {
  let inputText = '';

  for await (const chunk of process.stdin) {
    inputText += chunk.toString();
  }

  let input;
  try {
    input = JSON.parse(inputText);
  } catch {
    return;
  }

  switch (input?.hook_event_name) {
    case 'PreToolUse':
      handlePreToolUse(input);
      return;
    case 'UserPromptSubmit':
      handleUserPromptSubmit(input);
      return;
    default:
      return;
  }
}

main().catch(() => {
  process.exitCode = 0;
});
