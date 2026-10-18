import { describe, expect, it } from 'vitest';
import { processLogString } from '../src/core/logstrip-parser';

const BODY = [
  'MIIEowIBAAKCAQEAo3b8nJBC8ZwB6YyxGQZBnCl2uPq0',
  'Zk1sQ0xfT2dRbEh3S1k0V1RqZ3NtTnR0b2VqVDVQbHZ5',
  'a2V5LWJvZHktbGluZS10aHJlZS13aXRoLXNsYXNoZXMv',
];

function logWith(header: string, footer: string): string {
  return [
    '[ERROR] deploy step failed',
    header,
    ...BODY,
    footer,
    '[ERROR] cleanup failed after key dump',
    '',
  ].join('\n');
}

function expectNoBody(output: string): void {
  for (const line of BODY) {
    expect(output).not.toContain(line);
  }
  expect(output).not.toContain('-----BEGIN');
  expect(output).not.toContain('-----END');
}

describe('PEM blocks and noise filters', () => {
  it('redacts the body when the header carries a noise-level prefix', async () => {
    const { output } = await processLogString(
      logWith(
        'DEBUG -----BEGIN RSA PRIVATE KEY-----',
        '-----END RSA PRIVATE KEY-----',
      ),
    );

    expectNoBody(output);
    expect(output).toContain('[PEM PRIVATE KEY REDACTED]');
    expect(output).toContain('[ERROR] cleanup failed after key dump');
  });

  it('redacts the body when the header carries a bracketed INFO tag', async () => {
    const { output } = await processLogString(
      logWith('[INFO] -----BEGIN PRIVATE KEY-----', '-----END PRIVATE KEY-----'),
    );

    expectNoBody(output);
    expect(output).toContain('[PEM PRIVATE KEY REDACTED]');
  });

  it('closes the block when the footer carries a noise-level prefix', async () => {
    const { output } = await processLogString(
      logWith(
        '-----BEGIN RSA PRIVATE KEY-----',
        '2026-05-16T10:18:07.141Z  INFO 181 --- [app] [main] c.a.Foo : -----END RSA PRIVATE KEY-----',
      ),
    );

    expectNoBody(output);
    expect(output).toContain('[PEM PRIVATE KEY REDACTED]');
    expect(output).toContain('[ERROR] cleanup failed after key dump');
  });

  it('keeps tracking the block when an exclude filter drops the header', async () => {
    const { output } = await processLogString(
      logWith('-----BEGIN RSA PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----'),
      { exclude: /BEGIN/u },
    );

    expectNoBody(output);
    expect(output).toContain('[ERROR] cleanup failed after key dump');
  });

  it('keeps tracking the block when the severity filter drops the header', async () => {
    const { output } = await processLogString(
      logWith('DEBUG -----BEGIN RSA PRIVATE KEY-----', 'TRACE -----END RSA PRIVATE KEY-----'),
      { severity: 'error' },
    );

    expectNoBody(output);
    expect(output).toContain('[ERROR] cleanup failed after key dump');
  });

  it('keeps tracking the block when a custom ignore pattern drops the header', async () => {
    const { output } = await processLogString(
      logWith('-----BEGIN EC PRIVATE KEY-----', '-----END EC PRIVATE KEY-----'),
      { config: { sources: [], diagnosticPatterns: [], ignorePatterns: ['BEGIN EC'], sanitizePatterns: [], internalStackPatterns: [] } },
    );

    expectNoBody(output);
  });

  it('warns about an unterminated block whose header was dropped as noise', async () => {
    const input = ['[ERROR] deploy step failed', 'DEBUG -----BEGIN RSA PRIVATE KEY-----', ...BODY, ''].join('\n');
    const { output } = await processLogString(input);

    expectNoBody(output);
    expect(output).toContain('[PEM block unterminated - input redacted]');
  });

  it('reports body lines of a dropped header as custom-ignore decisions', async () => {
    const reasons: string[] = [];
    await processLogString(
      logWith('DEBUG -----BEGIN RSA PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----'),
      { onDecision: (decision) => reasons.push(decision.reason) },
    );

    expect(reasons.filter((reason) => reason === 'custom-ignore')).toHaveLength(BODY.length + 1);
  });
});
