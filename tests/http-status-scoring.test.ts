import { describe, expect, it } from 'vitest';
import {
  looksLikeDiagnosticLine,
  processLogString,
  scoreLineRelevance,
} from '../src/core/logstrip-parser';

describe('systemd exit status scoring', () => {
  it('flags non-zero exit statuses with a systemd result name', () => {
    expect(scoreLineRelevance('Main process exited, code=exited, status=1/FAILURE', 'high')).toBeGreaterThanOrEqual(50);
    expect(scoreLineRelevance('Main process exited, code=exited, status=203/EXEC', 'high')).toBe(50);
    expect(scoreLineRelevance('checkout-api[1842]: status=203 EXEC - exiting', 'high')).toBe(50);
  });

  it('does not flag a clean exit', () => {
    expect(scoreLineRelevance('Main process exited, code=exited, status=0/SUCCESS', 'high')).toBe(0);
  });

  it('does not flag logfmt request logs that carry status=200', () => {
    const line = 'msg="request handled" method=GET path=/api/cart status=200 duration=12ms';
    expect(scoreLineRelevance(line, 'high')).toBe(0);
    expect(looksLikeDiagnosticLine(line)).toBe(false);
  });

  it('still flags "Failed to start" in any case', () => {
    expect(scoreLineRelevance('Failed to start checkout-api.service', 'high')).toBeGreaterThanOrEqual(50);
    expect(scoreLineRelevance('systemd: failed to start checkout-api', 'high')).toBeGreaterThanOrEqual(50);
  });
});

describe('HTTP status fields in key=value request logs', () => {
  it('scores 5xx status fields as diagnostics, raw or sanitized', () => {
    expect(scoreLineRelevance('method=GET path=/api status=503 bytes=0', 'high')).toBe(50);
    expect(scoreLineRelevance('method=GET path=/api status=[HTTP 5xx] bytes=0', 'high')).toBe(50);
    expect(scoreLineRelevance('msg=done status_code: 502', 'high')).toBe(50);
    expect(looksLikeDiagnosticLine('method=GET path=/api status=500')).toBe(true);
  });

  it('scores 4xx status fields below the keep threshold', () => {
    expect(scoreLineRelevance('method=GET path=/api status=404 bytes=12', 'high')).toBe(20);
    expect(scoreLineRelevance('method=GET path=/api status=[HTTP 4xx] bytes=12', 'high')).toBe(20);
  });

  it('does not treat other status values as HTTP failures', () => {
    expect(scoreLineRelevance('method=GET path=/api status=200 bytes=12', 'high')).toBe(0);
    expect(scoreLineRelevance('job status=5000 queued', 'high')).toBe(0);
  });

  it('keeps a uvicorn access line with a 5xx status even at INFO level', () => {
    const line = 'INFO:     127.0.0.1:52344 - "POST /api/pay HTTP/1.1" 502 Bad Gateway';
    expect(looksLikeDiagnosticLine(line)).toBe(true);
  });

  it('keeps INFO request logs that returned 5xx and drops the 2xx ones', async () => {
    const input = [
      'time=2026-05-16T10:24:31Z level=info msg="request handled" method=GET path=/api/cart status=200 duration=12ms',
      'time=2026-05-16T10:24:32Z level=info msg="request handled" method=POST path=/api/pay status=503 duration=48ms',
      'time=2026-05-16T10:24:33Z level=info msg="request handled" method=GET path=/api/cart status=200 duration=9ms',
    ].join('\n');
    const result = await processLogString(`${input}\n`);

    expect(result.output).toBe(
      'time=[TIME] level=info msg="request handled" method=POST path=/api/pay status=[HTTP 5xx] duration=48ms\n',
    );
  });
});
