import { stripAnsi } from '../sanitize/sanitize-line.js';

/**
 * Lines that only report that something passed or was skipped as up to date.
 * They carry no diagnostic, yet two things keep them in the output today:
 * passing test names often contain words such as "error" or "fail"
 * ("returns an error for bad input"), which score as diagnostics, and every
 * passing line next to a failure is promoted as context.
 *
 * Only the pass report is matched. "=== RUN" lines are kept on purpose: when a
 * test aborts the process, the last "=== RUN" line is the only clue to which
 * test it was.
 */

// Go: "--- PASS: TestX (0.01s)", "PASS", "ok  pkg  0.123s", "? pkg [no test files]".
const GO_PASS_PATTERN =
  /^\s*--- PASS: \S+|^PASS$|^ok\s+\S+\s+(?:[\d.]+s\b|\(cached\))|^\?\s+\S+\s+\[no test files\]/u;

// pytest -v ("tests/a.py::test_a PASSED [ 12%]"), xdist ("[gw0] [ 12%] PASSED
// tests/a.py::test_a"), -rA summary ("PASSED tests/a.py::test_a") and
// unittest -v ("test_a (tests.A.test_a) ... ok").
const PYTHON_PASS_PATTERN =
  /^\s*\S+::\S+\s+PASSED\b|^\[gw\d+\]\s+\[\s*\d+%\]\s+PASSED\b|^PASSED\s+\S+::|\s\.\.\.\s+ok\s*$/u;

// mocha, vitest, Playwright and friends: a leading check mark.
const CHECK_MARK_PATTERN = /^\s*(?:✓|✔|√|✅)(?:\s|$)/u;

// jest and vitest suite lines: " PASS  src/api.test.ts (123ms)".
const SUITE_PASS_PATTERN = /^\s*PASS\s+\S*[./\\]\S*/u;

// xUnit / dotnet ("  Passed Checkout.Tests.Cart.Total [12 ms]"), Gradle test
// events ("OrderTest > creates order() PASSED") and TAP ("ok 3 - creates").
const RUNNER_PASS_PATTERN =
  /^\s*Passed\s+\S+\.\S+\s+\[|^\S.*\s>\s.+\sPASSED\s*$|^\s*ok\s+\d+\b/u;

// Gradle tasks that finished without doing work.
const GRADLE_IDLE_TASK_PATTERN =
  /^>\s+Task\s+\S+\s+(?:UP-TO-DATE|NO-SOURCE|FROM-CACHE|SKIPPED)\s*$/u;

export function isPassingTestLine(line: string): boolean {
  const text = stripAnsi(line);
  return (
    GO_PASS_PATTERN.test(text) ||
    PYTHON_PASS_PATTERN.test(text) ||
    CHECK_MARK_PATTERN.test(text) ||
    SUITE_PASS_PATTERN.test(text) ||
    RUNNER_PASS_PATTERN.test(text) ||
    GRADLE_IDLE_TASK_PATTERN.test(text)
  );
}
