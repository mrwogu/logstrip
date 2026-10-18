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
