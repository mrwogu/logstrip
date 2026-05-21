import { groupHttpStatusCodes } from '../formats/format-detector.js';

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu;
const ISO_TIME_PATTERN =
  /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)?\b/gu;
const UTC_TIME_PATTERN =
  /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+(?:GMT|UTC)\b/giu;
const COMMON_LOG_TIME_PATTERN =
  /\b\d{1,2}\/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\b/giu;
const NGINX_ERROR_TIME_PATTERN = /\b\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\b/gu;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/gu;
const IPV4_WITH_PORT_PATTERN =
  /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}:(?:6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]?\d{1,4})\b/gu;
const IPV4_PATTERN =
  /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/gu;

// ---- Secret/token patterns ----

// GitHub tokens
const GITHUB_TOKEN_PATTERN = /\bgh[opuars]_[A-Za-z0-9]{36,255}\b/gu;

// JWT tokens
const JWT_TOKEN_PATTERN =
  /\beyJ[A-Za-z0-9_-]{16,2000}\.[A-Za-z0-9_-]{16,2000}\.[A-Za-z0-9_-]{16,2000}\b/gu;

// Connection strings with embedded credentials
const CONNECTION_STRING_PATTERN =
  /\b(?:postgres|mysql|mongodb|redis|postgresql|sqlserver|jdbc):\/\/[^:@\s]+:([^@\s]+)@/giu;

// Slack tokens
const SLACK_TOKEN_PATTERN =
  /\bxox[abprs]-\d{10,12}-\d{10,12}-[A-Za-z0-9]{24,}\b/gu;

// Generic secret field values in key=value or key: value format
const SECRET_FIELD_PATTERN =
  /\b(?:password|secret|token|api[_-]?key|api[_-]?secret|private[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|auth[_-]?token|bearer)\s*[:=]\s*\S+/giu;

// ---- Hash/ID patterns ----

const HEX_HASH_PATTERN = /\b(?=[a-f0-9]*\d)(?=[a-f0-9]*[a-f])[a-f0-9]{16,128}\b/giu;
const ALPHANUMERIC_HASH_PATTERN =
  /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{24,512}\b/gu;
const AWS_ACCESS_KEY_PATTERN = /\b(?:AKIA|ABIA|ASIA)[0-9A-Z]{16}\b/gu;
const AWS_ARN_ACCOUNT_PATTERN = /arn:aws:[a-z]+:[a-z0-9-]+:(\d{12})/gu;

export function sanitizeLine(line: string): string {
  let result = line
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(UUID_PATTERN, '[ID]')
    .replace(UTC_TIME_PATTERN, '[TIME]')
    .replace(COMMON_LOG_TIME_PATTERN, '[TIME]')
    .replace(NGINX_ERROR_TIME_PATTERN, '[TIME]')
    .replace(ISO_TIME_PATTERN, '[TIME]')
    .replace(IPV4_WITH_PORT_PATTERN, '[IP]:[PORT]')
    .replace(IPV4_PATTERN, '[IP]')
    // Secrets (before hex/hash to avoid those patterns consuming tokens)
    .replace(CONNECTION_STRING_PATTERN, (match, pwd) =>
      match.replace(pwd, '[REDACTED]'),
    )
    .replace(GITHUB_TOKEN_PATTERN, '[REDACTED]')
    .replace(JWT_TOKEN_PATTERN, '[JWT]')
    .replace(SLACK_TOKEN_PATTERN, '[REDACTED]')
    .replace(SECRET_FIELD_PATTERN, (match) => {
      const sepIdx = match.search(/[:=]\s*/u);
      if (sepIdx < 0) return match;
      const sepEnd = match.slice(sepIdx).match(/^[:=]\s*/u)?.[0].length ?? 1;
      return `${match.slice(0, sepIdx + sepEnd)}[REDACTED]`;
    })
    .replace(HEX_HASH_PATTERN, '[HASH]')
    .replace(ALPHANUMERIC_HASH_PATTERN, '[HASH]')
    .replace(AWS_ACCESS_KEY_PATTERN, '[REDACTED]')
    .replace(AWS_ARN_ACCOUNT_PATTERN, (match, accountId) =>
      match.replace(accountId, '[ACCOUNT]'),
    )
    .replace(/[ \t]+$/u, '');

  // HTTP status code grouping
  result = groupHttpStatusCodes(result);

  return result;
}
