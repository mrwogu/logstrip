import { describe, expect, it } from 'vitest';
import {
  explainLogLine,
  isPassingTestLine,
  looksLikeDiagnosticLine,
  processLogString,
  scoreLineRelevance,
} from '../src/core/logstrip-parser';
import { stripAnsi } from '../src/core/sanitize/sanitize-line';

describe('isPassingTestLine', () => {
  it('matches Go test pass reports', () => {
    expect(isPassingTestLine('--- PASS: TestCheckout (0.01s)')).toBe(true);
    expect(isPassingTestLine('    --- PASS: TestCheckout/empty_cart (0.00s)')).toBe(true);
    expect(isPassingTestLine('PASS')).toBe(true);
    expect(isPassingTestLine('ok  \tgithub.com/acme/checkout/orders\t0.123s')).toBe(true);
    expect(isPassingTestLine('ok  \tgithub.com/acme/checkout/orders\t(cached)')).toBe(true);
    expect(isPassingTestLine('?   \tgithub.com/acme/checkout/tools\t[no test files]')).toBe(true);
  });

  it('keeps Go failures and the RUN lines that identify an aborted test', () => {
    expect(isPassingTestLine('--- FAIL: TestCheckout (0.01s)')).toBe(false);
    expect(isPassingTestLine('FAIL\tgithub.com/acme/checkout/orders\t0.123s')).toBe(false);
    expect(isPassingTestLine('=== RUN   TestCheckout')).toBe(false);
    expect(isPassingTestLine('PASSWORD rotated')).toBe(false);
  });

  it('matches pytest and unittest pass reports', () => {
    expect(isPassingTestLine('tests/test_orders.py::test_create PASSED                [ 12%]')).toBe(true);
    expect(isPassingTestLine('tests/test_orders.py::test_create[a-b] PASSED')).toBe(true);
    expect(isPassingTestLine('[gw0] [ 12%] PASSED tests/test_orders.py::test_create')).toBe(true);
    expect(isPassingTestLine('PASSED tests/test_orders.py::test_create')).toBe(true);
    expect(isPassingTestLine('test_create (tests.test_orders.OrderTests.test_create) ... ok')).toBe(true);
  });

  it('keeps pytest failures', () => {
    expect(isPassingTestLine('tests/test_orders.py::test_create FAILED               [ 12%]')).toBe(false);
    expect(isPassingTestLine('FAILED tests/test_orders.py::test_create - assert 500 == 201')).toBe(false);
    expect(isPassingTestLine('test_create (tests.test_orders.OrderTests.test_create) ... FAIL')).toBe(false);
  });

  it('matches check-mark lines whatever the test name says', () => {
    expect(isPassingTestLine('      ✓ creates an order (45ms)')).toBe(true);
    expect(isPassingTestLine('      ✔ returns an error for an empty cart')).toBe(true);
    expect(isPassingTestLine('  √ rejects a failed payment with a 422')).toBe(true);
    expect(isPassingTestLine(' ✅ handles a timeout from the gateway')).toBe(true);
    expect(isPassingTestLine(' ✓')).toBe(true);
  });

  it('keeps failure marks', () => {
    expect(isPassingTestLine('      ✗ creates an order')).toBe(false);
    expect(isPassingTestLine('      ✕ creates an order (45ms)')).toBe(false);
    expect(isPassingTestLine('      1) creates an order')).toBe(false);
    expect(isPassingTestLine('✓creates')).toBe(false);
  });

  it('matches jest and vitest suite pass lines', () => {
    expect(isPassingTestLine(' PASS  src/api.test.ts (123ms)')).toBe(true);
    expect(isPassingTestLine('PASS src/api.test.ts')).toBe(true);
    expect(isPassingTestLine(' FAIL  src/payments.test.ts (412ms)')).toBe(false);
    expect(isPassingTestLine('PASS rate limiter looks fine')).toBe(false);
  });

  it('matches xUnit, Gradle test events, TAP and idle Gradle tasks', () => {
    expect(isPassingTestLine('  Passed Checkout.Tests.CartTests.Total [12 ms]')).toBe(true);
    expect(isPassingTestLine('  Failed Checkout.Tests.CartTests.Total [12 ms]')).toBe(false);
    expect(isPassingTestLine('OrderServiceTest > creates an order() PASSED')).toBe(true);
    expect(isPassingTestLine('OrderServiceTest > creates an order() FAILED')).toBe(false);
    expect(isPassingTestLine('ok 3 - creates an order')).toBe(true);
    expect(isPassingTestLine('not ok 4 - rejects an order')).toBe(false);
    expect(isPassingTestLine('> Task :app:processResources UP-TO-DATE')).toBe(true);
    expect(isPassingTestLine('> Task :app:compileJava NO-SOURCE')).toBe(true);
    expect(isPassingTestLine('> Task :app:compileKotlin FROM-CACHE')).toBe(true);
    expect(isPassingTestLine('> Task :app:test SKIPPED')).toBe(true);
    expect(isPassingTestLine('> Task :app:compileJava')).toBe(false);
    expect(isPassingTestLine('> Task :app:compileJava FAILED')).toBe(false);
  });

  it('sees through ANSI color codes', () => {
    expect(isPassingTestLine('\u001b[32m ✓ creates an order\u001b[39m')).toBe(true);
    expect(isPassingTestLine('\u001b[0m\u001b[7m\u001b[1m\u001b[32m PASS \u001b[39m\u001b[22m\u001b[27m\u001b[0m src/api.test.ts')).toBe(true);
    expect(isPassingTestLine('\u001b[32m✓ creates an order\u001b[39m')).toBe(true);
  });

  it('does not match ordinary log lines', () => {
    expect(isPassingTestLine('')).toBe(false);
    expect(isPassingTestLine('Tests: 3 failed, 14 passed, 17 total')).toBe(false);
    expect(isPassingTestLine('ok to proceed with deploy')).toBe(false);
    expect(isPassingTestLine('[ERROR] build failed')).toBe(false);
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
