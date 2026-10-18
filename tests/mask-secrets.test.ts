import { describe, expect, it } from 'vitest';
import { maskSecrets, sanitizeLine } from '../src/core/sanitize/sanitize-line';

// Fake credentials, assembled from pieces so secret scanners ignore the file.
const GITHUB_TOKEN = `ghp_${'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6'}`;
const JWT = `eyJ${'hbGciOiJIUzI1NiIsInR5cCI6'}.${'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFt'}.${'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'}`;
const SLACK_TOKEN = `xoxb-1234567890-1234567890-${'abcdefghijklmnopqrstuvwx'}`;
const STRIPE_KEY = `sk_live_${'abcdefghijklmnopqrstuvwx'}`;
const NPM_TOKEN = `npm_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}`;
const GOOGLE_KEY = `AIza${'SyA1234567890abcdefghijklmnopqrstuv'}`;
const TWILIO_KEY = `SK${'0123456789abcdef0123456789abcdef'}`;
const SENDGRID_KEY = `SG.${'abcdefghijklmnop'}.${'a'.repeat(43)}`;
const AWS_KEY = `AKIA${'IOSFODNN7EXAMPLE'}`;
const RANDOM_TOKEN = 'dGhpcyBpcyBhIHNlY3JldCB0b2tlbiB2YWx1ZQ+AbC12';

const MASKED: ReadonlyArray<readonly [string, string, string]> = [
  ['GitHub token', `clone with ${GITHUB_TOKEN} please`, 'clone with [REDACTED] please'],
  ['JWT', `bearer ${JWT} sent`, 'bearer [JWT] sent'],
  [
    'connection string password',
    'url postgres://admin:s3cr3tP4ss@db.internal:5432/app',
    'url postgres://admin:[REDACTED]@db.internal:5432/app',
  ],
  ['Slack token', `hook ${SLACK_TOKEN}`, 'hook [REDACTED]'],
  [
    'Authorization header',
    'Authorization: Bearer abc.def.ghi extra',
    'Authorization: [REDACTED]',
  ],
  ['password field', 'password=hunter2', 'password=[REDACTED]'],
  ['secret field with a quoted value', "api_key: 'abc 123'", 'api_key: [REDACTED]'],
  ['client secret field', 'client_secret: abcd1234', 'client_secret: [REDACTED]'],
  ['Stripe key', `key ${STRIPE_KEY}`, 'key [REDACTED]'],
  ['npm token', `//registry/:_authToken=${NPM_TOKEN}`, '//registry/:_authToken=[REDACTED]'],
  ['Google API key', `key=${GOOGLE_KEY}`, 'key=[REDACTED]'],
  ['Twilio key', `sid ${TWILIO_KEY}`, 'sid [REDACTED]'],
  ['SendGrid key', `mail ${SENDGRID_KEY}`, 'mail [REDACTED]'],
  ['AWS access key', `id ${AWS_KEY}`, 'id [REDACTED]'],
  [
    'AWS account id in an ARN',
    'queue arn:aws:sqs:us-east-1:123456789012:jobs',
    'queue arn:aws:sqs:us-east-1:[ACCOUNT]:jobs',
  ],
  ['high-entropy token', `blob ${RANDOM_TOKEN} end`, 'blob [REDACTED] end'],
];

const UNTOUCHED: ReadonlyArray<readonly [string, string]> = [
  ['UUID', 'request 123e4567-e89b-12d3-a456-426614174000 failed'],
  ['ISO timestamp', 'at 2024-01-15T10:23:45.123Z the job ran'],
  ['hex hash', 'commit 0123456789abcdef0123456789abcdef01234567'],
  ['IPv4 address with port', 'listening on 10.0.0.1:8080'],
  ['email address', 'contact ops@example.com'],
  ['relative duration', 'restarted 3h2m1s ago'],
  ['ANSI color', '\u001b[31mred\u001b[0m'],
  ['prose', 'The quick brown fox jumps over the lazy dog.'],
  ['kebab-case identifier', 'use the very-long-kebab-case-identifier-name-here'],
  ['empty line', ''],
];

const AWS_SECRET = `${'wJalrXUtnFEMI/K7MDENG/'}${'bPxRfiCYEXAMPLEKEY'}`;

// Secret fields: the key may carry a prefix, in any case style, and JSON or
// dict properties are masked as well. Values are short and plain so that the
// log sanitizer leaves them to the field rule.
const FIELD_MASKED: ReadonlyArray<readonly [string, string, string]> = [
  ['an env-style key with a prefix', 'DB_PASSWORD=hunter2', 'DB_PASSWORD=[REDACTED]'],
  ['an API token variable', 'API_TOKEN=abc123', 'API_TOKEN=[REDACTED]'],
  [
    'an AWS secret access key',
    `AWS_SECRET_ACCESS_KEY=${AWS_SECRET}`,
    'AWS_SECRET_ACCESS_KEY=[REDACTED]',
  ],
  ['an npm token variable', 'NPM_TOKEN=abc123', 'NPM_TOKEN=[REDACTED]'],
  ['a camelCase key', 'dbPassword=hunter2', 'dbPassword=[REDACTED]'],
  ['a camelCase key with a colon', 'apiKey: abc12345', 'apiKey: [REDACTED]'],
  ['a kebab-case header', 'X-Api-Key: abc123', 'X-Api-Key: [REDACTED]'],
  ['a kebab-case auth token header', 'x-auth-token: abc123', 'x-auth-token: [REDACTED]'],
  ['a dotted property key', 'spring.datasource.password=hunter2', 'spring.datasource.password=[REDACTED]'],
  ['passwd', 'DB_PASSWD=hunter2', 'DB_PASSWD=[REDACTED]'],
  ['pwd in a connection string', 'Pwd=s3cret;Uid=sa', 'Pwd=[REDACTED];Uid=sa'],
  ['pwd with a value that is not a path', 'DB_PWD=hunter2', 'DB_PWD=[REDACTED]'],
  ['access_key', 'access-key=abc123xyz', 'access-key=[REDACTED]'],
  ['private_key', 'privateKey: abc123xyz', 'privateKey: [REDACTED]'],
  ['apikey without a separator', 'APIKEY=abc123xyz', 'APIKEY=[REDACTED]'],
  ['credentials with an = separator', 'AWS_CREDENTIALS=abc123xyz', 'AWS_CREDENTIALS=[REDACTED]'],
  ['auth at the end of a longer key', 'proxy-auth: dXNlcjpwYXNz', 'proxy-auth: [REDACTED]'],
  ['auth with an = separator', 'AUTH=abc123xyz', 'AUTH=[REDACTED]'],
  ['a := separator', 'secret := hunter2', 'secret := [REDACTED]'],
  ['spaces around the separator', 'password   =   hunter2', 'password   =   [REDACTED]'],
  ['a bare number of four digits', 'pin_token: 1234', 'pin_token: [REDACTED]'],
  ['a JSON property', '{"password": "hunter2"}', '{"password": "[REDACTED]"}'],
  ['a JSON property without spaces', '{"client_secret":"abcd1234"}', '{"client_secret":"[REDACTED]"}'],
  [
    'a JSON property with punctuation in the value',
    '{"a":1,"password":"p@ss, word","b":2}',
    '{"a":1,"password":"[REDACTED]","b":2}',
  ],
  ['a JSON property with an escaped quote', '{"password":"pa\\"ss","b":2}', '{"password":"[REDACTED]","b":2}'],
  ['a JSON number', '{"token": 123456}', '{"token": "[REDACTED]"}'],
  ['a JSON number that ends the object', '{"a":{"token":123456}}', '{"a":{"token":"[REDACTED]"}}'],
  ['a dict repr', "{'password': None}", "{'password': '[REDACTED]'}"],
  [
    'JSON that was logged inside a string',
    'body {\\"password\\":\\"hunter2\\",\\"user\\":\\"bob\\"}',
    'body {\\"password\\":\\"[REDACTED]\\",\\"user\\":\\"bob\\"}',
  ],
  ['a quoted value after an env-style key', 'password="pa\\"ss word"', 'password=[REDACTED]'],
  // An opening quote always yields a redaction, closed or not.
  ['a double-quoted value with no closing quote', 'password="hunter2', 'password=[REDACTED]'],
  ['a single-quoted value with no closing quote', "password='hunter2", 'password=[REDACTED]'],
  ['a lone opening quote', 'password="', 'password=[REDACTED]'],
  ['an unterminated value that runs to the end of the line', 'password="hunter2 and then some text', 'password=[REDACTED]'],
  ['an unterminated value ending in a backslash', 'password="hunter2\\', 'password=[REDACTED]'],
  ['an unterminated value with an escaped quote', 'password="pa\\"ss', 'password=[REDACTED]'],
  ['an unterminated JSON property', '{"password": "hunter2', '{"password": "[REDACTED]"'],
  [
    'an unterminated JSON property logged inside a string',
    'body {\\"password\\":\\"hunter2',
    'body {\\"password\\":\\"[REDACTED]\\"',
  ],
  ['a JSON property with an unusual escape', '{"password":"pa\\qss","b":2}', '{"password":"[REDACTED]","b":2}'],
  // A reference is exempt only when it is the whole value and has no body.
  ['a variable with a default', 'DB_PASSWORD=${DB_PASSWORD:-hunter2}', 'DB_PASSWORD=[REDACTED]'],
  ['a variable with an assigned default', 'DB_PASSWORD=${DB_PASSWORD:=hunter2}', 'DB_PASSWORD=[REDACTED]'],
  ['a command substitution', 'password=$(cat secret)', 'password=[REDACTED]'],
  ['a command substitution that holds the secret', 'password=$(echo hunter2) next', 'password=[REDACTED] next'],
  ['a nested command substitution', 'password=$(echo $(cat f)) next', 'password=[REDACTED] next'],
  ['a quoted command substitution', 'password: "$(cat secret)"', 'password: [REDACTED]'],
  ['a default with spaces', 'password=${PASS:-a b c} tail', 'password=[REDACTED] tail'],
  ['a variable followed by more characters', 'password=${PASS}extra', 'password=[REDACTED]'],
  ['a quoted variable followed by more characters', 'password="${PASS}extra"', 'password=[REDACTED]'],
  ['a plain variable followed by more characters', 'password=$PASS!x', 'password=[REDACTED]'],
  ['a GitHub expression followed by more characters', 'token: ${{ secrets.X }}extra', 'token: [REDACTED]'],
  ['an empty variable name', 'password=${}', 'password=[REDACTED]'],
  ['a variable with a path after it', 'password=$HOME/x', 'password=[REDACTED]'],
  ['a quoted variable with a character after it', 'password="${PASS}x"', 'password=[REDACTED]'],
  ['a variable with a default (whole line)', 'password=${PASS:-hunter2}', 'password=[REDACTED]'],
  ['an unterminated quote after another name', 'secret="abc', 'secret=[REDACTED]'],
  ['a variable and a closing bracket and more text', 'password=${PASS})hunter2', 'password=[REDACTED]'],
  ['a keyword and a closing brace and more text', 'password=null}hunter2', 'password=[REDACTED]'],
  ['a GitHub expression with text after it', 'password=${{ secrets.X }}hunter2', 'password=[REDACTED]'],
  ['a variable in brackets, the bracket is part of the value', 'connect(password=${DB_PASSWORD})', 'connect(password=[REDACTED]'],
  ['a reference followed by a backtick', 'set `token: ${{ secrets.X }}` now', 'set `token: [REDACTED] now'],
  ['a pwd value that is a path under a prefixed key', 'DB_PWD=/s3cret', 'DB_PWD=[REDACTED]'],
  ['a lower-case pwd with a path', 'pwd=/home/x', 'pwd=[REDACTED]'],
  ['PWD with a value that is not a path', 'PWD=hunter2', 'PWD=[REDACTED]'],
  ['a prefix glued to OLDPWD', 'xOLDPWD=/s3cret', 'xOLDPWD=[REDACTED]'],
  ['a numbered variable', 'password=${1}', 'password=[REDACTED]'],
];

// What the field rule has to leave alone: values that carry no secret, keys
// that merely contain a name, and look-alikes in prose and code.
const FIELD_KEPT: ReadonlyArray<readonly [string, string]> = [
  ['an empty value', 'password='],
  ['an empty value after a space', 'password: '],
  ['a quoted empty value', '{"password": ""}'],
  ['a single-quoted empty value', "password: ''"],
  ['an escaped empty value', 'body {\\"password\\":\\"\\"}'],
  ['null', '{"password": null}'],
  ['NULL in another case', 'password: NULL'],
  ['true', 'token=true'],
  ['false at the end of an object', '{"auth":false}'],
  ['a one digit number', 'secret=1'],
  ['a three digit number', 'token: 999'],
  ['a GitHub expression', 'token: ${{ secrets.NPM_TOKEN }}'],
  ['a GitHub expression behind a prefixed key', 'NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}'],
  ['a variable reference', 'DB_PASSWORD=${DB_PASSWORD}'],
  ['a quoted variable reference', 'password: "${DB_PASSWORD}"'],
  ['a plain variable', 'password=$DB_PASSWORD'],
  ['a plain variable behind token', 'token: $TOKEN'],
  ['a GitHub expression behind token', 'token: ${{ secrets.X }}'],
  ['a quoted keyword', 'password: "true"'],
  ['a quoted short number', 'token: "123"'],
  ['a short number in JSON', '{"token": 12}'],
  ['a boolean nested in JSON', '{"a":{"auth":true}}'],
  ['a variable with a dot in the name', 'password=${app.db_password}'],
  ['a variable followed by a comma', 'token=${NPM_TOKEN},retries=3'],
  ['a single-quoted variable', "password='$DB_PASSWORD'"],
  ['a variable in a JSON property', '{"password": "${DB_PASSWORD}"}'],
  ['a variable in JSON that was logged inside a string', 'body {\\"password\\":\\"${PASS}\\"}'],
  ['a GitHub expression as the whole value', 'password: ${{ secrets.DB_PASSWORD }}'],
  ['a JSON object', '{"auth": {"type":"basic"}}'],
  ['a JSON array', '{"credentials": [1,2]}'],
  ['the PWD variable', 'PWD=/home/runner/work/app'],
  ['the OLDPWD variable', 'OLDPWD=/tmp'],
  ['a bare auth label', '[INFO] supabase auth: gotrue service started'],
  ['a bare credentials label', 'passed through unchanged except for credentials: tokens'],
  ['a comparison', 'if (token === expected) return'],
  ['an arrow function', 'const check = token => token.length'],
  ['a key that only starts with a name', 'author: John Smith'],
  ['a plural name', 'tokens: 5000'],
  ['a name followed by a suffix', 'PRIVATE_KEY_PATH=/etc/ssl/private/app.key'],
  ['a name inside a longer word', 'passwords are rotated weekly'],
];

describe('maskSecrets', () => {
  it.each(MASKED)('masks %s', (_name, input, expected) => {
    expect(maskSecrets(input)).toBe(expected);
  });

  it.each(UNTOUCHED)('leaves %s alone', (_name, input) => {
    expect(maskSecrets(input)).toBe(input);
  });

  it('masks several credentials in one line', () => {
    const line = `${GITHUB_TOKEN} ${AWS_KEY} password=hunter2`;

    expect(maskSecrets(line)).toBe('[REDACTED] [REDACTED] password=[REDACTED]');
  });

  it('is idempotent', () => {
    for (const [, input] of MASKED) {
      const once = maskSecrets(input);
      expect(maskSecrets(once)).toBe(once);
    }
  });

  it('masks the vendor credentials exactly like the log sanitizer', () => {
    // sanitizeLine also masks IPs, ids and timestamps, but none of these
    // lines contain any, so both must agree. The high-entropy fallback is
    // left out: sanitizeLine hashes a long token before that rule can see it,
    // maskSecrets has no hash rule and masks it whole.
    for (const [name, input, expected] of MASKED) {
      if (name !== 'high-entropy token') {
        expect(sanitizeLine(input)).toBe(expected);
      }
    }
    expect(sanitizeLine(`blob ${RANDOM_TOKEN} end`)).toBe('blob [HASH]+AbC12 end');
  });
});

describe('maskSecrets secret fields', () => {
  it.each(FIELD_MASKED)('masks %s', (_name, input, expected) => {
    expect(maskSecrets(input)).toBe(expected);
  });

  it.each(FIELD_KEPT)('leaves %s alone', (_name, input) => {
    expect(maskSecrets(input)).toBe(input);
  });

  it('masks the same fields in log lines and leaves the same ones alone', () => {
    for (const [, input, expected] of FIELD_MASKED) {
      expect(sanitizeLine(input)).toBe(expected);
    }
    for (const [, input] of FIELD_KEPT) {
      // The log sanitizer also trims trailing whitespace.
      expect(sanitizeLine(input)).toBe(input.trimEnd());
    }
  });

  it('is idempotent on masked fields', () => {
    for (const [, input] of FIELD_MASKED) {
      const once = maskSecrets(input);
      expect(maskSecrets(once)).toBe(once);
    }
  });

  it('masks every field in a line, not only the first', () => {
    expect(maskSecrets('DB_PASSWORD=hunter2 API_TOKEN=abc123 DB_USER=app')).toBe(
      'DB_PASSWORD=[REDACTED] API_TOKEN=[REDACTED] DB_USER=app',
    );
  });
});
