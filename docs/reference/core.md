---
title: Core TypeScript API Reference
description: Process logs in Node.js with processLogStream and processLogFile. Stream-based, deterministic, zero external dependencies. Sanitization, scoring, dedup, multiline joining, severity filtering, format detection, and timeout API.
---
# Core API Reference

The core parser lives in `src/core/logstrip-parser.ts`. It is intentionally independent from GitHub Actions and does not import `@actions/*`.

## `processLogStream`

```ts
import { createReadStream, createWriteStream } from 'node:fs';
import { processLogStream } from 'logstrip';

const input = createReadStream('raw.log', { encoding: 'utf8' });
const output = createWriteStream('raw.logstrip.log', { encoding: 'utf8' });

const result = await processLogStream(input, output, {
  aggressiveness: 'auto',
});
```

Returns:

```ts
interface LogStripResult {
  stats: LogStripStats;
  inputTokens: number;
  outputTokens: number;
  savedTokens: number;
  savingsPercent: number;
  detectedSources?: readonly string[];
  detectedFormat?: string;
  contentKind?: 'log' | 'text';
  timedOut?: boolean;
  outputPath?: string;
}

interface LogStripStats {
  inputLines: number;
  outputLines: number;
  inputWords: number;
  outputWords: number;
  inputBytes: number;
  outputBytes: number;
  droppedLines: number;
  duplicateLines: number;
  hiddenInternalStackLines: number;
  truncatedLines?: number;
}
```

The stream parser is deterministic and allocation-conscious: it reads line by
line, sanitizes before deduplication, and writes directly to the supplied output
stream. When adjacent diagnostic lines share the same stable shape, the parser
folds them into a single `[xN]` line and generalizes volatile fields such as
`amount=99.99`, `amount=49.50`, and `amount=12.00` to
`amount=[99.99 | 49.50 | 12.00]`.

`detectedFormat` is set whenever the parser can infer a log format (e.g. `node`,
`python`, `java`, `go`). The detection is hybrid and always-on: the parser locks
onto the first recognizable line for speed, then self-corrects via a majority
vote over the first `formatDetectionSampleSize` (default 50) non-blank lines, so
mixed-format streams resolve to their dominant format. `timedOut` is `true` when
`processLogStreamWithTimeout` was used and the deadline was reached.
`truncatedLines` counts lines that exceeded `maxLineLength` and were replaced
with `[TRUNCATED]`. `contentKind` is `'text'` when the input was copied through
instead of compressed (see below) and `'log'` otherwise, including for JSON
documents handled by the report path. It is absent when `timedOut` is `true`
and the input had not been classified yet.

## Non-log input (`textPassthrough`)

The line scorer keeps diagnostics and drops everything else, which is right
for a build log and destructive for a README, a YAML file or a source file.
So `processLogStream`, and everything built on it (`processLogFile`,
`processLogString`, `createLogStripTransform`, `processLogStreamWithTimeout`),
reads a bounded sample of the input first, right after the JSON document check,
and classifies it. Plain text is copied through line by line; anything else
goes through the compression pipeline untouched by this step.

```ts
import { processLogString } from 'logstrip';

const copy = await processLogString(readmeText);
copy.contentKind;                  // 'text'
copy.savingsPercent;               // 0
copy.stats.droppedLines;           // 0
copy.output === readmeText;        // true when the text holds no secrets

const forced = await processLogString(readmeText, { textPassthrough: false });
forced.contentKind;                // 'log' - compressed like any log
```

| Option | Type | Default | Behavior |
| :--- | :--- | :--- | :--- |
| `textPassthrough` | `boolean` | `true` | Classify the head of the stream and copy plain text (prose, markdown, source code, configuration, data) through instead of compressing it. `false` always runs the log pipeline; the CLI exposes it as `--force`. |

What passthrough does and does not do:

- **Unchanged except for secrets.** Every line is written, in order, with line
  endings normalized to `\n`. The only edits are credential masking: PEM
  private key blocks (the key lines are dropped and counted in
  `stats.droppedLines`), then [`maskSecrets`](#masksecrets), then the custom
  `sanitizePatterns` of the config. Identifiers, timestamps, IP addresses,
  emails and prose are left alone, so text without secrets comes out as it went
  in.
- **Filters do not apply.** `include`, `exclude`, `severity`, `sampleSize`,
  `maxTokens`, `maxLineLength` and `collapseBlocks` only shape compressed
  logs.
- **Stats.** `inputLines` / `outputLines` and the byte and word counts are
  filled in, `droppedLines` is `0` (apart from private key lines),
  `savedTokens` and `savingsPercent` are `0` for text without secrets.
- **Decisions.** `onDecision` receives `{ kept: true, reason: 'passthrough' }`
  for every written line, with the masked text in `sanitizedLine`.
- **Streaming.** Only the sample is buffered, and only until the verdict is
  known. A stream that already reads like a log is settled after
  `CONTENT_EARLY_LOG_MIN_LINES` (8) lines, so a real log starts flowing almost
  at once. Text, and a log with little structure, wait for the full sample:
  the first `DEFAULT_CONTENT_SAMPLE_LINES` non-blank lines or
  `DEFAULT_CONTENT_SAMPLE_BYTES` bytes, whichever comes first, which is the
  worst case. Output then starts and the rest of the input flows line by
  line. A `signal` aborts passthrough like any other run.
- **Decided from the head only.** The verdict comes from the sampled lines,
  not from the whole input. When it is wrong for your input, pass
  `textPassthrough: false`.

### `classifyContent`

```ts
import { classifyContent } from 'logstrip';

const { kind, logLines, textLines, sampledLines } = classifyContent(lines);
// kind: 'log' | 'text'
```

Scores up to `DEFAULT_CONTENT_SAMPLE_LINES` non-blank lines (and at most
`DEFAULT_CONTENT_SAMPLE_BYTES` bytes) and returns a `ContentClassification`.
Each line counts as log-like (timestamp, severity tag, CI marker, stack frame,
logfmt / JSON-line / syslog record, access-log line, ANSI escape, process id,
several `key=value` pairs, known tool output), text-like (markdown, prose
sentence, source code, YAML / INI / JSON configuration, shell or Dockerfile
syntax, HTML, CSV) or neither. Lines inside a closed markdown fence count as
text. The sample is `'text'` only when at least `CONTENT_TEXT_MIN_LINES` lines
are text-like, they make up at least `CONTENT_TEXT_MIN_RATIO` of the sampled
lines, and log-like lines stay at or below `CONTENT_TEXT_MAX_LOG_RATIO` (a weak
log signal such as the word `error` counts half). Otherwise the result is
`'log'`, so unrecognised formats keep being compressed and a log that opens
with a short prose banner stays a log.

| Constant | Value | Meaning |
| :--- | :---: | :--- |
| `DEFAULT_CONTENT_SAMPLE_LINES` | `100` | Non-blank lines scored. |
| `DEFAULT_CONTENT_SAMPLE_BYTES` | `262144` | Byte cap of the sample (256 KiB). |
| `CONTENT_LINE_SCAN_LIMIT` | `2000` | Characters of a line that are scored. |
| `CONTENT_TEXT_MIN_LINES` | `2` | Text-like lines needed for a `'text'` verdict. |
| `CONTENT_TEXT_MIN_RATIO` | `0.5` | Minimum share of text-like lines. |
| `CONTENT_TEXT_MAX_LOG_RATIO` | `0.15` | Maximum share of log-like lines. |
| `CONTENT_EARLY_LOG_MIN_LINES` | `8` | Sampled lines needed before a log-like share settles the verdict early. |
| `CONTENT_EARLY_LOG_MIN_RATIO` | `0.6` | Log-like share (weak signals at half weight) that settles a log verdict early. |

`claimTextContent(lines, limits?)` is the streaming half: it reads at most one
sample from an `AsyncIterable<string>` and returns the classification together
with a `replay` iterable that yields every consumed line again, followed by the
rest of the stream. It stops reading early with a `'log'` verdict when the log
count alone rules text out, when more than half of a full sample can no longer
be text, or when at least `CONTENT_EARLY_LOG_MIN_LINES` lines are sampled and
`CONTENT_EARLY_LOG_MIN_RATIO` of them is log-like. The last exit can differ from
the verdict of the full sample for a text file that opens with a log excerpt,
which is then compressed as before. `ContentSampler` is the incremental scorer
behind both `classifyContent` and the claim.

## Aggressiveness

The `aggressiveness` option in `LogStripOptions` accepts five values:

| Value | Behavior |
| :--- | :--- |
| `low` | Keeps most lines including `[INFO]` and `[DEBUG]`. Minimal compression. |
| `medium` | Drops noise tags (`[INFO]`, `[DEBUG]`, `[TRACE]`) but keeps `[WARN]`. |
| `high` | Drops noise and pure warnings; keeps only diagnostic signals + context window. |
| `aggressive` | Drops everything except errors, fatals, stack frames, and explicit diagnostic keywords. |
| `auto` | Starts at `high` and adjusts dynamically (default when `aggressiveness` is omitted). |

### Dynamic aggressiveness (`auto`)

When `aggressiveness` is `'auto'`, the parser creates a `DynamicAggressivenessState`
that tracks a sliding window of the last 8 line decisions:

- **Decrease** (toward `medium`): when 3+ of the last 8 decisions were hard
  keeps (errors, stack frames, diagnostic keywords), the effective level drops
  to preserve more context in signal-rich logs.
- **Increase** (toward `aggressive`): when 6+ of the last 8 decisions were drops
  or repeated lines, the effective level rises to filter more aggressively in
  noisy output.
- **Stable**: otherwise the effective level stays at `high`.

The transitions use hysteresis - the effective level only changes when the
window consistently supports the shift, so brief fluctuations do not cause
oscillation.

```ts
import { createDynamicAggressivenessState } from 'logstrip';

const state = createDynamicAggressivenessState('auto');
console.log(state.effective); // 'high'

// After processing lines, the state may shift
state.recordDecision('keep-hard');
state.recordDecision('keep-hard');
state.recordDecision('keep-hard');
// ... over an 8-line window, effective may shift to 'medium'
```

## Hybrid detection engine

LogStrip no longer treats every line as a simple keep/drop decision. The
core parser combines four signals:

| Layer | Behavior | Why it matters |
| :--- | :--- | :--- |
| Scoring | `scoreLineRelevance()` gives points for errors, JSON severity, scanner findings, container failures, npm/yarn errors, diagnostic keywords, and stack frames. | Keeps real failure context even when the source format varies. |
| Context before | Up to `CONTEXT_WINDOW_BEFORE` soft-scored lines are buffered and retroactively emitted when a high-score line appears. | Preserves setup lines like "connecting database" before the error. |
| Context after | `CONTEXT_WINDOW_AFTER` lines after a high-score event are emitted as trailing context. | Keeps the first useful follow-up lines without retaining the whole log. |
| TF-IDF dampening | Repeated sanitized lines lose score after `TFIDF_REPEAT_THRESHOLD`; the per-stream map is bounded by `TFIDF_MAP_LIMIT`. | Reduces repeated spam while keeping early examples. |
| Repeat signatures | `createRepeatSignature()` groups lines by stable `key=value` shape, then the stream deduplicator lists only differing values. | Collapses repeated incident variants while preserving one-off values. |

Current exported thresholds:

| Constant | Value | Meaning |
| :--- | :---: | :--- |
| `CONTEXT_WINDOW_BEFORE` | `3` | Soft lines retained before a triggering diagnostic line. |
| `CONTEXT_WINDOW_AFTER` | `2` | Lines retained after a triggering diagnostic line. |
| `SCORE_KEEP_THRESHOLD` | `40` | Minimum score for immediate emission. |
| `TFIDF_REPEAT_THRESHOLD` | `3` | Repeat count where dampening begins. |
| `TFIDF_PENALTY` | `8` | Score penalty applied per repeat beyond the threshold. |
| `TFIDF_MAP_LIMIT` | `50_000` | Maximum unique sanitized lines tracked before the frequency map is reset. |

Example scoring outcomes:

```ts
scoreLineRelevance('[ERROR] database timeout', 'high');      // >= 40
scoreLineRelevance('[WARN] connection timeout', 'aggressive'); // >= 40
scoreLineRelevance('containerd v1.7.0 started', 'high');       // 0
scoreLineRelevance('containerd failed to create task', 'high'); // >= 40
```

## Multiline log joining

Many log formats span multiple lines - Python tracebacks, Node.js stack traces,
Java `Caused by:` chains, Go goroutine dumps. By default (`multiline: 'off'`)
each physical line is processed independently. Enable multiline mode to join
continuation lines with their parent into a single logical line before scoring:

```ts
import { processLogStream } from 'logstrip';

const result = await processLogStream(input, output, {
  multiline: 'python',  // 'auto' | 'python' | 'node' | 'java' | 'go' | 'rust' | 'off'
});
```

Groups are bounded at 200 lines / 200 KB to prevent unbounded memory growth.

The `MultilineMode` type and `isContinuationLine` helper are exported:

```ts
import { isContinuationLine, createContinuationContext, type MultilineMode } from 'logstrip';

const ctx = createContinuationContext('python');
isContinuationLine('    File "app.py", line 42', ctx); // true
```

## Severity filtering

```ts
import { processLogStream, parseSeverityLevel, type SeverityLevel } from 'logstrip';

const result = await processLogStream(input, output, {
  severity: 'error',  // keep only error + fatal lines
});
```

| Level | What passes |
| :--- | :--- |
| `fatal` | `FATAL`, `CRITICAL`, `EMERG`, `ALERT` |
| `error` | Above + `ERROR`, `ERR`, `SEV2` |
| `warn` | Above + `WARN`, `WARNING` |
| `info` | Above + `INFO` |
| `debug` | Above + `DEBUG` |
| `trace` | All levels pass |

Severity is inferred from log-level tags, JSON `level` fields, and common
abbreviations. Lines with no detectable severity always pass.

`inferSeverity` and `passesSeverityFilter` are also exported for direct use:

```ts
import { inferSeverity, passesSeverityFilter } from 'logstrip';

inferSeverity('[ERROR] timeout');       // 'error'
passesSeverityFilter('[WARN] slow', 'error');  // false
passesSeverityFilter('[ERROR] fail', 'error');  // true
```

## Log format detection

The parser can infer the dominant log format from stream markers:

```ts
import { detectFormat } from 'logstrip';

detectFormat('npm ERR! code ERESOLVE\n    at module (app.js:1:1)');
// 'node'
```

`processLogStream` always attempts format detection and sets `detectedFormat`
on the result when a format is recognized (independent of the `multiline`
setting). The `detectFormat` function checks for Python (`Traceback`), Node.js
(`at ` stack frames), Java (`Exception in thread`), Go (`goroutine`), and other
format markers. For the streaming parser the first-line guess is refined by a
majority vote over the first `formatDetectionSampleSize` non-blank lines, which
keeps detection robust on logs that interleave formats (e.g. JSON lines mixed
with plaintext). Source-marker matching itself runs through a single-pass
Aho-Corasick automaton built from all 705+ ecosystem signatures - same results
as the previous per-marker scan, just faster on the hot path.

## HTTP status code grouping

The sanitizer groups HTTP status codes into classes:

```ts
import { sanitizeLine } from 'logstrip';

sanitizeLine('GET /api 503 Service Unavailable');
// 'GET /api [5xx] Service Unavailable'

sanitizeLine('responded 200 OK');
// 'responded [2xx] OK'
```

This prevents status code variations from breaking deduplication.

## Timeout wrapper

For CI time budgets, use `processLogStreamWithTimeout`:

```ts
import { processLogStreamWithTimeout } from 'logstrip';

const result = await processLogStreamWithTimeout(input, output, { aggressiveness: 'auto' }, 30_000);
if (result.timedOut) {
  console.warn('Processing timed out after 30s; output may be partial');
}
```

The function flushes the output and returns a valid `LogStripResult` with
`timedOut: true` when the deadline is reached.

## Include / exclude / sample

These options provide fine-grained filtering at the library level:

```ts
const result = await processLogStream(input, output, {
  include: /timeout|refused/,   // keep only matching lines
  exclude: /Downloading/,       // drop matching lines
  sampleSize: 50,              // limit to first 50 kept lines
  maxLineLength: 10_000,       // truncate very long lines
});
```

`include` and `exclude` accept `RegExp` objects. `sampleSize` caps the total
kept lines. `maxLineLength` replaces lines exceeding the limit with
`[TRUNCATED]` and increments `stats.truncatedLines`.

## Automatic boosters and budget options

In the default `auto` mode LogStrip enables a set of detection and compression
boosters automatically. They are exposed as tri-state options on
`LogStripOptions`: leave them `undefined` to keep the auto-on default, or set
them to `false` to opt out (the CLI surfaces the opt-outs as `--no-*` flags).

```ts
const result = await processLogStream(input, output, {
  // Tri-state boosters (default-on in auto; set false to disable):
  collapseRepeatedStacks: true, // fold repeated multi-line stack windows that
                                //   differ only in addresses/offsets/goroutine ids
  rootCause: true,              // prune downstream cascade restatements
  multilingual: true,           // detect non-English / CJK error keywords
  adaptiveContext: true,        // size the after-error context by error density
  templateMining: true,         // fold near-identical lines differing only in a
                                //   number after a generic word label
  collapseRepeatedBlocks: true, // replace a run of lines that repeats earlier
                                //   output with a "[... N lines repeated ...]"
                                //   marker

  // Numeric tuning / budget options:
  maxTokens: 8_000,             // trim to the highest-scoring lines within a
                                //   token budget (original order preserved)
  dedupeWindow: 200,            // collapse non-adjacent duplicates within the
                                //   last N distinct lines (1 = adjacent only)
  collapseBlocks: 20,           // collapse consecutive repeats of a multi-line
                                //   block (up to N lines) into one + [block xM]
  formatDetectionSampleSize: 50,// majority-vote window for format detection
  maxStackFrames: 10,           // cap consecutive app stack frames per trace
                                //   (0 keeps every frame)
});
```

| Option | Type | Default | Behavior |
| :--- | :--- | :--- | :--- |
| `collapseRepeatedStacks` | `boolean` | auto-on | Folds repeated stack-trace windows differing only in volatile frame data into a single `[xN]` group. |
| `rootCause` | `boolean` | auto-on | Drops downstream cascade restatements (`aborting due to previous errors`, `could not compile … due to previous error`, `skipped because the upstream job failed`). Conservative - genuine first errors are kept. |
| `multilingual` | `boolean` | auto-on | Boosts the score of error/failure/exception keywords in 8+ languages plus CJK (`erreur`, `Fehler`, `fallo`, `ошибка`, `错误`, …). |
| `adaptiveContext` | `boolean` | auto-on | Sizes the after-error context window by error density: wider for isolated errors, tighter for clustered, self-contextualizing ones. Disabled automatically when `contextBefore`/`contextAfter` are set explicitly. |
| `maxTokens` | `number` | _(off)_ | LLM context-budget mode: keeps the highest-scoring lines until the token budget is reached, preserving original order. |
| `dedupeWindow` | `number` | `1` | Collapses non-adjacent duplicate lines seen within the last _N_ distinct lines. `1` keeps adjacent-only deduplication. |
| `collapseBlocks` | `number` | _(off)_ | Collapses consecutive repeats of a multi-line block (up to _N_ lines) into one copy plus a `[block xM]` marker. |
| `formatDetectionSampleSize` | `number` | `50` | Number of leading non-blank lines sampled before the first-line format guess may be corrected by majority vote. After the vote locks, a sustained run of differently-formatted lines (20 consecutive) re-elects the format, so mixed streams that switch format mid-file stay correctly classified. |
| `templateMining` | `boolean` | auto-on | Folds near-identical lines whose only difference is a number after a generic word label (`Retrying upload 17` / `… 18` → `[x2] Retrying upload [17 \| 18] …`). Numbers with a duration or size unit (`took 120ms`, `12MB`, `45%`) and parenthesized counters (`(attempt 3)`) merge too, and the wrapping punctuation is kept. In access logs the response size after an HTTP status (`502 157`) merges as well, so a burst of 5xx lines that differ only in size and timing folds into one `[xN]` line. Numbers after diagnostic labels (`code`, `status`, `exit`, `signal`, `line`, `version`, `errno`, `error`) never merge. |
| `collapseRepeatedBlocks` | `boolean` | auto-on | Replaces a run of at least 3 output lines (and 12 words, so the marker always pays for itself) that repeats an earlier run from the last 400 output lines with one `[... N lines repeated from above ...]` marker. Back-to-back copies of the same block share one marker, a different block gets its own, and the marker counts toward `stats.duplicateLines`. Lines that cannot start a repeat are written immediately; only lines that match an earlier run so far are held back, so memory stays bounded. Ignored when `dedupe` is `false`. A token budget (`maxTokens`) drops these markers before any other line. |
| `maxStackFrames` | `number` | `10` | Keeps at most _N_ consecutive application stack frames per trace; the remainder collapses into a `[... K more application stack frames ...]` marker. `0` keeps every frame. Internal library frames are hidden separately by the internal-stack collapser. |

```ts
import { processLogFile } from 'logstrip';

const result = await processLogFile('raw.log', 'raw.logstrip.log', {
  aggressiveness: 'auto',
});
```

This helper creates Node.js file streams and returns the same `LogStripResult`.

## Context, dedupe and sanitization options

These library-level options are not surfaced as dedicated CLI flags but are
available on `LogStripOptions`:

| Option | Type | Default | Behavior |
| :--- | :--- | :--- | :--- |
| `contextBefore` | `number` | `3` | Lines kept before each retained error (the "before" half of the context window). Setting it (or `contextAfter`) disables the auto-mode adaptive window. |
| `contextAfter` | `number` | `2` | Lines kept after each retained error (the "after" half of the context window). Setting it (or `contextBefore`) disables the auto-mode adaptive window. |
| `dedupe` | `boolean` | `true` | Collapses repeated lines into `[xN]` groups. Set `false` for a raw pass. Forced off for `outputFormat: 'jsonl-preserve'`. |
| `preserveIdSuffix` | `number` | `0` | Keeps the last _N_ (`0`–`16`) characters of redacted UUIDs/hashes (`[ID:174000]`) instead of fully masking. Mirrors `--preserve-id-suffix`. |
| `outputFormat` | `'text' \| 'jsonl-preserve'` | `'text'` | `'jsonl-preserve'` keeps the original JSONL structure of each line (no folding/dedupe) while still scoring and dropping noise. |
| `config` | `LogStripCustomConfig` | _(none)_ | Inline custom config (ignore/sanitize/keep patterns). Equivalent to a parsed `.logstrip.yml`. |
| `configPath` | `string` | _(auto)_ | Path to a `.logstrip.yml` file to load. When omitted, `.logstrip.yml` is auto-detected from the cwd. |

### Programmatic-only hooks

| Option | Type | Behavior |
| :--- | :--- | :--- |
| `signal` | `AbortSignal` | Aborts processing cooperatively; the partial output is flushed and an `ABORTED` error is raised. |
| `onDecision` | `(decision: LogStripLineDecision) => void` | Per-line callback exposing the keep/drop decision, reason, and score - useful for debugging or building custom reports. |
| `tokenEstimator` | `(line: string) => number` | Overrides the built-in token estimate used for `maxTokens` budgeting and the `inputTokens` / `outputTokens` totals. |
| `timeoutMs` | `number` | Hard deadline in milliseconds; on expiry the output is flushed and `result.timedOut` is set. `processLogStreamWithTimeout` is the convenience wrapper. |

## `detectLogSources`

```ts
import { detectLogSources } from 'logstrip';

const detected = detectLogSources(`
npm ERR! code ERESOLVE
running with gitlab-runner 17.4.0
Warning BackOff restarting failed container
`);

console.log(detected);
// ['npm', 'gitlab-ci', 'kubernetes', ...]
```

Returns ranked source candidates based on lightweight fingerprint matching.

## `KNOWN_LOG_SOURCES`

```ts
import { KNOWN_LOG_SOURCES, LOG_SOURCE_SIGNATURES } from 'logstrip';

console.log(KNOWN_LOG_SOURCES.length); // 700+
console.log(LOG_SOURCE_SIGNATURES[0]); // ['vitest', ['vitest']]
```

`KNOWN_LOG_SOURCES` lists all built-in source names. `LOG_SOURCE_SIGNATURES`
lists the source-to-marker table used by `detectLogSources` and
`processLogStream`; each source must have a matching fixture under
`tests/fixtures/sources/<source>.log`.

## `sanitizeLine`

```ts
import { sanitizeLine } from 'logstrip';

sanitizeLine('[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed');
// [ERROR] request [ID] failed
```

The sanitizer replaces:

| Pattern | Replacement |
| :--- | :--- |
| UUID | `[ID]` |
| Timestamps (ISO with `.` or `,` fractions and zone, UTC/GMT, syslog `May 16 10:24:31`, `16-May-2026 10:24:31`, Go `log`, bare `10:24:31.044`, epoch values under `time`/`ts`/`timestamp` keys) | `[TIME]` |
| IPv4 addresses | `[IP]` |
| IPv4 address + port | `[IP]:[PORT]` |
| GitHub tokens (`ghp_`, `gho_`, `ghu_`, etc.) | `[REDACTED]` |
| JWT tokens (`eyJ...`) | `[JWT]` |
| Slack tokens (`xoxb-...`, `xoxp-...`) | `[REDACTED]` |
| Connection strings (`postgres://user:pass@`) | password → `[REDACTED]` |
| `Authorization:` headers | `Authorization: [REDACTED]` |
| Secret field values (`password=`, `token=`, `api_key=`, etc.) | value → `[REDACTED]` |
| AWS access keys (`AKIA...`) | `[REDACTED]` |
| AWS ARN account IDs | `[ACCOUNT]` |
| long hexadecimal or alphanumeric hashes | `[HASH]` |
| HTTP status codes | `[2xx]`, `[4xx]`, `[5xx]`, etc. |
| Kubernetes ages (`38s`, `2m34s`, `5 (2m36s ago)`) | `[AGO]` |
| ANSI escape sequences (colors, cursor movement, erase line, OSC hyperlinks) | removed |

Durations that are measurements stay readable: `0.47s`, `timed out after 30s`,
`retrying in 2s`, `timeout=30s` and `1m 12s` are kept, so a configured timeout
or backoff is never replaced by `[AGO]`.

Pass a second argument to keep a trailing slice of redacted UUIDs and hashes
instead of fully masking them - the same behavior the CLI exposes as
`--preserve-id-suffix`:

```ts
sanitizeLine('request 123e4567-e89b-12d3-a456-426614174000 failed', 6);
// request [ID:174000] failed
```

`preserveIdSuffix` accepts `0`–`16`; `0` (the default) masks the value entirely
to `[ID]` / `[HASH]`.

### `maskSecrets`

```ts
import { maskSecrets } from 'logstrip';

maskSecrets('deploy with ghp_... and password=hunter2');
// deploy with [REDACTED] and password=[REDACTED]
```

The credential rules of `sanitizeLine` on their own: GitHub, Slack, Stripe,
npm, Google, Twilio, SendGrid and AWS keys, JWTs, connection-string passwords,
`Authorization:` headers, secret field values, AWS account ids in ARNs and the
high-entropy token fallback. UUIDs, timestamps, IP addresses, emails, hashes
and ANSI escapes are not touched. Text passthrough uses it so a copied config
or document does not carry credentials along. `sanitizeLine` applies the same
rules in the same order as before, so the compressed log output is unchanged.
The rules recognise common credential shapes; they are a safety net, not a
guarantee that a file holds no secrets. They also favour masking over fidelity:
`token: ${{ secrets.NPM_TOKEN }}`, `id-token: write` and a sentence that
mentions an `Authorization:` header (the rest of the line is masked) are
masked as well.

Text passthrough also handles PEM private key blocks, with
`maskPemBlockInText`, a variant of `maskPemBlock` for documents and configs:
only a header that ends its line opens a block, so a page that merely names
`-----BEGIN PRIVATE KEY-----` in a sentence or table keeps the rest of its
content, and a whole key on one line (a JSON string with `\n` escapes) is
redacted on the spot.

## `createRepeatSignature`

```ts
import { createRepeatSignature } from 'logstrip';

createRepeatSignature(
  '[ERROR] charge failed requestId=[ID] amount=99.99 failures=3/5',
);
// '[ERROR] charge failed requestId=[VALUE] amount=[VALUE] failures=[VALUE]'
```

This helper is used by the stream deduplicator to detect same-shape structured
events. Single lines still keep their sanitized values; differing field values
are listed only when adjacent diagnostics fold into an `[xN]` summary.

## `shouldKeepLine`

```ts
import { shouldKeepLine } from 'logstrip';

shouldKeepLine('[INFO] boot ok'); // false
shouldKeepLine('[ERROR] failure'); // true
```

The filter removes low-value log tags and keeps errors, warnings, fatal lines,
critical lines, and diagnostic stack trace lines. The full streaming parser uses
the hybrid scoring engine above, so direct `shouldKeepLine()` calls are best
treated as a lightweight helper rather than a complete compression pass.

## `detectHeaderLogLevel`

```ts
import { detectHeaderLogLevel } from 'logstrip';

detectHeaderLogLevel('2026-05-16 10:24:31,044 - app.worker - INFO - started'); // 'noise'
detectHeaderLogLevel('2026-05-16 10:24:31,044 - app.worker - WARNING - slow'); // 'warn'
detectHeaderLogLevel('time=... level=error msg="boom"'); // 'severe'
detectHeaderLogLevel('Server started with DEBUG flag enabled today'); // undefined
```

Classifies the severity word that logging frameworks print without brackets in
the line header: `noise` for `INFO`/`DEBUG`/`TRACE`/`VERBOSE`/`FINE*`, `warn`
for `WARN`/`WARNING` and `severe` for `ERROR`/`FATAL`/`CRITICAL`/`SEVERE`. It
understands Spring Boot, logback/log4j, Python logging (default and custom
formats), loguru, level-first lines (`INFO: ...`), logfmt (`level=info`) and
glog/klog (`I0516 ...`). Position rules keep prose that merely contains an
uppercase `INFO` word from being classified, and a bare `WARNING: ...` at the
start of a line is left alone because CLI tools print boilerplate warnings that
way.

The streaming parser drops `noise` lines unless their text still reads as a
diagnostic (`INFO ... connection refused` is kept), and floors `warn` and
`severe` lines at the keep threshold so a level-only message such as
`WARNING - redis connection lost` is not lost. Bracketed tags (`[INFO]`,
`[INFO ]`) keep their existing, unconditional handling.

## `isPassingTestLine`

```ts
import { isPassingTestLine } from 'logstrip';

isPassingTestLine('tests/test_orders.py::test_create PASSED   [ 12%]'); // true
isPassingTestLine('  ✔ returns an error for an empty cart (12ms)'); // true
isPassingTestLine('--- PASS: TestCheckout (0.01s)'); // true
isPassingTestLine('tests/test_orders.py::test_create FAILED'); // false
```

True for lines that only report a pass: pytest `PASSED` and unittest `... ok`,
check-mark lines (`✓ ✔ √ ✅`), jest/vitest `PASS path` suite lines, Go
`--- PASS:` / `PASS` / `ok pkg` / `[no test files]`, xUnit `Passed ...`, Gradle
`... PASSED` and `UP-TO-DATE`/`NO-SOURCE`/`FROM-CACHE`/`SKIPPED` tasks, and TAP
`ok N`. The streaming parser drops them as `ci-noise` before scoring, so a
passing test named "returns an error for bad input" is not mistaken for a
failure and passing lines next to a failure are no longer promoted as context.
`=== RUN` lines are kept: when a test aborts the process, the last one is the
only clue to which test it was. The Go package summary `FAIL<TAB>pkg<TAB>0.4s`
is scored as a diagnostic.

## Tested log sources and tools

The parser detects **705+ log ecosystems** across 30+ categories.
See the [Supported Sources](sources.md) page for the full catalogue.

Fixture files live in `tests/fixtures/*.log` and deterministic outputs in
`tests/fixtures/__snapshots__/*.logstrip.snap`.

## Telemetry

The library exports a local telemetry store that records cumulative
token savings across runs. Data is stored in `~/.logstrip/telemetry.json`
(or the directory specified by `LOGSTRIP_TELEMETRY_DIR`). Nothing is sent
to any server.

### `recordTelemetry`

```ts
import { recordTelemetry, type LogStripResult } from 'logstrip';

const result: LogStripResult = await processLogFile('raw.log', 'clean.log');
recordTelemetry(result); // appends entry, updates totals
```

### `loadTelemetry` / `saveTelemetry`

```ts
import { loadTelemetry, saveTelemetry, type TelemetryStore } from 'logstrip';

const store: TelemetryStore = loadTelemetry();
console.log(store.totalSavedTokens);
```

### `formatTelemetrySummary`

```ts
import { formatTelemetrySummary } from 'logstrip';

const text = formatTelemetrySummary(loadTelemetry());
process.stderr.write(text);
```

The store keeps at most 1,000 entries; older entries are pruned
automatically by `recordTelemetry`.
