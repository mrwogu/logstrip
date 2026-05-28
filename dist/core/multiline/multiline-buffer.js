"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContinuationContext = createContinuationContext;
exports.isContinuationLine = isContinuationLine;
const MAX_MULTILINE_GROUP_LINES = 200;
const MAX_MULTILINE_GROUP_BYTES = 200_000;
const INDENTED_PATTERN = /^\s+/u;
function createContinuationContext(mode) {
    return { mode, groupLineCount: 0, groupByteCount: 0, previousLine: '' };
}
const EXPLICIT_MODES = new Set([
    'auto', 'auto-source', 'python', 'node', 'java', 'go', 'rust', 'off',
]);
function isContinuationLine(line, ctx) {
    if (ctx.mode === 'off')
        return false;
    if (ctx.groupLineCount >= MAX_MULTILINE_GROUP_LINES)
        return false;
    if (ctx.groupByteCount >= MAX_MULTILINE_GROUP_BYTES)
        return false;
    if (ctx.mode === 'auto-source') {
        return isAutoSourceCont(line, ctx);
    }
    if (ctx.mode === 'java')
        return isJavaCont(line);
    if (ctx.mode === 'go')
        return isGoCont(line);
    if (ctx.mode === 'auto')
        return isAutoCont(line, ctx.previousLine);
    if (!EXPLICIT_MODES.has(ctx.mode))
        return false;
    return isCont(line);
}
function isAutoSourceCont(line, ctx) {
    if (line.trim().length === 0)
        return false;
    if (ctx.effectiveMode === undefined) {
        return isAutoCont(line, ctx.previousLine);
    }
    if (ctx.effectiveMode === 'java')
        return isJavaCont(line);
    if (ctx.effectiveMode === 'go')
        return isGoCont(line);
    if (ctx.effectiveMode === 'off')
        return false;
    return isCont(line);
}
function isCont(line) {
    return line.trim().length > 0 && INDENTED_PATTERN.test(line) && !line.startsWith('    [');
}
function isJavaCont(line) {
    if (line.trim().length === 0)
        return false;
    if (/^Caused\s+by:/iu.test(line))
        return true;
    return INDENTED_PATTERN.test(line) && !line.startsWith('    [');
}
function isGoCont(line) {
    if (line.trim().length === 0)
        return false;
    if (/^(?:\t|goroutine\s+\d+\s+\[.+\]:|created\s+by\s)/u.test(line))
        return true;
    return /^\t/u.test(line);
}
function isAutoCont(line, previousLine) {
    if (line.trim().length === 0)
        return false;
    if (INDENTED_PATTERN.test(line) && !line.startsWith('    ['))
        return true;
    if (/^Caused\s+by:/iu.test(line))
        return true;
    if (/^goroutine\s+\d+\s+\[.+\]:/u.test(line))
        return true;
    return false;
}
