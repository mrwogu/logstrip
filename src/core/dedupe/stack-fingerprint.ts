/**
 * Normalize stack-frame line:column references so repeated stack traces
 * with identical structure but varying line/col numbers produce the same
 * sanitized output and collapse via deduplication.
 *
 * Examples:
 *   at Payments.charge (/repo/src/payments.ts:42:18)  →  :[NN]:[NN]
 *   File "/repo/tests/test.py", line 42, in test     →  , line [NN],
 *   at java.base/java.lang.Thread.run(Thread.java:829) →  :[NN])
 *
 * Only normalises inside well-known stack-frame patterns to avoid false positives.
 */

// JS/TS: at <fn> (<file>:<line>:<col>)
const JS_FRAME_LINE_COL = /(:\d+:\d+)\)/gu;

// Python: File "<file>", line <N>, in <fn>
const PY_FRAME_LINE = /(, line )\d+(, in )/gu;

// Java: (<file>:<line>)
const JAVA_FRAME_LINE = /(:\d+)(?=\))/gu;

// Go: <file>:<line> +<offset>
const GO_FRAME_LINE_COL = /(:\d+)(\s+\+0x[0-9a-f]+)/gu;

/**
 * Normalize known stack-frame line:column patterns to [NN].
 * Runs after sanitization and internal-stack hiding so hash/ID
 * replacement is already applied and internal frames are collapsed.
 */
export function normalizeStackFrameLineCol(line: string): string {
  // Process the most specific patterns first to avoid double-matching
  let result = line;

  // Python: ", line 42, in test" → ", line [NN], in test"
  result = result.replace(PY_FRAME_LINE, '$1[NN]$2');

  // Go: "file.go:42 +0x1a3" → "file.go:[NN] +0x1a3"
  result = result.replace(GO_FRAME_LINE_COL, ':[NN]$2');

  // JS: "file.ts:42:18)" → "file.ts:[NN]:[NN])"
  result = result.replace(JS_FRAME_LINE_COL, ':[NN]:[NN])');

  // Java: "Thread.java:829)" → "Thread.java:[NN])"
  result = result.replace(JAVA_FRAME_LINE, ':[NN])');

  return result;
}
