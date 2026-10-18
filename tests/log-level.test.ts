import { describe, expect, it } from 'vitest';
import {
  explainLogLine,
  processLogString,
  scoreLineRelevance,
  shouldKeepLine,
} from '../src/core/logstrip-parser';
import { isIgnoredLogLine } from '../src/core/scoring/relevance-score';
import { detectHeaderLogLevel } from '../src/core/logstrip-parser';

describe('detectHeaderLogLevel', () => {
  it('classifies Spring Boot lines', () => {
    expect(
      detectHeaderLogLevel(
        '2026-05-16T10:18:07.141Z  INFO 181 --- [checkout-api] [nio-8080-exec-3] c.e.checkout.web.CartController : GET /cart',
      ),
    ).toBe('noise');
    expect(
      detectHeaderLogLevel('2026-05-16T10:18:07.141Z DEBUG 181 --- [app] [main] org.hibernate.SQL : select 1'),
    ).toBe('noise');
    expect(
      detectHeaderLogLevel('[TIME]  WARN 181 --- [app] [main] c.e.Inventory : slow reservation'),
    ).toBe('warn');
    expect(
      detectHeaderLogLevel('[TIME] ERROR 181 --- [app] [main] c.e.Checkout : request rejected'),
    ).toBe('severe');
  });

  it('classifies logback and log4j lines with a thread between time and level', () => {
    expect(detectHeaderLogLevel('10:24:31.044 [main] DEBUG c.a.Foo - hi')).toBe('noise');
    expect(detectHeaderLogLevel('2026-05-16 10:24:31,044 [http-nio-8080-exec-3] INFO  c.a.Foo - hi')).toBe('noise');
    expect(detectHeaderLogLevel('2026-05-16 10:24:31,044 [main] ERROR c.a.Foo - hi')).toBe('severe');
    expect(detectHeaderLogLevel('2026-05-16 10:24:31,044 INFO  [org.jboss.as] (main) started')).toBe('noise');
  });

  it('classifies Python logging lines', () => {
    expect(detectHeaderLogLevel('2026-05-16 10:24:31,044 - app.worker - INFO - started')).toBe('noise');
    expect(detectHeaderLogLevel('2026-05-16 10:24:31,044 - app.worker - WARNING - slow')).toBe('warn');
    expect(detectHeaderLogLevel('2026-05-16 10:24:31,044 - app.worker - ERROR - boom')).toBe('severe');
    expect(detectHeaderLogLevel('DEBUG:urllib3.connectionpool:Starting new HTTPS connection')).toBe('noise');
    expect(detectHeaderLogLevel('INFO:     127.0.0.1:52344 - "GET /health HTTP/1.1" 200 OK')).toBe('noise');
    expect(detectHeaderLogLevel('WARNING:root:cache is cold')).toBe('warn');
  });

  it('classifies loguru lines separated by pipes', () => {
    expect(detectHeaderLogLevel('2026-05-16 10:24:31.044 | INFO     | app.main:run:42 - started')).toBe('noise');
    expect(detectHeaderLogLevel('2026-05-16 10:24:31.044 | CRITICAL | app.main:run:42 - down')).toBe('severe');
  });

  it('classifies level-first lines', () => {
    expect(detectHeaderLogLevel('INFO  Starting service')).toBe('noise');
    expect(detectHeaderLogLevel('[main] INFO c.a.Foo - started')).toBe('noise');
    expect(detectHeaderLogLevel('ERROR: Could not find a version that satisfies the requirement')).toBe('severe');
    expect(detectHeaderLogLevel('FATAL | database unreachable')).toBe('severe');
    expect(detectHeaderLogLevel('info: Microsoft.Hosting.Lifetime[14]')).toBe('noise');
    expect(detectHeaderLogLevel('dbug: Microsoft.EntityFrameworkCore[1]')).toBe('noise');
  });

  it('does not treat a bare level-first WARNING as a log framework warning', () => {
    expect(detectHeaderLogLevel('WARNING: Running pip as the root user can result in broken permissions')).toBeUndefined();
    expect(detectHeaderLogLevel('WARNING: apt does not have a stable CLI interface.')).toBeUndefined();
  });

  it('classifies logfmt lines in any key order', () => {
    expect(detectHeaderLogLevel('time=2026-05-16T10:24:31Z level=info msg="server started"')).toBe('noise');
    expect(detectHeaderLogLevel('ts=1 lvl=debug caller=main.go:42 msg=x')).toBe('noise');
    expect(detectHeaderLogLevel('level=warn msg="slow"')).toBe('warn');
    expect(detectHeaderLogLevel('level="error" msg="failed"')).toBe('severe');
    expect(detectHeaderLogLevel('severity=CRITICAL msg=down')).toBe('severe');
  });

  it('classifies glog and klog lines by their level letter', () => {
    expect(detectHeaderLogLevel('I0516 10:24:31.011234   12345 server.go:42] started')).toBe('noise');
    expect(detectHeaderLogLevel('W0516 [TIME]   12345 server.go:42] slow')).toBe('warn');
    expect(detectHeaderLogLevel('E0516 10:24:31.011234   12345 server.go:42] failed')).toBe('severe');
    expect(detectHeaderLogLevel('F0516 10:24:31.011234   12345 server.go:42] fatal')).toBe('severe');
  });

  it('accepts syslog month-name timestamps before the level', () => {
    expect(detectHeaderLogLevel('May 16 10:24:31 INFO started')).toBe('noise');
  });

  it('ignores levels outside the header position', () => {
    expect(detectHeaderLogLevel('Server started with DEBUG flag enabled for all modules today')).toBeUndefined();
    expect(detectHeaderLogLevel('Processing request for the INFO page')).toBeUndefined();
    expect(detectHeaderLogLevel('DEBUG=1 npm test')).toBeUndefined();
    expect(detectHeaderLogLevel('NODE_DEBUG=http node server.js')).toBeUndefined();
    expect(detectHeaderLogLevel('INFO.plist missing')).toBeUndefined();
    expect(detectHeaderLogLevel('2026-05-16 10:24:31 msg="a b" INFO later')).toBeUndefined();
    expect(detectHeaderLogLevel('[INFO] already bracketed')).toBeUndefined();
    expect(detectHeaderLogLevel('--log-level=info')).toBeUndefined();
    expect(detectHeaderLogLevel('')).toBeUndefined();
  });
});

describe('header levels in scoring', () => {
  it('ignores unbracketed INFO and DEBUG lines', () => {
    expect(isIgnoredLogLine('2026-05-16T10:18:07.141Z  INFO 181 --- [app] [main] c.a.Foo : started')).toBe(true);
    expect(isIgnoredLogLine('2026-05-16 10:24:31,044 - urllib3 - DEBUG - Starting new connection')).toBe(true);
    expect(isIgnoredLogLine('time=x level=info msg="ok"')).toBe(true);
  });

  it('keeps an INFO line that still reads as a diagnostic', () => {
    const line = '2026-05-16T10:18:07.141Z  INFO 181 --- [app] [main] c.a.Foo : connection refused, retrying';
    expect(isIgnoredLogLine(line)).toBe(false);
    expect(scoreLineRelevance(line, 'high')).toBeGreaterThanOrEqual(40);
  });

  it('treats padded bracket tags like their compact forms', () => {
    expect(isIgnoredLogLine('2026-05-16 10:24:31,044 [main] [INFO ] c.a.Foo - started')).toBe(true);
    expect(isIgnoredLogLine('[2026-05-16T10:24:31,044][DEBUG ][o.e.n.Node] [node-1] initialized')).toBe(true);
    expect(scoreLineRelevance('[2026-05-16 10:24:31] [WARN ] cache is cold', 'high')).toBeGreaterThanOrEqual(100);
  });

  it('floors unbracketed WARN and severe header levels at the keep threshold', () => {
    expect(scoreLineRelevance('[TIME] - app.worker - WARNING - redis connection lost', 'high')).toBe(40);
    expect(scoreLineRelevance('[TIME] - app.worker - CRITICAL - disk almost full', 'low')).toBe(40);
  });

  it('does not raise lines that already score above the floor', () => {
    expect(scoreLineRelevance('[TIME] ERROR 181 --- [app] [main] c.a.Foo : request rejected', 'high')).toBe(50);
    expect(scoreLineRelevance('[ERROR] ERROR: bad input', 'high')).toBe(150);
  });

  it('lets aggressive mode drop a header WARN without a diagnostic signal', () => {
    const line = '[TIME] - app.worker - WARNING - redis connection lost';
    expect(scoreLineRelevance(line, 'aggressive')).toBe(-1);
    expect(scoreLineRelevance('[TIME] - app.worker - WARNING - connection refused', 'aggressive')).toBeGreaterThanOrEqual(40);
  });

  it('shouldKeepLine follows header levels', () => {
    expect(shouldKeepLine('2026-05-16T10:18:07.141Z  INFO 181 --- [app] [main] c.a.Foo : started')).toBe(false);
    expect(shouldKeepLine('[TIME] ERROR 181 --- [app] [main] c.a.Foo : request rejected')).toBe(true);
    expect(shouldKeepLine('[TIME] - app.worker - WARNING - redis connection lost')).toBe(true);
  });
});

describe('header levels in the stream pipeline', () => {
  const spring = (level: string, text: string): string =>
    `2026-05-16T10:18:07.141Z ${level.padStart(5)} 181 --- [app] [nio-8080-exec-3] c.a.Foo : ${text}`;

  it('drops unbracketed INFO and DEBUG lines even next to an error', async () => {
    const input = [
      spring('INFO', 'readiness probe succeeded'),
      spring('DEBUG', 'select 1'),
      spring('ERROR', 'request rejected'),
      spring('INFO', 'liveness probe succeeded'),
    ].join('\n');
    const result = await processLogString(`${input}\n`);

    expect(result.output).toBe('[TIME] ERROR 181 --- [app] [nio-8080-exec-3] c.a.Foo : request rejected\n');
  });

  it('keeps ERROR and WARN lines that carry no diagnostic keyword', async () => {
    const input = [
      '2026-05-16 10:24:31,044 - app.worker - INFO - started',
      '2026-05-16 10:24:32,310 - app.worker - WARNING - redis connection lost, attempt 1',
      '2026-05-16 10:24:34,325 - app.worker - WARNING - redis connection lost, attempt 2',
      '2026-05-16 10:24:36,341 - app.worker - ERROR - giving up on the queue',
    ].join('\n');
    const result = await processLogString(`${input}\n`);

    expect(result.output).toBe(
      [
        '[x2] [TIME] - app.worker - WARNING - redis connection lost, attempt [1 | 2]',
        '[TIME] - app.worker - ERROR - giving up on the queue',
        '',
      ].join('\n'),
    );
  });

  it('keeps an INFO line with diagnostic vocabulary', async () => {
    const result = await processLogString(`${spring('INFO', 'upstream connection refused')}\n`);

    expect(result.output).toContain('upstream connection refused');
  });

  it('explainLogLine reports ignored-tag for header INFO lines', () => {
    expect(explainLogLine(spring('INFO', 'readiness probe succeeded')).reason).toBe('ignored-tag');
  });
});
