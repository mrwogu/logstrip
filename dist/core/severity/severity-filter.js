"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_SEVERITY_LEVELS = void 0;
exports.parseSeverityLevel = parseSeverityLevel;
exports.inferSeverity = inferSeverity;
exports.passesSeverityFilter = passesSeverityFilter;
const SEVERITY_ORDER = {
    fatal: 5, error: 4, warn: 3, info: 2, debug: 1, trace: 0,
};
const SEVERITY_PATTERNS = [
    { level: 'fatal', regex: /\[FATAL\]|"level"\s*:\s*"fatal"|Severity:\s*FATAL|\bFATAL\b/iu },
    { level: 'error', regex: /\[ERROR\]|"level"\s*:\s*"error"|Severity:\s*ERROR|\bERROR\b/iu },
    { level: 'warn', regex: /\[WARN(?:ING)?\]|"level"\s*:\s*"warn(?:ing)?"|Severity:\s*WARN/i },
    { level: 'info', regex: /\[INFO\]|"level"\s*:\s*"info"|\bINFO\b/iu },
    { level: 'debug', regex: /\[DEBUG\]|"level"\s*:\s*"debug"|\bDEBUG\b/iu },
    { level: 'trace', regex: /\[TRACE\]|"level"\s*:\s*"trace"|\bTRACE\b/iu },
];
exports.VALID_SEVERITY_LEVELS = [
    'fatal', 'error', 'warn', 'info', 'debug', 'trace',
];
function parseSeverityLevel(value) {
    const normalized = value.toLowerCase();
    if (exports.VALID_SEVERITY_LEVELS.includes(normalized)) {
        return normalized;
    }
    throw new Error(`Unsupported severity level: ${value}. Valid values: ${exports.VALID_SEVERITY_LEVELS.join(', ')}`);
}
function inferSeverity(line) {
    for (const { level, regex } of SEVERITY_PATTERNS) {
        if (regex.test(line))
            return level;
    }
    return undefined;
}
function passesSeverityFilter(line, minLevel) {
    const lineLevel = inferSeverity(line);
    if (lineLevel === undefined)
        return true;
    return SEVERITY_ORDER[lineLevel] >= SEVERITY_ORDER[minLevel];
}
