const LOGFMT_PATTERN = /^\s*\w+=[^\s=]+(?:\s+\w+=[^\s=]+)*\s*$/u;
const SYSLOG_PATTERN = /^<\d{1,3}>\d?\s/u;
const JSON_LINE_PATTERN = /^\s*\{.+\}\s*$/u;

export type DetectedFormat = 'logfmt' | 'syslog' | 'json' | 'unknown';

export function detectFormat(line: string): DetectedFormat {
  if (SYSLOG_PATTERN.test(line)) return 'syslog';
  if (JSON_LINE_PATTERN.test(line)) { try { JSON.parse(line); return 'json'; } catch {} }
  if (LOGFMT_PATTERN.test(line)) return 'logfmt';
  return 'unknown';
}

const HTTP_STATUS_CONTEXT_PATTERN =
  /\b(?:HTTP\s*\/?\d?(?:\.\d+)?\s+|status[=:\s]+|returned\s+|responded\s+with\s+|got\s+|received\s+|with\s+status\s+|code[=:\s]+)\s*(\d{3})\b/giu;

const HTTP_STATUS_DESC_PATTERN =
  /\b(\d{3})\s+(?:OK|Created|Accepted|No Content|Moved|Found|Not Modified|Bad Request|Unauthorized|Forbidden|Not Found|Method Not Allowed|Conflict|Gone|Too Many Requests|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)\b/giu;

export function groupHttpStatusCodes(line: string): string {
  line = line.replace(HTTP_STATUS_CONTEXT_PATTERN, (match, codeStr) => {
    const code = parseInt(codeStr, 10);
    if (code >= 500) return match.replace(codeStr, '[HTTP 5xx]');
    if (code >= 400) return match.replace(codeStr, '[HTTP 4xx]');
    return match;
  });
  line = line.replace(HTTP_STATUS_DESC_PATTERN, (match, codeStr) => {
    const code = parseInt(codeStr, 10);
    if (code >= 500) return match.replace(codeStr, '[HTTP 5xx]');
    if (code >= 400) return match.replace(codeStr, '[HTTP 4xx]');
    return match;
  });
  return line;
}
