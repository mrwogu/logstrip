"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runHookCommand = runHookCommand;
const node_fs_1 = require("node:fs");
const logstrip_parser_1 = require("../core/logstrip-parser");
const LOG_FILE_EXTENSIONS = [
    '.log',
    '.out',
    '.txt',
    '.trace',
    '.err',
];
const HOOK_LOG_DETECTION_MIN_LINES = 5;
const HOOK_LOG_DETECTION_MIN_SCORE = 2;
const HOOK_STACK_TRACE_BONUS_THRESHOLD = 3;
const TIMESTAMP_PATTERN = /([0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}|[0-9]{2}:[0-9]{2}:[0-9]{2}[.,][0-9]{3})/u;
const LOG_LEVEL_PATTERN = /\[(INFO|ERROR|WARN|DEBUG|TRACE|FATAL|WARNING)\]|(^|\s)(ERROR|WARNING|FATAL|INFO):|npm (ERR|WARN)!/iu;
const STACK_TRACE_PATTERN = /at [a-zA-Z][a-zA-Z0-9_$]+\.[a-zA-Z]/u;
const CI_MARKER_PATTERN = /(FAIL|PASS|SKIP|RUN)\b|npm ERR!|cargo (error|warning)|make\[|pytest|jest|mocha/iu;
const LINE_PREFIX_PATTERN = /^\s*(npm ERR|npm WARN|yarn error|FAIL|PASS|SKIP|RUN|OK|ERR!|WARN!|\[ERROR\]|\[INFO\]|\[WARN\]|\[DEBUG\]|\[FATAL\]|\[TRACE\]|FATAL:|ERROR:|WARNING:)/iu;
const USER_PROMPT_HINT = 'LogStrip auto-activation: pasted log output detected. Before analysing, write the pasted content to a temp file and run `logstrip <file> -o <file>.logstrip.log --stats`, then read the compressed output. If logstrip is not installed, suggest `npm i -g logstrip`. Do not analyse the raw pasted logs line-by-line.';
const COMPRESSION_FAILED_HINT = 'LogStrip: compression failed for this log file. Analysing raw content.';
function isAlreadyCompressed(filePath) {
    return filePath.endsWith('.logstrip.log') || filePath.includes('.logstrip.');
}
function isSupportedLogFile(filePath) {
    return LOG_FILE_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}
function countMatchingLines(text, pattern) {
    let count = 0;
    for (const line of text.split(/\r?\n/u)) {
        if (pattern.test(line)) {
            count += 1;
        }
    }
    return count;
}
function emit(stream, payload) {
    return new Promise((resolve, reject) => {
        stream.write(JSON.stringify(payload), (error) => {
            if (error) {
                reject(error);
            }
            else {
                resolve();
            }
        });
    });
}
async function readStdinJson(stdin) {
    let buffer = '';
    for await (const chunk of stdin) {
        buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    }
    const trimmed = buffer.trim();
    if (trimmed.length === 0) {
        return null;
    }
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return null;
    }
}
async function handlePreToolUse(event, stdout) {
    if (event.tool_name !== 'Read') {
        return;
    }
    const filePath = event.tool_input?.file_path;
    if (typeof filePath !== 'string' || filePath.length === 0) {
        return;
    }
    if (isAlreadyCompressed(filePath)) {
        return;
    }
    if (!isSupportedLogFile(filePath)) {
        return;
    }
    if (!(0, node_fs_1.existsSync)(filePath)) {
        return;
    }
    const outputFile = `${filePath}.logstrip.log`;
    try {
        await (0, logstrip_parser_1.processLogFile)(filePath, outputFile);
    }
    catch {
        await emit(stdout, {
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                additionalContext: COMPRESSION_FAILED_HINT,
            },
        });
        return;
    }
    await emit(stdout, {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `LogStrip: auto-compressed ${filePath} -> ${outputFile}. Read the compressed .logstrip.log file instead.`,
        },
    });
}
async function handleUserPromptSubmit(event, stdout) {
    const prompt = event.prompt;
    if (typeof prompt !== 'string' || prompt.length === 0) {
        return;
    }
    const lineCount = prompt.split(/\r?\n/u).length;
    if (lineCount < HOOK_LOG_DETECTION_MIN_LINES) {
        return;
    }
    let score = 0;
    if (countMatchingLines(prompt, TIMESTAMP_PATTERN) >= 2) {
        score += 1;
    }
    if (countMatchingLines(prompt, LOG_LEVEL_PATTERN) >= 2) {
        score += 1;
    }
    const stackTraceLines = countMatchingLines(prompt, STACK_TRACE_PATTERN);
    if (stackTraceLines >= 1) {
        score += 1;
    }
    if (stackTraceLines >= HOOK_STACK_TRACE_BONUS_THRESHOLD) {
        score += 1;
    }
    if (countMatchingLines(prompt, CI_MARKER_PATTERN) >= 2) {
        score += 1;
    }
    if (countMatchingLines(prompt, LINE_PREFIX_PATTERN) >= 2) {
        score += 1;
    }
    if (score < HOOK_LOG_DETECTION_MIN_SCORE) {
        return;
    }
    await emit(stdout, {
        hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: USER_PROMPT_HINT,
        },
    });
}
async function runHookCommand(io) {
    const parsed = await readStdinJson(io.stdin);
    if (parsed === null || typeof parsed !== 'object') {
        return 0;
    }
    const envelope = parsed;
    switch (envelope.hook_event_name) {
        case 'PreToolUse':
            await handlePreToolUse(parsed, io.stdout);
            return 0;
        case 'UserPromptSubmit':
            await handleUserPromptSubmit(parsed, io.stdout);
            return 0;
        default:
            return 0;
    }
}
