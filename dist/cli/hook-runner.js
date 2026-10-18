"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runHookCommand = runHookCommand;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const node_readline_1 = require("node:readline");
const logstrip_parser_1 = require("../core/logstrip-parser");
const LOG_FILE_EXTENSIONS = [
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
const COMPRESSION_FAILED_HINT = 'LogStrip: compression failed. Analysing raw content.';
const PRE_TOOL_USE_EVENT_ALIASES = new Set([
    'pretooluse',
]);
const CLAUDE_USER_PROMPT_SUBMIT_ALIASES = new Set([
    'userpromptsubmit',
    'userpromptsubmitted',
]);
const CURSOR_USER_PROMPT_SUBMIT_ALIASES = new Set([
    'beforesubmitprompt',
]);
const READ_TOOL_ALIASES = new Set([
    'read',
    'view',
]);
function normalizeEventName(value) {
    return typeof value === 'string' ? value.toLowerCase() : '';
}
function isAlreadyCompressed(filePath) {
    return filePath.endsWith('.logstrip.log') || filePath.includes('.logstrip.');
}
function isSupportedLogFile(filePath) {
    return LOG_FILE_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}
function buildTempLogPath(prompt) {
    const hash = (0, node_crypto_1.createHash)('sha1').update(prompt).digest('hex').slice(0, 12);
    return (0, node_path_1.join)((0, node_os_1.tmpdir)(), `logstrip-${hash}.logstrip.log`);
}
function buildBlockReason(result, outputPath) {
    const savings = `${result.savingsPercent.toFixed(0)}% smaller, ` +
        `~${result.savedTokens} tokens saved`;
    if (outputPath !== null) {
        return (`LogStrip blocked a raw log paste (~${result.stats.inputLines} lines). ` +
            `Pasting raw logs wastes tokens, so the prompt was not sent. ` +
            `A compressed copy (${savings}) was written to ${outputPath}. ` +
            `Re-send your request pointing the agent at that file, ` +
            `or paste its contents instead of the raw logs.`);
    }
    return (`LogStrip blocked a raw log paste (~${result.stats.inputLines} lines, ` +
        `compresses to ${savings}). Pasting raw logs wastes tokens, so the prompt ` +
        `was not sent. Save the logs to a file and run ` +
        '`logstrip <file> -o <file>.logstrip.log`, then re-send referencing the ' +
        'compressed file or paste its contents.');
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
function extractToolName(event) {
    if (typeof event.tool_name === 'string')
        return event.tool_name;
    if (typeof event.toolName === 'string')
        return event.toolName;
    return null;
}
function extractFilePath(event) {
    const candidates = [event.tool_input, event.toolInput];
    for (const input of candidates) {
        if (input == null)
            continue;
        if (typeof input.file_path === 'string' && input.file_path.length > 0) {
            return input.file_path;
        }
        if (typeof input.filePath === 'string' && input.filePath.length > 0) {
            return input.filePath;
        }
    }
    return null;
}
function buildDenyPayload(reason) {
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
function buildBlockPayload(reason, dialect) {
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
async function fileLooksLikeText(filePath) {
    const input = (0, node_fs_1.createReadStream)(filePath, { encoding: 'utf8' });
    const lines = (0, node_readline_1.createInterface)({ input, crlfDelay: Infinity });
    try {
        const claim = await (0, logstrip_parser_1.claimTextContent)(lines);
        return claim.classification.kind === 'text';
    }
    finally {
        lines.close();
        input.destroy();
    }
}
function looksLikeLogPaste(classification) {
    return (classification.kind === 'log' &&
        classification.logLines >= HOOK_MIN_LOG_LINES &&
        classification.logLines / classification.sampledLines >= HOOK_MIN_LOG_RATIO);
}
async function handlePreToolUse(event, stdout) {
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
    if (!(0, node_fs_1.existsSync)(filePath)) {
        return;
    }
    const outputFile = `${filePath}.logstrip.log`;
    try {
        if (await fileLooksLikeText(filePath)) {
            return;
        }
        await (0, logstrip_parser_1.processLogFile)(filePath, outputFile, { textPassthrough: false });
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
    const reason = `LogStrip: auto-compressed ${filePath} -> ${outputFile}. ` +
        'Read the compressed .logstrip.log file instead.';
    await emit(stdout, buildDenyPayload(reason));
}
async function handleUserPromptSubmit(event, stdout, dialect) {
    const prompt = event.prompt;
    if (typeof prompt !== 'string' || prompt.length === 0) {
        return;
    }
    const lines = prompt.split(/\r?\n/u);
    if (lines.length < HOOK_LOG_DETECTION_MIN_LINES) {
        return;
    }
    if (!looksLikeLogPaste((0, logstrip_parser_1.classifyContent)(lines))) {
        return;
    }
    let compressed;
    try {
        compressed = await (0, logstrip_parser_1.processLogString)(prompt, { textPassthrough: false });
    }
    catch {
        return;
    }
    if (compressed.savingsPercent < HOOK_MIN_SAVINGS_PERCENT) {
        return;
    }
    let outputPath = buildTempLogPath(prompt);
    try {
        await (0, promises_1.writeFile)(outputPath, compressed.output, 'utf8');
    }
    catch {
        outputPath = null;
    }
    await emit(stdout, buildBlockPayload(buildBlockReason(compressed, outputPath), dialect));
}
function resolveEventName(envelope) {
    const explicit = normalizeEventName(envelope.hook_event_name);
    if (explicit.length > 0)
        return explicit;
    return normalizeEventName(envelope.hookEventName);
}
async function runHookCommand(io) {
    const parsed = await readStdinJson(io.stdin);
    if (parsed === null || typeof parsed !== 'object') {
        return 0;
    }
    const envelope = parsed;
    const eventName = resolveEventName(envelope);
    if (PRE_TOOL_USE_EVENT_ALIASES.has(eventName)) {
        await handlePreToolUse(parsed, io.stdout);
        return 0;
    }
    if (CLAUDE_USER_PROMPT_SUBMIT_ALIASES.has(eventName)) {
        await handleUserPromptSubmit(parsed, io.stdout, 'claude');
        return 0;
    }
    if (CURSOR_USER_PROMPT_SUBMIT_ALIASES.has(eventName)) {
        await handleUserPromptSubmit(parsed, io.stdout, 'cursor');
        return 0;
    }
    return 0;
}
