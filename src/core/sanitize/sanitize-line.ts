import { groupHttpStatusCodes } from '../formats/format-detector.js';
import { maskHighEntropyTokens } from './entropy-secret.js';

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu;
// The fraction separator may be a comma (Python logging, log4j, logback) and
// the zone may follow a space (PostgreSQL "... UTC", gunicorn "... +0000").
const ISO_TIME_PATTERN =
  /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|\s?UTC|\s?GMT|\s?[+-]\d{2}:?\d{2})?)?\b/gu;
const UTC_TIME_PATTERN =
  /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+(?:GMT|UTC)\b/giu;
const APACHE_ERROR_TIME_PATTERN =
  /\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?\s+\d{4}\]/giu;
const COMMON_LOG_TIME_PATTERN =
  /\b\d{1,2}\/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\b/giu;
// Go's log package appends microseconds ("2026/05/16 10:24:31.044123").
const NGINX_ERROR_TIME_PATTERN =
  /\b\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?\b/gu;
// syslog / journald ("May 16 10:24:31", "May  6 10:24:31") and date(1)
// output with a leading weekday.
const SYSLOG_TIME_PATTERN =
  /\b(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s{1,2}\d{1,2}\s\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?\b/gu;
// Tomcat / PHP ("16-May-2026 10:24:31.011") and Redis ("16 May 2026 10:24:31.011").
const DAY_MONTH_TIME_PATTERN =
  /\b\d{1,2}[-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]\d{4}\s\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:\s?(?:UTC|GMT|[+-]\d{4}))?\b/gu;
// Bare time of day ("10:24:31.044"). The lookarounds keep it out of MAC
// addresses, IPv6 groups and longer digit runs.
const TIME_OF_DAY_PATTERN =
  /(?<![\d:.])\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?![\d:])/gu;
// Numeric epoch timestamps under a time-like key: pino's default
// "time":1715855071123 and logfmt ts=1715855071.
const EPOCH_JSON_FIELD_PATTERN =
  /("(?:time|timestamp|@timestamp|ts|datetime)"\s*:\s*)\d{10,13}(?:\.\d+)?(?=\s*[,}])/giu;
const EPOCH_LOGFMT_FIELD_PATTERN =
  /\b(time|timestamp|ts)=\d{10,13}(?:\.\d+)?\b/giu;
const K8S_RELATIVE_DURATION_PATTERN =
  /\b(?:\d+d)?(?:\d+h)?(?:\d+m)?\d+s\b/gu;
// Text right before a duration that marks it as a measurement worth keeping
// ("timed out after 30s", "retrying in 2s", "retry=5s", "1m 12s") or as the
// tail of a decimal ("0.47s"), not a Kubernetes age column.
const MEASURED_DURATION_PREFIX_PATTERN =
  /(?:[\d.=(]|\d[dhm]\s|\b(?:in|after|for|within|than|every|took|elapsed|timeout|ttl|delay|interval|wait|waiting|waited)[\s:=]+)$/iu;
const AGO_SUFFIX_PATTERN = /^\s+ago\b/u;
// Every CSI sequence (colors, cursor movement, erase line, cursor hide) and
// OSC sequence (hyperlinks, window titles), not only SGR colors.
const ANSI_ESCAPE_PATTERN =
  /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/gu;
const IPV4_WITH_PORT_PATTERN =
  /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}:(?:6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]?\d{1,4})\b/gu;
const IPV4_PATTERN =
  /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/gu;
const IPV6_PATTERN =
  /(?:(?:[0-9a-fA-F]{1,4}:){2,}:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*|(?:[0-9a-fA-F]{1,4}:){4,}[0-9a-fA-F]{1,4}|::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})+)/gu;

// ---- PII/demographic patterns ----

const EMAIL_PATTERN =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b/gu;

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

// Authorization header (handles "Authorization: Bearer <value>" and similar)
const AUTHORIZATION_HEADER_PATTERN =
  /\bAuthorization\s*:\s*\S+(?:\s+\S+)*/giu;

// Generic secret fields: KEY=value, key: value, key := value and quoted JSON /
// dict properties ("key": "value"). The pieces are joined into one pattern
// with three groups: 1 the name, 2 the quote around the key (if any) and 3 the
// raw value. The pattern only finds the value; maskSecretField decides whether
// it is a secret, so what is judged is always exactly what is replaced.
const SECRET_FIELD_PATTERN = new RegExp(
  [
    // A key that ENDS in a name matches (DB_PASSWORD, apiKey, x-api-key,
    // spring.datasource.password), so there is no word boundary in front.
    String.raw`(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|bearer|`,
    // auth and credentials are also plain words in logs and prose
    // ("supabase auth: gotrue service started"). They count as the end of a
    // longer key (basic_auth, x-auth), as a quoted key, or with an = style
    // separator, but not as a bare "auth:" label.
    String.raw`(?:auth|credentials)(?:(?<=[\w.-]auth|[\w.-]credentials)|(?![ \t]*:(?!=))))`,
    // The (?![=>]) keeps "token === x" and "token => x" (comparisons and arrow
    // functions) out, and stops the separator from backing off into the value.
    String.raw`(\\?["'])?[ \t]*(?::=|=|:)(?![=>])[ \t]*`,
    // A quoted string, or a bare token that stops at quotes and commas so the
    // surrounding syntax survives. After an opening quote there is always a
    // match: a missing closing quote or an odd escape takes the rest of the
    // line instead of leaking. The escaped form is JSON logged inside a string.
    // A ${...} or $(...) body may hold spaces, so it is taken whole (bounded
    // so that a crafted line cannot make the scan quadratic).
    String.raw`(\\"(?:(?!\\").)*(?:\\")?`,
    String.raw`|"(?:[^"\\]|\\[\s\S]|\\$)*"?`,
    String.raw`|'(?:[^'\\]|\\[\s\S]|\\$)*'?`,
    String.raw`|\$(?:\((?:[^()]|\([^()]*\)){0,200}\)|\{[^}]{0,200}\})[^\s"',;]*`,
    String.raw`|[^\s"',;]+)`,
  ].join(''),
  'giu',
);

// Values of a secret field that carry no secret, judged on the whole value
// with one pair of quotes removed: empty, null, true, false, a number of up to
// three digits, or a plain reference to a variable ($NAME, ${NAME}) or a
// GitHub expression (${{ ... }}). A reference with a default or a command
// (${NAME:-x}, $(cmd)) or with anything after it ($HOME/x, ${NAME}x) is not.
const SECRET_PLAIN_VALUE_PATTERN = /^(?:null|true|false|\d{1,3})$/iu;
const SECRET_REFERENCE_PATTERN =
  /^\$(?:[A-Za-z_]\w*|\{[A-Za-z_][\w.]*\}|\{\{[^}]{0,200}\}\})$/u;
const QUOTED_VALUE_PATTERN = /^(\\"|"|')([\s\S]*)\1$/u;
// PWD and OLDPWD hold a directory in every environment dump, not a password.
const ENV_PWD_PATTERN = /(?<![\w.-])(?:OLD)?PWD$/u;

// Stripe API keys (sk_live_, pk_live_, rk_live_, sk_test_, etc.)
const STRIPE_KEY_PATTERN =
  /\b(?:sk|pk|rk)_(?:live|test)_[0-9A-Za-z]{24,99}\b/gu;

// npm access tokens
const NPM_TOKEN_PATTERN = /\bnpm_[A-Za-z0-9]{36,80}\b/gu;

// Google API keys
const GOOGLE_API_KEY_PATTERN = /\bAIza[0-9A-Za-z_-]{30,40}\b/gu;

// Twilio API keys
const TWILIO_KEY_PATTERN = /\b(?:SK|AC)[a-f0-9]{32}\b/gu;

// SendGrid API keys
const SENDGRID_KEY_PATTERN =
  /\bSG\.[A-Za-z0-9_-]{16,32}\.[A-Za-z0-9_-]{32,64}\b/gu;

// ---- Hash/ID patterns ----

const HEX_HASH_PATTERN = /\b(?=[a-f0-9]*\d)(?=[a-f0-9]*[a-f])[a-f0-9]{16,128}\b/giu;
const ALPHANUMERIC_HASH_PATTERN =
  /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{24,512}\b/gu;
const AWS_ACCESS_KEY_PATTERN = /\b(?:AKIA|ABIA|ASIA)[0-9A-Z]{16}\b/gu;
const AWS_ARN_ACCOUNT_PATTERN = /arn:aws:[a-z0-9-]+:[a-z0-9-]+:(\d{12})/gu;

/** Remove every ANSI CSI and OSC escape sequence from a line. */
export function stripAnsi(line: string): string {
  return line.includes('\u001b') ? line.replace(ANSI_ESCAPE_PATTERN, '') : line;
}

function maskAge(match: string, offset: number, whole: string): string {
  const before = whole.slice(Math.max(0, offset - 16), offset);
  // "(2m36s ago)" is an age even though it sits in parentheses; "(1s)" is
  // a test runner's measurement.
  const agoFollows = AGO_SUFFIX_PATTERN.test(whole.slice(offset + match.length, offset + match.length + 6));
  if (agoFollows) return '[AGO]';
  return MEASURED_DURATION_PREFIX_PATTERN.test(before) ? match : '[AGO]';
}

// ---- Credential masking ----
//
// Shared by the log pipeline (sanitizeLine) and by text passthrough, which
// must not copy credentials out of a config, env dump or document. The rules
// are split in two because sanitizeLine runs the hash and email masks between
// them: the vendor patterns have to see tokens before the hash rules can
// consume them, while the AWS keys and the entropy fallback run on whatever
// the hash rules left behind. maskSecrets applies both halves in that order.

function isHarmlessValue(value: string): boolean {
  const inner = QUOTED_VALUE_PATTERN.exec(value)?.[2] ?? value;
  return (
    inner === '' ||
    SECRET_PLAIN_VALUE_PATTERN.test(inner) ||
    SECRET_REFERENCE_PATTERN.test(inner)
  );
}

function maskSecretField(
  match: string,
  name: string,
  keyQuote: string | undefined,
  value: string,
  offset: number,
  whole: string,
): string {
  // The last 7 characters up to the end of the name hold "OLDPWD" and the
  // character before it, which is all the pattern looks at.
  const nameEnd = offset + name.length;
  if (
    value.startsWith('/') &&
    ENV_PWD_PATTERN.test(whole.slice(Math.max(0, nameEnd - 7), nameEnd))
  ) {
    return match;
  }
  const head = match.slice(0, match.length - value.length);
  if (keyQuote === undefined) {
    return isHarmlessValue(value) ? match : `${head}[REDACTED]`;
  }
  // "auth": {...} is an object; its own fields are masked on their own.
  if (value.startsWith('{') || value.startsWith('[')) return match;
  // A quoted key marks JSON or a dict: the brace or bracket that closed the
  // pair is not part of the value, and the value stays a string so the line
  // still parses.
  const closing = /[}\]]*$/u.exec(value)![0];
  if (isHarmlessValue(value.slice(0, value.length - closing.length))) return match;
  return `${head}${keyQuote}[REDACTED]${keyQuote}${closing}`;
}

function maskVendorSecrets(line: string): string {
  let result = line;
  if (result.includes('://')) {
    result = result.replace(CONNECTION_STRING_PATTERN, (match, pwd: string) =>
      match.replace(pwd, '[REDACTED]'),
    );
  }
  if (result.includes('gh')) result = result.replace(GITHUB_TOKEN_PATTERN, '[REDACTED]');
  if (result.includes('eyJ')) result = result.replace(JWT_TOKEN_PATTERN, '[JWT]');
  if (result.includes('xox')) result = result.replace(SLACK_TOKEN_PATTERN, '[REDACTED]');
  if (result.includes('_live_') || result.includes('_test_')) {
    result = result.replace(STRIPE_KEY_PATTERN, '[REDACTED]');
  }
  if (result.includes('npm_')) result = result.replace(NPM_TOKEN_PATTERN, '[REDACTED]');
  if (result.includes('AIza')) result = result.replace(GOOGLE_API_KEY_PATTERN, '[REDACTED]');
  if (result.includes('SK') || result.includes('AC')) {
    result = result.replace(TWILIO_KEY_PATTERN, '[REDACTED]');
  }
  if (result.includes('SG.')) result = result.replace(SENDGRID_KEY_PATTERN, '[REDACTED]');
  if (result.includes('uthorization')) {
    result = result.replace(AUTHORIZATION_HEADER_PATTERN, 'Authorization: [REDACTED]');
  }
  result = result.replace(SECRET_FIELD_PATTERN, maskSecretField);
  return result;
}

function maskLateSecrets(line: string): string {
  let result = line;
  if (result.includes('AKIA') || result.includes('ABIA') || result.includes('ASIA')) {
    result = result.replace(AWS_ACCESS_KEY_PATTERN, '[REDACTED]');
  }
  if (result.includes('arn:aws:')) {
    result = result.replace(AWS_ARN_ACCOUNT_PATTERN, (match, accountId: string) =>
      match.replace(accountId, '[ACCOUNT]'),
    );
  }
  // High-entropy fallback for credentials no vendor pattern recognizes.
  result = maskHighEntropyTokens(result);
  return result;
}

/**
 * Mask credentials in one line: GitHub, Slack, Stripe, npm, Google, Twilio,
 * SendGrid and AWS keys, JWTs, connection-string passwords, Authorization
 * headers, password/token/secret fields, AWS account ids and any other
 * high-entropy token. Identifiers, timestamps, IPs and emails stay as they
 * are. PEM private key blocks span lines and are handled by maskPemBlock.
 */
export function maskSecrets(line: string): string {
  return maskLateSecrets(maskVendorSecrets(line));
}

export function sanitizeLine(line: string, preserveIdSuffix = 0): string {
  const uuidReplacement =
    preserveIdSuffix > 0
      ? (m: string) => `[ID:${m.slice(-preserveIdSuffix)}]`
      : () => '[ID]';
  const hexHashReplacement =
    preserveIdSuffix > 0
      ? (m: string) => `[HASH:${m.slice(-preserveIdSuffix)}]`
      : () => '[HASH]';
  const alnumHashReplacement =
    preserveIdSuffix > 0
      ? (m: string) => `[HASH:${m.slice(-preserveIdSuffix)}]`
      : () => '[HASH]';

  // Each expensive regex is gated by a cheap substring implied by the
  // pattern itself, so the common case (a plain log line) pays for a few
  // includes() calls instead of ~25 regex scans.
  let result = line;
  result = stripAnsi(result);
  if (result.includes('-')) {
    result = result
      .replace(UUID_PATTERN, uuidReplacement)
      .replace(ISO_TIME_PATTERN, '[TIME]');
  }
  if (result.includes('GMT') || result.includes('UTC')) {
    result = result.replace(UTC_TIME_PATTERN, '[TIME]');
  }
  if (result.includes('[')) {
    result = result.replace(APACHE_ERROR_TIME_PATTERN, '[TIME]');
  }
  if (result.includes('/')) {
    result = result
      .replace(COMMON_LOG_TIME_PATTERN, '[TIME]')
      .replace(NGINX_ERROR_TIME_PATTERN, '[TIME]');
  }
  if (result.includes(':')) {
    result = result
      .replace(SYSLOG_TIME_PATTERN, '[TIME]')
      .replace(DAY_MONTH_TIME_PATTERN, '[TIME]')
      .replace(TIME_OF_DAY_PATTERN, '[TIME]');
  }
  if (result.includes('"')) {
    result = result.replace(EPOCH_JSON_FIELD_PATTERN, '$1"[TIME]"');
  }
  if (result.includes('=')) {
    result = result.replace(EPOCH_LOGFMT_FIELD_PATTERN, '$1=[TIME]');
  }
  if (result.includes('.')) {
    result = result
      .replace(IPV4_WITH_PORT_PATTERN, '[IP]:[PORT]')
      .replace(IPV4_PATTERN, '[IP]');
  }
  if (result.includes(':')) {
    result = result.replace(IPV6_PATTERN, '[IPV6]');
  }
  // Secrets (before hex/hash to avoid those patterns consuming tokens)
  result = maskVendorSecrets(result);
  result = result.replace(K8S_RELATIVE_DURATION_PATTERN, maskAge);
  if (result.includes('@')) result = result.replace(EMAIL_PATTERN, '[EMAIL]');
  result = result
    .replace(HEX_HASH_PATTERN, hexHashReplacement)
    .replace(ALPHANUMERIC_HASH_PATTERN, alnumHashReplacement);
  result = maskLateSecrets(result);
  result = result.replace(/[ \t]+$/u, '');

  // HTTP status code grouping
  result = groupHttpStatusCodes(result);

  return result;
}
