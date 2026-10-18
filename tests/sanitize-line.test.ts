import { describe, expect, it } from 'vitest';
import { pairGroups } from './helpers/tables';
import { processLogString } from '../src/core/logstrip-parser';
import { sanitizeLine } from '../src/core/sanitize/sanitize-line';

type SanitizeGroup = readonly [
  name: string,
  rows: ReadonlyArray<readonly [input: string, expected: string]>,
];

function expectSanitized(rows: SanitizeGroup[1]): void {
  for (const [input, expected] of rows) expect(sanitizeLine(input), input).toBe(expected);
}

const TIMESTAMP_SHAPES: readonly SanitizeGroup[] = pairGroups(String.raw`
@@ masks comma-fraction timestamps from Python logging and log4j
2026-05-16 10:24:31,044 - app.worker - INFO - started => [TIME] - app.worker - INFO - started
2026-05-16 10:24:31,044 [main] WARN c.a.Foo - slow => [TIME] [main] WARN c.a.Foo - slow
@@ absorbs a trailing zone word or offset into the timestamp
2026-05-16 10:24:31.044 UTC [1234] ERROR:  boom => [TIME] [1234] ERROR:  boom
2026-05-16 10:24:31 GMT done => [TIME] done
[2026-05-16 10:24:31 +0000] [7] ready => [[TIME]] [7] ready
2026-05-16 10:24:31 -04:00 ready => [TIME] ready
@@ masks syslog and date(1) style month-name timestamps
May 16 10:24:31 host kernel: Out of memory => [TIME] host kernel: Out of memory
May  6 10:24:31 host sshd[4411]: Failed password => [TIME] host sshd[4411]: Failed password
Sat May 16 10:24:31 deploy failed => [TIME] deploy failed
@@ masks day-month-year timestamps from Tomcat, PHP and Redis
16-May-2026 10:24:31.011 SEVERE [main] boom => [TIME] SEVERE [main] boom
[16-May-2026 10:24:31 UTC] PHP Fatal error: boom => [[TIME]] PHP Fatal error: boom
1:M 16 May 2026 10:24:31.011 # Warning: no config => 1:M [TIME] # Warning: no config
@@ masks Go log package timestamps with microseconds
2026/05/16 10:24:31.044123 server.go:42: listening => [TIME] server.go:42: listening
@@ masks bare time of day with optional fraction
10:24:31.011 [main] DEBUG c.a.Foo - hi => [TIME] [main] DEBUG c.a.Foo - hi
[10:24:31] ERROR something broke => [[TIME]] ERROR something broke
retry at 10:24:31, then stop => retry at [TIME], then stop
@@ leaves digit runs, MAC addresses and IPv6 groups alone
version 1.10:24:31 weird => version 1.10:24:31 weird
mac 00:11:22:33:44:55 on eth0 => mac [IPV6] on eth0
addr 2001:0db8:0000:0042:0000:8a2e:0370:7334 up => addr [IPV6] up
ratio 1:10:24:31 => ratio 1:10:24:31
@@ masks numeric epoch values under time-like JSON keys
{\"level\":30,\"time\":1715855071123,\"pid\":1,\"msg\":\"hi\"} => {\"level\":30,\"time\":\"[TIME]\",\"pid\":1,\"msg\":\"hi\"}
{\"ts\": 1715855071.123456 } => {\"ts\": \"[TIME]\" }
{\"@timestamp\":1715855071} => {\"@timestamp\":\"[TIME]\"}
@@ keeps numeric JSON values under other keys
{\"requestId\":1715855071123,\"time\":42} => {\"requestId\":1715855071123,\"time\":42}
@@ masks numeric epoch values under time-like logfmt keys
ts=1715855071 level=error msg=\"boom\" => ts=[TIME] level=error msg=\"boom\"
time=1715855071.5 level=warn => time=[TIME] level=warn
retries=1715855071 level=warn => retries=1715855071 level=warn
`, (text) => text);

describe('sanitizeLine timestamp shapes', () => {
  it.each(TIMESTAMP_SHAPES)('%s', (_name, rows) => expectSanitized(rows));
});

describe('timestamp masking lets repeated events fold', () => {
  it('folds Python logging lines that differ only in comma milliseconds', async () => {
    const lines = [
      '2026-05-16 10:24:31,044 - app.worker - ERROR - redis connection lost',
      '2026-05-16 10:24:32,051 - app.worker - ERROR - redis connection lost',
      '2026-05-16 10:24:33,207 - app.worker - ERROR - redis connection lost',
    ];
    const result = await processLogString(`${lines.join('\n')}\n`);

    expect(result.output).toBe('[x3] [TIME] - app.worker - ERROR - redis connection lost\n');
  });

  it('folds syslog lines that differ only in the time of day', async () => {
    const lines = [
      'May 16 10:24:31 host app[1]: FATAL: database connection timeout',
      'May 16 10:24:35 host app[1]: FATAL: database connection timeout',
    ];
    const result = await processLogString(`${lines.join('\n')}\n`);

    expect(result.output).toBe('[x2] [TIME] host app[1]: FATAL: database connection timeout\n');
  });

  it('folds pino lines that differ only in the epoch time', async () => {
    const lines = [
      '{"level":50,"time":1715855071123,"msg":"payment failed"}',
      '{"level":50,"time":1715855072456,"msg":"payment failed"}',
    ];
    const result = await processLogString(`${lines.join('\n')}\n`);

    expect(result.output).toBe('[x2] {"level":50,"time":"[TIME]","msg":"payment failed"}\n');
  });
});

const DURATIONS: readonly SanitizeGroup[] = pairGroups(String.raw`
@@ still masks Kubernetes ages
Warning BackOff 38s kubelet Back-off restarting => Warning BackOff [AGO] kubelet Back-off restarting
pod/x   0/1   CrashLoopBackOff   5 (2m36s ago)   8m => pod/x   0/1   CrashLoopBackOff   5 ([AGO] ago)   8m
first line\n38s kubelet => first line\n[AGO] kubelet
@@ keeps decimal durations intact
FAIL    github.com/example/project/orders      0.024s => FAIL    github.com/example/project/orders      0.024s
Duration  2.15s => Duration  2.15s
@@ keeps durations that follow a preposition or a key
Request timed out after 30s while contacting api => Request timed out after 30s while contacting api
retrying in 2s (attempt 3) => retrying in 2s (attempt 3)
Timeout: 30s => Timeout: 30s
retry=5s => retry=5s
took 12s => took 12s
@@ keeps test runner durations in parentheses but still masks "(... ago)" ages
15 passing (1s) => 15 passing (1s)
Time: 3.2s (took 3s) => Time: 3.2s (took 3s)
pod/x   0/1   CrashLoopBackOff   5 (2m36s ago)   8m => pod/x   0/1   CrashLoopBackOff   5 ([AGO] ago)   8m
restarted (38s ago) => restarted ([AGO] ago)
@@ keeps the seconds part of a spaced minutes-and-seconds duration
BUILD FAILED in 1m 12s => BUILD FAILED in 1m 12s
finished 2h 5m 12s later => finished 2h 5m 12s later
`, (text) => text);

describe('sanitizeLine durations', () => {
  it.each(DURATIONS)('%s', (_name, rows) => expectSanitized(rows));
});

const ANSI_SEQUENCES: readonly SanitizeGroup[] = pairGroups(String.raw`
@@ removes color sequences
\u001b[31mred\u001b[0m text => red text
@@ removes cursor movement and erase-line sequences
\u001b[2K\u001b[1Gnpm ERR! code E404 => npm ERR! code E404
\u001b[?25lspinner\u001b[?25h => spinner
@@ removes OSC hyperlinks and window titles
\u001b]8;;https://example.com\u0007link text\u001b]8;;\u0007 error here => link text error here
\u001b]0;build title\u001b\\done => done
@@ keeps lone escape characters that are not sequences
odd \u001b byte => odd \u001b byte
`, (text) => text);

describe('sanitizeLine ANSI sequences', () => {
  it.each(ANSI_SEQUENCES)('%s', (_name, rows) => expectSanitized(rows));
});

describe('sanitizeLine secret fields', () => {
  it.each([
    [
      'with the other masks in one line',
      'DB_HOST=10.0.0.5 DB_PASSWORD=hunter2 at 10:24:31',
      'DB_HOST=[IP] DB_PASSWORD=[REDACTED] at [TIME]',
    ],
    [
      'in a pino line with an epoch time',
      '{"level":50,"time":1715855071123,"client_secret":"abc123def"}',
      '{"level":50,"time":"[TIME]","client_secret":"[REDACTED]"}',
    ],
    [
      'in a request body that was logged as a string',
      '{"msg":"body {\\"api_key\\":\\"abc123def\\"}"}',
      '{"msg":"body {\\"api_key\\":\\"[REDACTED]\\"}"}',
    ],
    [
      'after a vendor token that was already masked',
      'NPM_TOKEN=npm_aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6',
      'NPM_TOKEN=[REDACTED]',
    ],
  ])('masks the value %s', (_name, input, expected) => {
    expect(sanitizeLine(input)).toBe(expected);
  });

  it('lets events that differ only in the secret fold', async () => {
    const lines = [
      '[ERROR] login failed {"user":"bob","password":"hunter2"}',
      '[ERROR] login failed {"user":"bob","password":"letmein99"}',
    ];
    const result = await processLogString(`${lines.join('\n')}\n`);

    expect(result.output).toBe('[x2] [ERROR] login failed {"user":"bob","password":"[REDACTED]"}\n');
  });
});
