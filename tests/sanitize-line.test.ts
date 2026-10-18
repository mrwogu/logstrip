import { describe, expect, it } from 'vitest';
import { processLogString } from '../src/core/logstrip-parser';
import { sanitizeLine } from '../src/core/sanitize/sanitize-line';

describe('sanitizeLine timestamp shapes', () => {
  it('masks comma-fraction timestamps from Python logging and log4j', () => {
    expect(sanitizeLine('2026-05-16 10:24:31,044 - app.worker - INFO - started')).toBe(
      '[TIME] - app.worker - INFO - started',
    );
    expect(sanitizeLine('2026-05-16 10:24:31,044 [main] WARN c.a.Foo - slow')).toBe(
      '[TIME] [main] WARN c.a.Foo - slow',
    );
  });

  it('absorbs a trailing zone word or offset into the timestamp', () => {
    expect(sanitizeLine('2026-05-16 10:24:31.044 UTC [1234] ERROR:  boom')).toBe(
      '[TIME] [1234] ERROR:  boom',
    );
    expect(sanitizeLine('2026-05-16 10:24:31 GMT done')).toBe('[TIME] done');
    expect(sanitizeLine('[2026-05-16 10:24:31 +0000] [7] ready')).toBe('[[TIME]] [7] ready');
    expect(sanitizeLine('2026-05-16 10:24:31 -04:00 ready')).toBe('[TIME] ready');
  });

  it('masks syslog and date(1) style month-name timestamps', () => {
    expect(sanitizeLine('May 16 10:24:31 host kernel: Out of memory')).toBe(
      '[TIME] host kernel: Out of memory',
    );
    expect(sanitizeLine('May  6 10:24:31 host sshd[4411]: Failed password')).toBe(
      '[TIME] host sshd[4411]: Failed password',
    );
    expect(sanitizeLine('Sat May 16 10:24:31 deploy failed')).toBe('[TIME] deploy failed');
  });

  it('masks day-month-year timestamps from Tomcat, PHP and Redis', () => {
    expect(sanitizeLine('16-May-2026 10:24:31.011 SEVERE [main] boom')).toBe(
      '[TIME] SEVERE [main] boom',
    );
    expect(sanitizeLine('[16-May-2026 10:24:31 UTC] PHP Fatal error: boom')).toBe(
      '[[TIME]] PHP Fatal error: boom',
    );
    expect(sanitizeLine('1:M 16 May 2026 10:24:31.011 # Warning: no config')).toBe(
      '1:M [TIME] # Warning: no config',
    );
  });

  it('masks Go log package timestamps with microseconds', () => {
    expect(sanitizeLine('2026/05/16 10:24:31.044123 server.go:42: listening')).toBe(
      '[TIME] server.go:42: listening',
    );
  });

  it('masks bare time of day with optional fraction', () => {
    expect(sanitizeLine('10:24:31.011 [main] DEBUG c.a.Foo - hi')).toBe(
      '[TIME] [main] DEBUG c.a.Foo - hi',
    );
    expect(sanitizeLine('[10:24:31] ERROR something broke')).toBe('[[TIME]] ERROR something broke');
    expect(sanitizeLine('retry at 10:24:31, then stop')).toBe('retry at [TIME], then stop');
  });

  it('leaves digit runs, MAC addresses and IPv6 groups alone', () => {
    expect(sanitizeLine('version 1.10:24:31 weird')).toBe('version 1.10:24:31 weird');
    expect(sanitizeLine('mac 00:11:22:33:44:55 on eth0')).toBe('mac [IPV6] on eth0');
    expect(sanitizeLine('addr 2001:0db8:0000:0042:0000:8a2e:0370:7334 up')).toBe('addr [IPV6] up');
    expect(sanitizeLine('ratio 1:10:24:31')).toBe('ratio 1:10:24:31');
  });

  it('masks numeric epoch values under time-like JSON keys', () => {
    expect(sanitizeLine('{"level":30,"time":1715855071123,"pid":1,"msg":"hi"}')).toBe(
      '{"level":30,"time":"[TIME]","pid":1,"msg":"hi"}',
    );
    expect(sanitizeLine('{"ts": 1715855071.123456 }')).toBe('{"ts": "[TIME]" }');
    expect(sanitizeLine('{"@timestamp":1715855071}')).toBe('{"@timestamp":"[TIME]"}');
  });

  it('keeps numeric JSON values under other keys', () => {
    expect(sanitizeLine('{"requestId":1715855071123,"time":42}')).toBe(
      '{"requestId":1715855071123,"time":42}',
    );
  });

  it('masks numeric epoch values under time-like logfmt keys', () => {
    expect(sanitizeLine('ts=1715855071 level=error msg="boom"')).toBe(
      'ts=[TIME] level=error msg="boom"',
    );
    expect(sanitizeLine('time=1715855071.5 level=warn')).toBe('time=[TIME] level=warn');
    expect(sanitizeLine('retries=1715855071 level=warn')).toBe('retries=1715855071 level=warn');
  });
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

describe('sanitizeLine durations', () => {
  it('still masks Kubernetes ages', () => {
    expect(sanitizeLine('Warning BackOff 38s kubelet Back-off restarting')).toBe(
      'Warning BackOff [AGO] kubelet Back-off restarting',
    );
    expect(sanitizeLine('pod/x   0/1   CrashLoopBackOff   5 (2m36s ago)   8m')).toBe(
      'pod/x   0/1   CrashLoopBackOff   5 ([AGO] ago)   8m',
    );
    expect(sanitizeLine('first line\n38s kubelet')).toBe('first line\n[AGO] kubelet');
  });

  it('keeps decimal durations intact', () => {
    expect(sanitizeLine('FAIL    github.com/example/project/orders      0.024s')).toBe(
      'FAIL    github.com/example/project/orders      0.024s',
    );
    expect(sanitizeLine('Duration  2.15s')).toBe('Duration  2.15s');
  });

  it('keeps durations that follow a preposition or a key', () => {
    expect(sanitizeLine('Request timed out after 30s while contacting api')).toBe(
      'Request timed out after 30s while contacting api',
    );
    expect(sanitizeLine('retrying in 2s (attempt 3)')).toBe('retrying in 2s (attempt 3)');
    expect(sanitizeLine('Timeout: 30s')).toBe('Timeout: 30s');
    expect(sanitizeLine('retry=5s')).toBe('retry=5s');
    expect(sanitizeLine('took 12s')).toBe('took 12s');
  });

  it('keeps the seconds part of a spaced minutes-and-seconds duration', () => {
    expect(sanitizeLine('BUILD FAILED in 1m 12s')).toBe('BUILD FAILED in 1m 12s');
    expect(sanitizeLine('finished 2h 5m 12s later')).toBe('finished 2h 5m 12s later');
  });
});
