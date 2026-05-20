"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeLine = sanitizeLine;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const ISO_TIME_PATTERN = /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;
const UTC_TIME_PATTERN = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+(?:GMT|UTC)\b/gi;
const COMMON_LOG_TIME_PATTERN = /\b\d{1,2}\/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\b/gi;
const NGINX_ERROR_TIME_PATTERN = /\b\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\b/g;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/gu;
const IPV4_WITH_PORT_PATTERN = /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}:(?:6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]?\d{1,4})\b/g;
const IPV4_PATTERN = /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/g;
const HEX_HASH_PATTERN = /\b(?=[a-f0-9]*\d)(?=[a-f0-9]*[a-f])[a-f0-9]{16,}\b/gi;
const ALPHANUMERIC_HASH_PATTERN = /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{24,}\b/g;
const AWS_ACCESS_KEY_PATTERN = /\b(?:AKIA|ABIA|ASIA)[0-9A-Z]{16}\b/g;
const AWS_ARN_ACCOUNT_PATTERN = /arn:aws:[a-z]+:[a-z0-9-]+:(\d{12})/g;
function sanitizeLine(line) {
    return line
        .replace(ANSI_ESCAPE_PATTERN, '')
        .replace(UUID_PATTERN, '[ID]')
        .replace(UTC_TIME_PATTERN, '[TIME]')
        .replace(COMMON_LOG_TIME_PATTERN, '[TIME]')
        .replace(NGINX_ERROR_TIME_PATTERN, '[TIME]')
        .replace(ISO_TIME_PATTERN, '[TIME]')
        .replace(IPV4_WITH_PORT_PATTERN, '[IP]:[PORT]')
        .replace(IPV4_PATTERN, '[IP]')
        .replace(HEX_HASH_PATTERN, '[HASH]')
        .replace(ALPHANUMERIC_HASH_PATTERN, '[HASH]')
        .replace(AWS_ACCESS_KEY_PATTERN, '[REDACTED]')
        .replace(AWS_ARN_ACCOUNT_PATTERN, (match, accountId) => match.replace(accountId, '[ACCOUNT]'))
        .replace(/[ \t]+$/u, '');
}
