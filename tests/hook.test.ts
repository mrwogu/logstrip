import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile, mkdir, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import * as process from 'node:process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HOOK_SCRIPT = resolve(
  __dirname,
  '../plugins/logstrip/hooks/logstrip-hook.js',
);
const HOOKS_JSON = resolve(__dirname, '../plugins/logstrip/hooks/hooks.json');
const CURSOR_HOOKS_JSON = resolve(
  __dirname,
  '../plugins/logstrip/hooks/cursor-hooks.json',
);
const FACTORY_PLUGIN_JSON = resolve(
  __dirname,
  '../plugins/logstrip/.factory-plugin/plugin.json',
);

const CLI_PATH = resolve(__dirname, '../dist/cli/index.js');

// ── helpers ──────────────────────────────────────────────────────────

interface HookResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

let binDir: string;
let hookEnv: Record<string, string | undefined>;

function runHookRaw(
  stdin: string,
  env: Record<string, string | undefined> = hookEnv,
): Promise<HookResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const child = spawn(process.execPath, [HOOK_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000,
      env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code: number | null) => {
      const durationMs = performance.now() - start;
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        durationMs,
      });
    });

    child.on('error', (err: Error) => {
      const durationMs = performance.now() - start;
      resolve({
        stdout,
        stderr: stderr + err.message,
        exitCode: -1,
        durationMs,
      });
    });

    child.stdin.write(stdin);
    child.stdin.end();
  });
}

function runHook(input: object): Promise<HookResult> {
  return runHookRaw(JSON.stringify(input));
}

function parseJson<T>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

function makePreToolUseInput(
  filePath: string,
  toolName = 'Read',
): object {
  return {
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: { file_path: filePath },
    session_id: 'test-session',
  };
}

function makeUserPromptSubmitInput(prompt: string): object {
  return {
    hook_event_name: 'UserPromptSubmit',
    prompt,
    session_id: 'test-session',
  };
}

// ── fixtures ──────────────────────────────────────────────────────────

const CI_LOG_PASTE = [
  '2024-01-15 10:23:45.123 [ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed',
  '2024-01-15 10:23:46.456 [ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed',
  '2024-01-15 10:23:47.789 [WARN]  retrying connection',
  '2024-01-15 10:23:48.012 [INFO]  boot ok',
  '2024-01-15 10:23:49.345 [ERROR] connection lost',
  '2024-01-15 10:23:50.678 [DEBUG] at com.example.Service.handle(Service.java:42)',
].join('\n');

const JAVA_STACK_PASTE = [
  'java.lang.NullPointerException',
  '    at com.example.checkout.CartService.calculateTotal(CartService.java:42)',
  '    at com.example.checkout.OrderService.processOrder(OrderService.java:118)',
  '    at com.example.api.CheckoutController.postOrder(CheckoutController.java:67)',
  '    at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)',
  '2024-03-12T14:32:01.456 [ERROR] Unhandled exception in checkout flow',
].join('\n');

const NPM_BUILD_PASTE = [
  'npm ERR! code ELIFECYCLE',
  'npm ERR! errno 1',
  'npm ERR! build-server@1.0.0 build: `tsc -p tsconfig.json`',
  'npm ERR! Exit status 1',
  'npm ERR! Failed at the build-server@1.0.0 build script.',
  'npm ERR! This is probably not a problem with npm.',
].join('\n');

const MIXED_CI_PASTE = [
  'FAIL  tests/integration/users.test.ts',
  'PASS  tests/unit/auth.test.ts',
  'SKIP  tests/e2e/deploy.test.ts',
  'RUN   tests/integration/orders.test.ts',
  'FAIL  tests/integration/orders.test.ts (2 failed)',
  '  ● Order Service › should create order',
].join('\n');

const SHORT_NON_LOG = 'Hello, how are you today?';

const CODE_DISCUSSION = [
  'I think we should refactor the authentication module.',
  'The current implementation uses callback-based patterns,',
  'but we could switch to async/await which is cleaner.',
  'What do you think about this approach?',
  'Let me know your thoughts.',
].join('\n');

const SINGLE_HEURISTIC = [
  '2024-01-15 10:23:45.123 something happened',
  '2024-01-15 10:23:46.456 something else happened',
  'This is just a regular message with timestamps',
  'But no log levels or CI markers anywhere',
  'So it should not trigger auto-detection',
].join('\n');

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'logstrip-hook-'));

  binDir = join(workDir, 'bin');
  await mkdir(binDir, { recursive: true });
  if (process.platform === 'win32') {
    await writeFile(
      join(binDir, 'logstrip.cmd'),
      `@echo off\r\nnode "${CLI_PATH}" %*\r\n`,
    );
  } else {
    const wrapper = join(binDir, 'logstrip');
    await writeFile(wrapper, `#!/bin/sh\nexec node "${CLI_PATH}" "$@"\n`);
    await chmod(wrapper, 0o755);
  }

  hookEnv = {
    ...process.env,
    PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
  };
});

afterAll(async () => {
  await rm(workDir, { force: true, recursive: true });
});

// ═══════════════════════════════════════════════════════════════════════
// PreToolUse - file extension matching
// ═══════════════════════════════════════════════════════════════════════

describe('PreToolUse - extension matching', () => {
  const logExtensions = ['.log', '.out', '.txt', '.trace', '.err'];

  it.each(logExtensions)('denies Read on %s file and redirects', async (ext) => {
    const filePath = join(workDir, `test${ext}`);
    await writeFile(filePath, CI_LOG_PASTE);

    const result = await runHook(makePreToolUseInput(filePath));
    expect(result.exitCode).toBe(0);

    const json = parseJson<{
      hookSpecificOutput: {
        hookEventName: string;
        permissionDecision: string;
        permissionDecisionReason: string;
      };
    }>(result.stdout);
    expect(json).not.toBeNull();
    expect(json!.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(json!.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(json!.hookSpecificOutput.permissionDecisionReason).toContain(
      '.logstrip.log',
    );
    expect(json!.hookSpecificOutput.permissionDecisionReason).toContain(
      filePath,
    );
  });

  const skipExtensions = ['.ts', '.js', '.json', '.yml', '.md', '.css', '.py'];

  it.each(skipExtensions)('skips Read on %s file', async (ext) => {
    const filePath = join(workDir, `test${ext}`);
    await writeFile(filePath, 'some content');

    const result = await runHook(makePreToolUseInput(filePath));
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PreToolUse - skip already-compressed files
// ═══════════════════════════════════════════════════════════════════════

describe('PreToolUse - skip already-compressed files', () => {
  it('skips .logstrip.log files', async () => {
    const filePath = join(workDir, 'already.logstrip.log');
    await writeFile(filePath, 'compressed content');

    const result = await runHook(makePreToolUseInput(filePath));
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('skips .logstrip.txt files', async () => {
    const filePath = join(workDir, 'already.logstrip.txt');
    await writeFile(filePath, 'compressed content');

    const result = await runHook(makePreToolUseInput(filePath));
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PreToolUse - non-existent files
// ═══════════════════════════════════════════════════════════════════════

describe('PreToolUse - non-existent files', () => {
  it('skips non-existent .log file', async () => {
    const filePath = join(workDir, 'nonexistent.log');

    const result = await runHook(makePreToolUseInput(filePath));
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PreToolUse - non-Read tools
// ═══════════════════════════════════════════════════════════════════════

describe('PreToolUse - non-Read tools', () => {
  it('skips Write tool even on .log file', async () => {
    const filePath = join(workDir, 'target.log');
    await writeFile(filePath, CI_LOG_PASTE);

    const result = await runHook(makePreToolUseInput(filePath, 'Write'));
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('skips Edit tool even on .log file', async () => {
    const filePath = join(workDir, 'target.log');
    await writeFile(filePath, CI_LOG_PASTE);

    const result = await runHook(makePreToolUseInput(filePath, 'Edit'));
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('skips Bash tool', async () => {
    const result = await runHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'cat /tmp/test.log' },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PreToolUse - empty file_path
// ═══════════════════════════════════════════════════════════════════════

describe('PreToolUse - missing file_path', () => {
  it('skips when tool_input has no file_path', async () => {
    const result = await runHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: {},
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PreToolUse - compression output
// ═══════════════════════════════════════════════════════════════════════

describe('PreToolUse - compression output', () => {
  it('creates .logstrip.log output file on disk', async () => {
    const filePath = join(workDir, 'compress-me.log');
    await writeFile(filePath, CI_LOG_PASTE);

    const result = await runHook(makePreToolUseInput(filePath));
    expect(result.exitCode).toBe(0);

    const compressed = await readFile(
      `${filePath}.logstrip.log`,
      'utf8',
    );
    expect(compressed.length).toBeGreaterThan(0);
    expect(compressed).toContain('[ERROR]');
  });

  it('deny reason includes original and output paths', async () => {
    const filePath = join(workDir, 'path-test.log');
    await writeFile(filePath, CI_LOG_PASTE);

    const result = await runHook(makePreToolUseInput(filePath));
    const json = parseJson<{
      hookSpecificOutput: { permissionDecisionReason: string };
    }>(result.stdout);

    expect(json!.hookSpecificOutput.permissionDecisionReason).toContain(
      filePath,
    );
    expect(json!.hookSpecificOutput.permissionDecisionReason).toContain(
      `${filePath}.logstrip.log`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PreToolUse - logstrip unavailable
// ═══════════════════════════════════════════════════════════════════════

describe('PreToolUse - logstrip not in PATH', () => {
  it('returns additionalContext suggesting install when logstrip missing', async () => {
    const filePath = join(workDir, 'no-cli.log');
    await writeFile(filePath, CI_LOG_PASTE);

    const result = await runHookRaw(JSON.stringify(makePreToolUseInput(filePath)), {
      ...process.env,
      PATH: '',
    });

    const json = parseJson<{
      hookSpecificOutput: {
        hookEventName: string;
        additionalContext: string;
      };
    }>(result.stdout);

    expect(json).not.toBeNull();
    expect(json!.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(json!.hookSpecificOutput.additionalContext).toContain(
      'npm i -g logstrip',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// UserPromptSubmit - log detection
// ═══════════════════════════════════════════════════════════════════════

describe('UserPromptSubmit - positive detection', () => {
  it('detects CI log paste (timestamps + log levels)', async () => {
    const result = await runHook(makeUserPromptSubmitInput(CI_LOG_PASTE));
    expect(result.exitCode).toBe(0);

    const json = parseJson<{
      hookSpecificOutput: {
        hookEventName: string;
        additionalContext: string;
      };
    }>(result.stdout);
    expect(json).not.toBeNull();
    expect(json!.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(json!.hookSpecificOutput.additionalContext).toContain(
      'logstrip <file>',
    );
    expect(json!.hookSpecificOutput.additionalContext).toContain(
      'pasted log output detected',
    );
  });

  it('detects Java stack trace paste (log levels + stacks)', async () => {
    const result = await runHook(makeUserPromptSubmitInput(JAVA_STACK_PASTE));
    expect(result.exitCode).toBe(0);

    const json = parseJson<{
      hookSpecificOutput: { additionalContext: string };
    }>(result.stdout);
    expect(json).not.toBeNull();
    expect(json!.hookSpecificOutput.additionalContext).toContain(
      'pasted log output detected',
    );
  });

  it('detects npm build error paste (CI markers)', async () => {
    const result = await runHook(makeUserPromptSubmitInput(NPM_BUILD_PASTE));
    expect(result.exitCode).toBe(0);

    const json = parseJson<{
      hookSpecificOutput: { additionalContext: string };
    }>(result.stdout);
    expect(json).not.toBeNull();
    expect(json!.hookSpecificOutput.additionalContext).toContain(
      'pasted log output detected',
    );
  });

  it('detects vitest/jest result paste (FAIL + PASS + SKIP)', async () => {
    const result = await runHook(makeUserPromptSubmitInput(MIXED_CI_PASTE));
    expect(result.exitCode).toBe(0);

    const json = parseJson<{
      hookSpecificOutput: { additionalContext: string };
    }>(result.stdout);
    expect(json).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// UserPromptSubmit - negative cases
// ═══════════════════════════════════════════════════════════════════════

describe('UserPromptSubmit - negative cases', () => {
  it('skips short messages (< 5 lines)', async () => {
    const result = await runHook(
      makeUserPromptSubmitInput(SHORT_NON_LOG),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('skips normal code discussion', async () => {
    const result = await runHook(
      makeUserPromptSubmitInput(CODE_DISCUSSION),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('skips empty prompt', async () => {
    const result = await runHook(makeUserPromptSubmitInput(''));
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('skips content with only one heuristic match', async () => {
    const result = await runHook(
      makeUserPromptSubmitInput(SINGLE_HEURISTIC),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('skips prompt with null value', async () => {
    const result = await runHook({
      hook_event_name: 'UserPromptSubmit',
      prompt: null,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('skips prompt with missing prompt field', async () => {
    const result = await runHook({
      hook_event_name: 'UserPromptSubmit',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// UserPromptSubmit - boundary conditions
// ═══════════════════════════════════════════════════════════════════════

describe('UserPromptSubmit - boundary conditions', () => {
  const boundaryLogLines = [
    '2024-01-15 10:23:45 [ERROR] line 1',
    '2024-01-15 10:23:46 [ERROR] line 2',
    '2024-01-15 10:23:47 [WARN]  line 3',
    '2024-01-15 10:23:48 [INFO]  line 4',
    '2024-01-15 10:23:49 [ERROR] line 5',
  ].join('\n');

  it('triggers on exactly 5 lines with 2+ heuristic matches', async () => {
    const result = await runHook(
      makeUserPromptSubmitInput(boundaryLogLines),
    );
    expect(result.exitCode).toBe(0);

    const json = parseJson<{
      hookSpecificOutput: { additionalContext: string };
    }>(result.stdout);
    expect(json).not.toBeNull();
  });

  const fourLineLog = [
    '2024-01-15 10:23:45 [ERROR] line 1',
    '2024-01-15 10:23:46 [ERROR] line 2',
    '2024-01-15 10:23:47 [WARN]  line 3',
    '2024-01-15 10:23:48 [INFO]  line 4',
  ].join('\n');

  it('skips exactly 4 lines even with 2+ heuristic matches', async () => {
    const result = await runHook(
      makeUserPromptSubmitInput(fourLineLog),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('triggers on exactly score=2 (timestamps + levels only)', async () => {
    const twoHeuristicPaste = [
      '2024-01-15 10:23:45 [ERROR] something',
      '2024-01-15 10:23:46 [ERROR] something',
      '2024-01-15 10:23:47 [WARN]  something',
      '2024-01-15 10:23:48 [INFO]  something',
      '2024-01-15 10:23:49 [ERROR] something',
    ].join('\n');

    const result = await runHook(
      makeUserPromptSubmitInput(twoHeuristicPaste),
    );
    const json = parseJson<{
      hookSpecificOutput: { additionalContext: string };
    }>(result.stdout);
    expect(json).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Unknown events
// ═══════════════════════════════════════════════════════════════════════

describe('Unknown events', () => {
  it('silently skips PostToolUse event', async () => {
    const result = await runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      tool_input: { file_path: '/tmp/test.log' },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('silently skips Stop event', async () => {
    const result = await runHook({ hook_event_name: 'Stop' });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('silently skips empty event', async () => {
    const result = await runHook({});
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('silently skips malformed JSON gracefully', async () => {
    const start = performance.now();
    const result = await runHookRaw('{not valid json');

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(3_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Hook config validation
// ═══════════════════════════════════════════════════════════════════════

describe('hook config files', () => {
  it('hooks.json is valid JSON with expected structure', async () => {
    const raw = await readFile(HOOKS_JSON, 'utf8');
    const config = JSON.parse(raw);

    expect(config.hooks).toBeDefined();
    expect(config.hooks.PreToolUse).toBeDefined();
    expect(config.hooks.UserPromptSubmit).toBeDefined();
    expect(config.hooks.PreToolUse).toBeInstanceOf(Array);
    expect(config.hooks.UserPromptSubmit).toBeInstanceOf(Array);

    const preToolUse = config.hooks.PreToolUse[0];
    expect(preToolUse.matcher).toBe('Read');
    expect(preToolUse.hooks[0].type).toBe('command');
    expect(preToolUse.hooks[0].command).toBe(
      'node "${CLAUDE_PLUGIN_ROOT}/hooks/logstrip-hook.js"',
    );
    expect(preToolUse.hooks[0].timeout).toBeTypeOf('number');

    const userPrompt = config.hooks.UserPromptSubmit[0];
    expect(userPrompt.hooks[0].type).toBe('command');
    expect(userPrompt.hooks[0].command).toBe(
      'node "${CLAUDE_PLUGIN_ROOT}/hooks/logstrip-hook.js"',
    );
  });

  it('cursor-hooks.json is valid JSON with Cursor format', async () => {
    const raw = await readFile(CURSOR_HOOKS_JSON, 'utf8');
    const config = JSON.parse(raw);

    expect(config.version).toBe(1);
    expect(config.hooks).toBeDefined();
    expect(config.hooks.preToolUse).toBeDefined();
    expect(config.hooks.preToolUse).toBeInstanceOf(Array);

    const preToolUse = config.hooks.preToolUse[0];
    expect(preToolUse.matcher).toBe('Read');
    expect(preToolUse.command).toBe(
      'node "${CLAUDE_PLUGIN_ROOT}/hooks/logstrip-hook.js"',
    );
    expect(preToolUse.timeout).toBeTypeOf('number');
  });

  it('factory plugin manifest explicitly wires the shared hooks file', async () => {
    const raw = await readFile(FACTORY_PLUGIN_JSON, 'utf8');
    const config = JSON.parse(raw);

    expect(config.hooks).toBe('./hooks/hooks.json');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Performance - latency budgets
// ═══════════════════════════════════════════════════════════════════════

describe('performance - latency budgets', () => {
  it('negative path (non-log .ts file) completes under 100ms', async () => {
    const filePath = join(workDir, 'perf-skip.ts');
    await writeFile(filePath, 'const x = 1;');

    const result = await runHook(makePreToolUseInput(filePath));
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
    expect(result.durationMs).toBeLessThan(100);
  });

  it('UserPromptSubmit short message completes under 100ms', async () => {
    const result = await runHook(
      makeUserPromptSubmitInput(SHORT_NON_LOG),
    );
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeLessThan(100);
  });

  it('UserPromptSubmit positive detection completes under 500ms', async () => {
    const result = await runHook(
      makeUserPromptSubmitInput(CI_LOG_PASTE),
    );
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeLessThan(500);
  });

  it('PreToolUse compression of a small log completes under 2s', async () => {
    const filePath = join(workDir, 'perf-small.log');
    await writeFile(filePath, CI_LOG_PASTE);

    const result = await runHook(makePreToolUseInput(filePath));
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeLessThan(2_000);
  });

  it('handles a 1000-line log paste under 1s', async () => {
    const lines: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const level = i % 3 === 0 ? 'ERROR' : i % 3 === 1 ? 'WARN' : 'INFO';
      lines.push(
        `2024-01-15 10:23:${String(i % 60).padStart(2, '0')}.${String(i).padStart(3, '0')} [${level}] event ${i}`,
      );
    }
    const bigPaste = lines.join('\n');

    const result = await runHook(makeUserPromptSubmitInput(bigPaste));
    expect(result.exitCode).toBe(0);

    const json = parseJson<{
      hookSpecificOutput: { additionalContext: string };
    }>(result.stdout);
    expect(json).not.toBeNull();
    expect(result.durationMs).toBeLessThan(1_000);
  });

  it('handles a 10_000-line log file under 5s', async () => {
    const filePath = join(workDir, 'perf-large.log');
    const lines: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      const level = i % 4 === 0 ? 'ERROR' : i % 4 === 1 ? 'WARN' : i % 4 === 2 ? 'INFO' : 'DEBUG';
      lines.push(
        `2024-01-15 10:${String(i % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.${String(i % 1000).padStart(3, '0')} [${level}] repeated event ${i}`,
      );
    }
    await writeFile(filePath, lines.join('\n'));

    const result = await runHook(makePreToolUseInput(filePath));
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeLessThan(5_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Performance - throughput (sequential)
// ═══════════════════════════════════════════════════════════════════════

describe('performance - sequential throughput', () => {
  it('processes 100 negative UserPromptSubmit calls under 10s', async () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const result = await runHook(
        makeUserPromptSubmitInput('Just a regular chat message'),
      );
      expect(result.exitCode).toBe(0);
    }
    const total = performance.now() - start;
    expect(total).toBeLessThan(10_000);
  });

  it('processes 50 positive UserPromptSubmit calls under 15s', async () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      const result = await runHook(
        makeUserPromptSubmitInput(CI_LOG_PASTE),
      );
      expect(result.exitCode).toBe(0);
    }
    const total = performance.now() - start;
    expect(total).toBeLessThan(15_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Integration - end-to-end flow
// ═══════════════════════════════════════════════════════════════════════

describe('integration - end-to-end compression flow', () => {
  it('compressed file contains diagnostic signal from original', async () => {
    const filePath = join(workDir, 'e2e-signal.log');
    await writeFile(filePath, CI_LOG_PASTE);

    await runHook(makePreToolUseInput(filePath));

    const compressed = await readFile(
      `${filePath}.logstrip.log`,
      'utf8',
    );
    // Original has [ERROR] lines - those must survive compression
    expect(compressed).toContain('[ERROR]');
  });

  it('compressed file is smaller than original', async () => {
    const filePath = join(workDir, 'e2e-smaller.log');
    const original = CI_LOG_PASTE.repeat(10);
    await writeFile(filePath, original);

    await runHook(makePreToolUseInput(filePath));

    const compressed = await readFile(
      `${filePath}.logstrip.log`,
      'utf8',
    );
    expect(compressed.length).toBeLessThan(original.length);
  });

  it('second Read on the .logstrip.log file is not re-compressed', async () => {
    const filePath = join(workDir, 'e2e-no-recompress.log');
    await writeFile(filePath, CI_LOG_PASTE);

    // First run compresses
    await runHook(makePreToolUseInput(filePath));
    const compressed = await readFile(
      `${filePath}.logstrip.log`,
      'utf8',
    );

    // Second run on the compressed file should skip
    const result = await runHook(
      makePreToolUseInput(`${filePath}.logstrip.log`),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');

    // Verify compressed content unchanged
    const rechecked = await readFile(
      `${filePath}.logstrip.log`,
      'utf8',
    );
    expect(rechecked).toBe(compressed);
  });
});
