import { describe, expect, it } from 'vitest';
import {
  explainLogLine,
  isPassingTestLine,
  looksLikeDiagnosticLine,
  processLogString,
  scoreLineRelevance,
} from '../src/core/logstrip-parser';
import { stripAnsi } from '../src/core/sanitize/sanitize-line';

type LineGroup = readonly [name: string, lines: readonly string[]];

// Reports of a passing test, which isPassingTestLine drops whatever the test is called.
const PASSING_TEST_LINES: readonly LineGroup[] = [
  [
    'Go test pass reports',
    [
      '--- PASS: TestCheckout (0.01s)',
      '    --- PASS: TestCheckout/empty_cart (0.00s)',
      'PASS',
      'ok  \tgithub.com/acme/checkout/orders\t0.123s',
      'ok  \tgithub.com/acme/checkout/orders\t(cached)',
      '?   \tgithub.com/acme/checkout/tools\t[no test files]',
    ],
  ],
  [
    'pytest and unittest pass reports',
    [
      'tests/test_orders.py::test_create PASSED                [ 12%]',
      'tests/test_orders.py::test_create[a-b] PASSED',
      '[gw0] [ 12%] PASSED tests/test_orders.py::test_create',
      'PASSED tests/test_orders.py::test_create',
      'test_create (tests.test_orders.OrderTests.test_create) ... ok',
    ],
  ],
  [
    'check-mark lines whatever the test name says',
    [
      '      ✓ creates an order (45ms)',
      '      ✔ returns an error for an empty cart',
      '  √ rejects a failed payment with a 422',
      ' ✅ handles a timeout from the gateway',
      ' ✓',
    ],
  ],
  [
    'jest and vitest suite pass lines',
    [
      ' PASS  src/api.test.ts (123ms)',
      'PASS src/api.test.ts',
    ],
  ],
  [
    'xUnit, Gradle test events, TAP and idle Gradle tasks',
    [
      '  Passed Checkout.Tests.CartTests.Total [12 ms]',
      'OrderServiceTest > creates an order() PASSED',
      'ok 3 - creates an order',
      '> Task :app:processResources UP-TO-DATE',
      '> Task :app:compileJava NO-SOURCE',
      '> Task :app:compileKotlin FROM-CACHE',
      '> Task :app:test SKIPPED',
    ],
  ],
  [
    'lines wrapped in ANSI color codes',
    [
      '\u001b[32m ✓ creates an order\u001b[39m',
      '\u001b[0m\u001b[7m\u001b[1m\u001b[32m PASS \u001b[39m\u001b[22m\u001b[27m\u001b[0m src/api.test.ts',
      '\u001b[32m✓ creates an order\u001b[39m',
    ],
  ],
];

// What it keeps: failures, the RUN lines that identify an aborted test, and ordinary log lines.
const KEPT_LINES: readonly LineGroup[] = [
  [
    'Go failures and the RUN lines that identify an aborted test',
    [
      '--- FAIL: TestCheckout (0.01s)',
      'FAIL\tgithub.com/acme/checkout/orders\t0.123s',
      '=== RUN   TestCheckout',
      'PASSWORD rotated',
    ],
  ],
  [
    'pytest failures',
    [
      'tests/test_orders.py::test_create FAILED               [ 12%]',
      'FAILED tests/test_orders.py::test_create - assert 500 == 201',
      'test_create (tests.test_orders.OrderTests.test_create) ... FAIL',
    ],
  ],
  [
    'failure marks',
    [
      '      ✗ creates an order',
      '      ✕ creates an order (45ms)',
      '      1) creates an order',
      '✓creates',
    ],
  ],
  [
    'jest and vitest FAIL lines and prose that starts with PASS',
    [
      ' FAIL  src/payments.test.ts (412ms)',
      'PASS rate limiter looks fine',
    ],
  ],
  [
    'xUnit, Gradle and TAP failures and Gradle tasks that did work',
    [
      '  Failed Checkout.Tests.CartTests.Total [12 ms]',
      'OrderServiceTest > creates an order() FAILED',
      'not ok 4 - rejects an order',
      '> Task :app:compileJava',
      '> Task :app:compileJava FAILED',
    ],
  ],
  [
    'ordinary log lines',
    [
      '',
      'Tests: 3 failed, 14 passed, 17 total',
      'ok to proceed with deploy',
      '[ERROR] build failed',
    ],
  ],
];

describe('isPassingTestLine', () => {
  it.each(PASSING_TEST_LINES)('matches %s', (_name, lines) => {
    for (const line of lines) expect(isPassingTestLine(line), line).toBe(true);
  });

  it.each(KEPT_LINES)('keeps %s', (_name, lines) => {
    for (const line of lines) expect(isPassingTestLine(line), line).toBe(false);
  });
});

describe('stripAnsi', () => {
  it('removes escape sequences and leaves plain text alone', () => {
    expect(stripAnsi('\u001b[31mred\u001b[0m')).toBe('red');
    expect(stripAnsi('plain')).toBe('plain');
  });
});

describe('passing-test lines in the stream pipeline', () => {
  it('drops passing tests that mention failures and keeps the real failure', async () => {
    const input = [
      '  Checkout API',
      '    ✓ creates an order (45ms)',
      '    ✓ returns an error for an empty cart (12ms)',
      '    ✓ retries after a timeout from the inventory service (210ms)',
      '    1) fails closed when the pricing service is unavailable',
      '  1 failing',
      '     AssertionError: expected 200 to equal 503',
      '',
    ].join('\n');
    const { output } = await processLogString(input);

    expect(output).not.toContain('✓');
    expect(output).toContain('1) fails closed when the pricing service is unavailable');
    expect(output).toContain('AssertionError: expected 200 to equal 503');
  });

  it('keeps older context in the window when passing lines are dropped', async () => {
    const input = [
      'tests/test_a.py::test_one PASSED',
      'tests/test_a.py::test_two PASSED',
      'tests/test_a.py::test_three PASSED',
      'tests/test_a.py::test_four PASSED',
      'tests/test_a.py::test_five FAILED',
      '',
    ].join('\n');
    const { output } = await processLogString(input);

    expect(output).toBe('tests/test_a.py::test_five FAILED\n');
  });

  it('explainLogLine reports passing tests as ci-noise', () => {
    expect(explainLogLine('--- PASS: TestCheckout (0.01s)').reason).toBe('ci-noise');
  });
});

describe('Go package failure summary', () => {
  it('scores the package FAIL line as a diagnostic', () => {
    const line = 'FAIL\tgithub.com/acme/checkout/orders\t0.412s';
    expect(scoreLineRelevance(line, 'high')).toBe(50);
    expect(looksLikeDiagnosticLine(line)).toBe(true);
  });

  it('does not score the passing package line or a bare FAIL word', () => {
    expect(scoreLineRelevance('ok  \tgithub.com/acme/checkout/pricing\t0.119s', 'high')).toBe(0);
    expect(scoreLineRelevance('FAIL', 'high')).toBe(0);
  });

  it('keeps the package summary after the last failing test', async () => {
    const input = [
      '--- FAIL: TestRefund (0.03s)',
      '=== RUN   TestInventoryReserve',
      '--- PASS: TestInventoryReserve (0.05s)',
      'FAIL',
      'FAIL\tgithub.com/acme/checkout/orders\t0.412s',
      '',
    ].join('\n');
    const { output } = await processLogString(input);

    expect(output).toContain('FAIL\tgithub.com/acme/checkout/orders\t0.412s');
  });
});
