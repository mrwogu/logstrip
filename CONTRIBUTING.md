# Contributing to LogStrip

Thank you for your interest in contributing! This guide covers the rules you must follow when adding features, fixing bugs, or extending source detection.

## Quick Start

```bash
npm install
npm run typecheck
npm run test:coverage
npm run build
```

All three must pass before you open a PR.

---

## Adding a New Log Source

LogStrip automatically detects the origin of log lines using marker strings. When you add support for a new tool, framework, or service, you must update **three places** and follow the fixture contract below.

### 1. Add the signature to `LOG_SOURCE_SIGNATURES`

In `src/core/logstrip-parser.ts`, add a new entry to the `LOG_SOURCE_SIGNATURES` array:

```ts
['my-tool', ['my-tool', 'my tool error', 'mytool-cli']],
```

Rules:
- Source name: kebab-case (e.g., `openai-api`, `echo-framework`).
- Markers: lowercase strings that appear in the tool's real log output. Include at least one marker that is **unique enough** to avoid false-positive substring matches. Avoid ultra-short markers (2-3 chars) that appear in unrelated words (e.g., `"sbt"` matches inside `"sveltekit"`).
- Keep markers specific - prefer `"my-tool error"` over just `"my-tool"` when the bare name is ambiguous.
- Place the entry under the appropriate category comment (`// ── Category ──`).

### 2. Create a per-source fixture

Every source **must** have a fixture file at:

```
tests/fixtures/sources/<source-name>.log
```

The file must contain realistic log lines that exercise the source's markers, including:

| Line type | Required? | Purpose |
|-----------|-----------|---------|
| `[INFO]` / `[DEBUG]` noise | At least 2 | Verifies the parser drops low-value lines |
| `[ERROR]` with primary marker | At least 1 | Verifies the parser keeps diagnostic lines |
| `[ERROR]` with duplicate pattern | Optional | Verifies deduplication (`[xN]` folding) |
| `[FATAL]` | At least 1 | Verifies critical signals survive |
| Stack frames (if applicable) | Optional | Verifies internal-stack collapsing |
| UUIDs (`018f23ab-7c1d-...`) | In ERROR lines | Verifies sanitization to `[ID]` |
| IPs (`10.42.7.18:54321`) | In ERROR lines | Verifies sanitization to `[IP]:[PORT]` |
| Timestamps / hashes | In ERROR lines | Verifies sanitization to `[TIME]` / `[HASH]` |

Example fixture for `express`:

```
[INFO] express server listening on port 3000
[DEBUG] express middleware registered: cors, auth, logging
[ERROR] express Error: Cannot find module '@company/auth'
    at internalRequire (/srv/node_modules/express/lib/router/index.js:42:15)
[ERROR] express Error: request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 failed on POST /api/checkout from 10.42.7.18:54321
[FATAL] express worker crashed with signal SIGABRT commit=abcdef1234567890abcdef1234567890abcdef12
```

#### Using the generator script

For quick scaffolding, run:

```bash
npx tsx scripts/generate-source-fixtures.ts
```

This generates a default fixture for every source that doesn't already have one. You can then refine the generated file with more realistic patterns.

#### Fixture enforcement test

The test suite includes an **enforcement test** (`'requires a per-source fixture for every known source'`) that fails if any source in `LOG_SOURCE_SIGNATURES` is missing a fixture, has an empty fixture, or has a fixture that doesn't contain the source's primary marker. This test runs as part of `npm run test:coverage` and cannot be skipped.

### 3. Add detection unit tests

In `tests/logstrip-parser.test.ts`, add a test verifying that `detectLogSources` correctly identifies your new source from a realistic log line:

```ts
it('detects my-tool sources', () => {
  expect(detectLogSources(['my-tool error: connection timeout'])).toContain('my-tool');
  expect(detectLogSources(['mytool-cli deploy failed'])).toContain('my-tool');
});
```

### 4. (Optional) Add a category smoke fixture

If your source belongs to a category that doesn't yet have a smoke fixture, or you want to exercise the full parser pipeline (deduplication, stack hiding, sanitization), add a new entry to the `cases` array in `tests/smoke.test.ts`:

```ts
{
  fixture: 'my-category.log',
  minSavingsPercent: 20,
  expectDeduplication: true,
  expectInternalStackHidden: true,
  mustContain: ['[ERROR] my-tool Error: connection timeout'],
  mustNotContain: ['[INFO]', '[DEBUG]', '0acddaf33456'],
},
```

Then create `tests/fixtures/my-category.log` with realistic log content from multiple sources in that category.

---

## Adding a New Parser Feature

When you add new parsing, sanitization, or scoring logic:

1. **Do not regress the 100% coverage gate.** Run `npm run test:coverage` - all four thresholds (statements, branches, functions, lines) must stay at 100%.
2. **Do not add runtime dependencies** to `src/cli` or `src/core`. The hot path is zero-dependency on purpose.
3. **Keep the parser streaming.** Never buffer the entire log into memory.
4. **Add a fixture-based smoke test** that documents the new behavior with a committed snapshot.
5. **Update `docs/reference/`** if the change affects the CLI flag set, action.yml schema, or public API surface.

---

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add source detection for <tool>
fix: prevent false-positive detection of sbt in sveltekit
test: add per-source fixture for <tool>
docs: update supported sources list
```

---

## Running the Full Verification

```bash
npm run typecheck && npm run test:coverage && npm run build && npm audit && npm run docs:build
```

All commands must exit 0 before you push.
