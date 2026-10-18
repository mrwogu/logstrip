import { describe, expect, it } from 'vitest';
import {
  explainLogLine,
  processLogString,
  scoreLineRelevance,
  shouldKeepLine,
} from '../src/core/logstrip-parser';
import type { Aggressiveness } from '../src/core/logstrip-parser';
import { isIgnoredLogLine } from '../src/core/scoring/relevance-score';
import { detectHeaderLogLevel } from '../src/core/logstrip-parser';

type HeaderLevel = ReturnType<typeof detectHeaderLogLevel>;
type LevelGroup = readonly [name: string, rows: ReadonlyArray<readonly [line: string, level: HeaderLevel]>];

const HEADER_LEVELS: readonly LevelGroup[] = [
  [
    'classifies Spring Boot lines',
    [
      ['2026-05-16T10:18:07.141Z  INFO 181 --- [checkout-api] [nio-8080-exec-3] c.e.checkout.web.CartController : GET /cart', 'noise'],
      ['2026-05-16T10:18:07.141Z DEBUG 181 --- [app] [main] org.hibernate.SQL : select 1', 'noise'],
      ['[TIME]  WARN 181 --- [app] [main] c.e.Inventory : slow reservation', 'warn'],
      ['[TIME] ERROR 181 --- [app] [main] c.e.Checkout : request rejected', 'severe'],
    ],
  ],
  [
    'classifies logback and log4j lines with a thread between time and level',
    [
      ['10:24:31.044 [main] DEBUG c.a.Foo - hi', 'noise'],
      ['2026-05-16 10:24:31,044 [http-nio-8080-exec-3] INFO  c.a.Foo - hi', 'noise'],
      ['2026-05-16 10:24:31,044 [main] ERROR c.a.Foo - hi', 'severe'],
      ['2026-05-16 10:24:31,044 INFO  [org.jboss.as] (main) started', 'noise'],
    ],
  ],
  [
    'classifies Python logging lines',
    [
      ['2026-05-16 10:24:31,044 - app.worker - INFO - started', 'noise'],
      ['2026-05-16 10:24:31,044 - app.worker - WARNING - slow', 'warn'],
      ['2026-05-16 10:24:31,044 - app.worker - ERROR - boom', 'severe'],
      ['DEBUG:urllib3.connectionpool:Starting new HTTPS connection', 'noise'],
      ['INFO:     127.0.0.1:52344 - "GET /health HTTP/1.1" 200 OK', 'noise'],
      ['WARNING:root:cache is cold', 'warn'],
    ],
  ],
  [
    'classifies loguru lines separated by pipes',
    [
      ['2026-05-16 10:24:31.044 | INFO     | app.main:run:42 - started', 'noise'],
      ['2026-05-16 10:24:31.044 | CRITICAL | app.main:run:42 - down', 'severe'],
    ],
  ],
  [
    'classifies level-first lines',
    [
      ['INFO  Starting service', 'noise'],
      ['[main] INFO c.a.Foo - started', 'noise'],
      ['ERROR: Could not find a version that satisfies the requirement', 'severe'],
      ['FATAL | database unreachable', 'severe'],
      ['info: Microsoft.Hosting.Lifetime[14]', 'noise'],
      ['dbug: Microsoft.EntityFrameworkCore[1]', 'noise'],
    ],
  ],
  [
    'does not treat a bare level-first WARNING as a log framework warning',
    [
      ['WARNING: Running pip as the root user can result in broken permissions', undefined],
      ['WARNING: apt does not have a stable CLI interface.', undefined],
    ],
  ],
  [
    'classifies logfmt lines in any key order',
    [
      ['time=2026-05-16T10:24:31Z level=info msg="server started"', 'noise'],
      ['ts=1 lvl=debug caller=main.go:42 msg=x', 'noise'],
      ['level=warn msg="slow"', 'warn'],
      ['level="error" msg="failed"', 'severe'],
      ['severity=CRITICAL msg=down', 'severe'],
    ],
  ],
  [
    'classifies glog and klog lines by their level letter',
    [
      ['I0516 10:24:31.011234   12345 server.go:42] started', 'noise'],
      ['W0516 [TIME]   12345 server.go:42] slow', 'warn'],
      ['E0516 10:24:31.011234   12345 server.go:42] failed', 'severe'],
      ['F0516 10:24:31.011234   12345 server.go:42] fatal', 'severe'],
    ],
  ],
  [
    'accepts syslog month-name timestamps before the level',
    [
      ['May 16 10:24:31 INFO started', 'noise'],
    ],
  ],
  [
    'ignores levels outside the header position',
    [
      ['Server started with DEBUG flag enabled for all modules today', undefined],
      ['Processing request for the INFO page', undefined],
      ['DEBUG=1 npm test', undefined],
      ['NODE_DEBUG=http node server.js', undefined],
      ['INFO.plist missing', undefined],
      ['2026-05-16 10:24:31 msg="a b" INFO later', undefined],
      ['[INFO] already bracketed', undefined],
      ['--log-level=info', undefined],
      ['', undefined],
    ],
  ],
];

describe('detectHeaderLogLevel', () => {
  it.each(HEADER_LEVELS)('%s', (_name, rows) => {
    for (const [line, level] of rows) expect(detectHeaderLogLevel(line), line).toBe(level);
  });
});

const INFO_SPRING = '2026-05-16T10:18:07.141Z  INFO 181 --- [app] [main] c.a.Foo : ';

// isIgnoredLogLine: the unbracketed INFO and DEBUG levels are noise, unless the
// line still reads as a diagnostic or reports a non-zero exit.
const IGNORED_LINES: ReadonlyArray<readonly [ignored: boolean, name: string, line: string]> = [
  [true, 'an unbracketed Spring Boot INFO line', `${INFO_SPRING}started`],
  [true, 'a Python logging DEBUG line', '2026-05-16 10:24:31,044 - urllib3 - DEBUG - Starting new connection'],
  [true, 'a logfmt info line', 'time=x level=info msg="ok"'],
  [false, 'an INFO line that reads as a diagnostic', `${INFO_SPRING}connection refused, retrying`],
  [false, 'an INFO line that reports exit code 137', `${INFO_SPRING}worker exited with code 137`],
  [false, 'a logfmt info line that reports a failing process', 'time=x level=info msg="process exited" code=1'],
  [false, 'an INFO line that reports exit status 2', 'INFO  build step finished, exit status: 2'],
  [false, 'an INFO line that reports a signal', 'INFO  child received signal 15'],
  [true, 'an INFO line that reports exit code 0', 'INFO  worker exited with code 0'],
  [true, 'an INFO line whose "exited" is followed by a count', 'INFO  exited after 2026 checks'],
  [true, 'a padded [INFO ] tag', '2026-05-16 10:24:31,044 [main] [INFO ] c.a.Foo - started'],
  [true, 'a padded [DEBUG ] tag', '[2026-05-16T10:24:31,044][DEBUG ][o.e.n.Node] [node-1] initialized'],
];

const EXACT_SCORES: ReadonlyArray<
  readonly [name: string, line: string, aggressiveness: Aggressiveness, score: number]
> = [
  ['floors an unbracketed WARNING header at the keep threshold', '[TIME] - app.worker - WARNING - redis connection lost', 'high', 40],
  ['floors an unbracketed CRITICAL header at the keep threshold', '[TIME] - app.worker - CRITICAL - disk almost full', 'low', 40],
  ['does not raise a header ERROR that already scores above the floor', '[TIME] ERROR 181 --- [app] [main] c.a.Foo : request rejected', 'high', 50],
  ['does not raise a bracketed ERROR that already scores above the floor', '[ERROR] ERROR: bad input', 'high', 150],
  ['lets aggressive mode drop a header WARN without a diagnostic signal', '[TIME] - app.worker - WARNING - redis connection lost', 'aggressive', -1],
];

const MINIMUM_SCORES: ReadonlyArray<
  readonly [minimum: number, name: string, line: string, aggressiveness: Aggressiveness]
> = [
  [40, 'an INFO line that still reads as a diagnostic', `${INFO_SPRING}connection refused, retrying`, 'high'],
  [100, 'a padded [WARN ] tag', '[2026-05-16 10:24:31] [WARN ] cache is cold', 'high'],
  [40, 'a header WARN with a diagnostic signal in aggressive mode', '[TIME] - app.worker - WARNING - connection refused', 'aggressive'],
];

const KEPT_BY_SHOULD_KEEP_LINE: ReadonlyArray<readonly [kept: boolean, name: string, line: string]> = [
  [false, 'an unbracketed INFO line', '2026-05-16T10:18:07.141Z  INFO 181 --- [app] [main] c.a.Foo : started'],
  [true, 'an unbracketed ERROR line', '[TIME] ERROR 181 --- [app] [main] c.a.Foo : request rejected'],
  [true, 'an unbracketed WARNING line', '[TIME] - app.worker - WARNING - redis connection lost'],
];

describe('header levels in scoring', () => {
  it.each(IGNORED_LINES)('isIgnoredLogLine returns %s for %s', (ignored, _name, line) => {
    expect(isIgnoredLogLine(line)).toBe(ignored);
  });

  it.each(EXACT_SCORES)('scoreLineRelevance %s', (_name, line, aggressiveness, score) => {
    expect(scoreLineRelevance(line, aggressiveness)).toBe(score);
  });

  it.each(MINIMUM_SCORES)(
    'scoreLineRelevance is at least %s for %s',
    (minimum, _name, line, aggressiveness) => {
      expect(scoreLineRelevance(line, aggressiveness)).toBeGreaterThanOrEqual(minimum);
    },
  );

  it.each(KEPT_BY_SHOULD_KEEP_LINE)('shouldKeepLine returns %s for %s', (kept, _name, line) => {
    expect(shouldKeepLine(line)).toBe(kept);
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
