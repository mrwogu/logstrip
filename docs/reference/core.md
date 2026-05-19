# Core API Reference

The core parser lives in `src/core/logstrip-parser.ts`. It is intentionally independent from GitHub Actions and does not import `@actions/*`.

## `processLogStream`

```ts
import { createReadStream, createWriteStream } from 'node:fs';
import { processLogStream } from 'logstrip';

const input = createReadStream('raw.log', { encoding: 'utf8' });
const output = createWriteStream('raw.logstrip.log', { encoding: 'utf8' });

const result = await processLogStream(input, output, {
  aggressiveness: 'high',
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
  outputPath?: string;
}
```

The stream parser is deterministic and allocation-conscious: it reads line by
line, sanitizes before deduplication, and writes directly to the supplied output
stream. When adjacent diagnostic lines share the same stable shape, the parser
folds them into a single `[xN]` line and generalizes volatile fields such as
`amount=99.99`, `amount=49.50`, and `amount=12.00` to
`amount=[99.99 | 49.50 | 12.00]`.

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

## `processLogFile`

```ts
import { processLogFile } from 'logstrip';

const result = await processLogFile('raw.log', 'raw.logstrip.log', {
  aggressiveness: 'high',
});
```

This helper creates Node.js file streams and returns the same `LogStripResult`.

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
| ISO and UTC timestamps | `[TIME]` |
| IPv4 addresses | `[IP]` |
| IPv4 address + port | `[IP]:[PORT]` |
| long hexadecimal or alphanumeric hashes | `[HASH]` |
| ANSI color escapes | removed |

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

## Tested log sources and tools

The parser detects **705+ log ecosystems** across 30+ categories.
See the [Supported Sources](sources.md) page for the full catalogue.

Fixture files live in `tests/fixtures/*.log` and deterministic outputs in
`tests/fixtures/__snapshots__/*.logstrip.snap`.
