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
/**
 * Normalize known stack-frame line:column patterns to [NN].
 * Runs after sanitization and internal-stack hiding so hash/ID
 * replacement is already applied and internal frames are collapsed.
 */
export declare function normalizeStackFrameLineCol(line: string): string;
/**
 * Return a normalized fingerprint when `line` looks like a stack-trace window,
 * or `null` otherwise. Used as the deduplication key so structurally identical
 * traces collapse even when their addresses/offsets differ.
 */
export declare function stackWindowSignature(line: string): string | null;
