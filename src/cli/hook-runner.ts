import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import {
  claimTextContent,
  classifyContent,
  processLogFile,
  processLogString,
} from '../core/logstrip-parser';
import type {
  ContentClassification,
  LogStripStringResult,
} from '../core/logstrip-parser';
import type { CliIo } from './index';

const LOG_FILE_EXTENSIONS: readonly string[] = [
  '.log',
  '.out',
  '.txt',
  '.trace',
  '.err',
];

const HOOK_LOG_DETECTION_MIN_LINES = 5;
// A pasted prompt is only blocked when the shared classifier sees log output
// in it: at least this many log-like lines, making up at least this share of
// the non-blank lines. The classifier alone is not enough, it calls any
// input without recognizable structure a log.
const HOOK_MIN_LOG_LINES = 3;
const HOOK_MIN_LOG_RATIO = 0.4;
// Blocking a paste that barely shrinks only costs the user a round trip.
const HOOK_MIN_SAVINGS_PERCENT = 15;

const COMPRESSION_FAILED_HINT =
  'LogStrip: compression failed. Analysing raw content.';

const PRE_TOOL_USE_EVENT_ALIASES: ReadonlySet<string> = new Set([
  'pretooluse',
]);
const CLAUDE_USER_PROMPT_SUBMIT_ALIASES: ReadonlySet<string> = new Set([
  'userpromptsubmit',
  'userpromptsubmitted',
]);
const CURSOR_USER_PROMPT_SUBMIT_ALIASES: ReadonlySet<string> = new Set([
  'beforesubmitprompt',
]);
const READ_TOOL_ALIASES: ReadonlySet<string> = new Set([
  'read',
  'view',
]);

interface HookEnvelope {
  hook_event_name?: unknown;
  hookEventName?: unknown;
}

interface PreToolUseEvent extends HookEnvelope {
  tool_name?: unknown;
  toolName?: unknown;
  tool_input?: { file_path?: unknown; filePath?: unknown } | null;
  toolInput?: { file_path?: unknown; filePath?: unknown } | null;
}

interface UserPromptSubmitEvent extends HookEnvelope {
  prompt?: unknown;
}

function normalizeEventName(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function isAlreadyCompressed(filePath: string): boolean {
  return filePath.endsWith('.logstrip.log') || filePath.includes('.logstrip.');
}

function isSupportedLogFile(filePath: string): boolean {
  return LOG_FILE_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}

function buildTempLogPath(prompt: string): string {
  const hash = createHash('sha1').update(prompt).digest('hex').slice(0, 12);
  return join(tmpdir(), `logstrip-${hash}.logstrip.log`);
}

function buildBlockReason(
  result: LogStripStringResult,
  outputPath: string | null,
): string {
  const savings =
    `${result.savingsPercent.toFixed(0)}% smaller, ` +
    `~${result.savedTokens} tokens saved`;

  if (outputPath !== null) {
    return (
      `LogStrip blocked a raw log paste (~${result.stats.inputLines} lines). ` +
      `Pasting raw logs wastes tokens, so the prompt was not sent. ` +
      `A compressed copy (${savings}) was written to ${outputPath}. ` +
      `Re-send your request pointing the agent at that file, ` +
      `or paste its contents instead of the raw logs.`
    );
  }

  return (
    `LogStrip blocked a raw log paste (~${result.stats.inputLines} lines, ` +
    `compresses to ${savings}). Pasting raw logs wastes tokens, so the prompt ` +
    `was not sent. Save the logs to a file and run ` +
    '`logstrip <file> -o <file>.logstrip.log`, then re-send referencing the ' +
    'compressed file or paste its contents.'
  );
}

function emit(stream: NodeJS.WritableStream, payload: unknown): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.write(JSON.stringify(payload), (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function readStdinJson(stdin: NodeJS.ReadableStream): Promise<unknown> {
  let buffer = '';
  for await (const chunk of stdin) {
    buffer += typeof chunk === 'string' ? chunk : (chunk as Buffer).toString('utf8');
  }

  const trimmed = buffer.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractToolName(event: PreToolUseEvent): string | null {
  if (typeof event.tool_name === 'string') return event.tool_name;
  if (typeof event.toolName === 'string') return event.toolName;
  return null;
}

function extractFilePath(event: PreToolUseEvent): string | null {
  const candidates = [event.tool_input, event.toolInput];
  for (const input of candidates) {
    if (input == null) continue;
    if (typeof input.file_path === 'string' && input.file_path.length > 0) {
      return input.file_path;
    }
    if (typeof input.filePath === 'string' && input.filePath.length > 0) {
      return input.filePath;
    }
  }
  return null;
}

function buildDenyPayload(reason: string): Record<string, unknown> {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
    permission: 'deny',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
    user_message: reason,
    agent_message: reason,
  };
}

type UserPromptDialect = 'claude' | 'cursor';

function buildBlockPayload(
  reason: string,
  dialect: UserPromptDialect,
): Record<string, unknown> {
  if (dialect === 'cursor') {
    // Cursor's beforeSubmitPrompt blocks with `continue: false`; emitting
    // Claude's `continue` flag elsewhere would stop the whole session, so we
    // branch on the originating event name.
    return {
      continue: false,
      user_message: reason,
    };
  }
  return {
    decision: 'block',
    reason,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: reason,
    },
  };
}

// Read just the head of a file and classify it, so a text file named
// notes.txt is neither compressed nor left with a stray .logstrip.log.
async function fileLooksLikeText(filePath: string): Promise<boolean> {
  const input = createReadStream(filePath, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    const claim = await claimTextContent(lines);
    return claim.classification.kind === 'text';
  } finally {
    lines.close();
    input.destroy();
  }
}

function looksLikeLogPaste(classification: ContentClassification): boolean {
  return (
    classification.kind === 'log' &&
    classification.logLines >= HOOK_MIN_LOG_LINES &&
    classification.logLines / classification.sampledLines >= HOOK_MIN_LOG_RATIO
  );
}

async function handlePreToolUse(
  event: PreToolUseEvent,
  stdout: NodeJS.WritableStream,
): Promise<void> {
  const toolName = extractToolName(event);
  if (toolName === null || !READ_TOOL_ALIASES.has(toolName.toLowerCase())) {
    return;
  }

  const filePath = extractFilePath(event);
  if (filePath === null) {
    return;
  }

  if (isAlreadyCompressed(filePath)) {
    return;
  }
  if (!isSupportedLogFile(filePath)) {
    return;
  }
  if (!existsSync(filePath)) {
    return;
  }

  const outputFile = `${filePath}.logstrip.log`;
  try {
    if (await fileLooksLikeText(filePath)) {
      return;
    }
    await processLogFile(filePath, outputFile, { textPassthrough: false });
  } catch {
    await emit(stdout, {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: COMPRESSION_FAILED_HINT,
      },
    });
    return;
  }

  const reason =
    `LogStrip: auto-compressed ${filePath} -> ${outputFile}. ` +
    'Read the compressed .logstrip.log file instead.';
  await emit(stdout, buildDenyPayload(reason));
}

async function handleUserPromptSubmit(
  event: UserPromptSubmitEvent,
  stdout: NodeJS.WritableStream,
  dialect: UserPromptDialect,
): Promise<void> {
  const prompt = event.prompt;
  if (typeof prompt !== 'string' || prompt.length === 0) {
    return;
  }

  const lines = prompt.split(/\r?\n/u);
  if (lines.length < HOOK_LOG_DETECTION_MIN_LINES) {
    return;
  }
  if (!looksLikeLogPaste(classifyContent(lines))) {
    return;
  }

  let compressed: LogStripStringResult;
  try {
    compressed = await processLogString(prompt, { textPassthrough: false });
  } catch {
    return;
  }
  if (compressed.savingsPercent < HOOK_MIN_SAVINGS_PERCENT) {
    return;
  }

  let outputPath: string | null = buildTempLogPath(prompt);
  try {
    await writeFile(outputPath, compressed.output, 'utf8');
  } catch {
    outputPath = null;
  }

  await emit(
    stdout,
    buildBlockPayload(buildBlockReason(compressed, outputPath), dialect),
  );
}

function resolveEventName(envelope: HookEnvelope): string {
  const explicit = normalizeEventName(envelope.hook_event_name);
  if (explicit.length > 0) return explicit;
  return normalizeEventName(envelope.hookEventName);
}

export async function runHookCommand(io: CliIo): Promise<number> {
  const parsed = await readStdinJson(io.stdin);
  if (parsed === null || typeof parsed !== 'object') {
    return 0;
  }

  const envelope = parsed as HookEnvelope;
  const eventName = resolveEventName(envelope);

  if (PRE_TOOL_USE_EVENT_ALIASES.has(eventName)) {
    await handlePreToolUse(parsed as PreToolUseEvent, io.stdout);
    return 0;
  }
  if (CLAUDE_USER_PROMPT_SUBMIT_ALIASES.has(eventName)) {
    await handleUserPromptSubmit(
      parsed as UserPromptSubmitEvent,
      io.stdout,
      'claude',
    );
    return 0;
  }
  if (CURSOR_USER_PROMPT_SUBMIT_ALIASES.has(eventName)) {
    await handleUserPromptSubmit(
      parsed as UserPromptSubmitEvent,
      io.stdout,
      'cursor',
    );
    return 0;
  }
  return 0;
}
