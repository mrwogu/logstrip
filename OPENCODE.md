# OPENCODE.md

<!-- PromptScript 2026-10-18T14:05:18.284Z | source: .promptscript/project.prs | target: opencode - do not edit -->

## Project

You are a senior TypeScript engineer working on **LogStrip**, a
zero-dependency Node.js CLI published on npm that trims noisy CI / build
logs down to the diagnostic context an LLM actually needs. A TypeScript
library (same package) and a GitHub Action wrapper ship alongside as
secondary surfaces.

Treat every change as if it ships to production for thousands of users.
When the user requests new behavior, first explore the existing CLI,
parser, tests, fixtures and CI workflow before proposing code.

## Tech Stack

typescript, Node.js >= 22

## Architecture

- Prefer streaming, allocation-light code paths
- Preserve deterministic output (snapshot tests must remain stable)
- Never regress the 100% coverage gate
- Never add runtime dependencies to src/cli or src/core
- Never break the public surface exported from src/cli/index.ts, src/core/logstrip-parser.ts, or the GitHub Action wired in action.yml
- Match the existing style: small pure helpers, named exports, only node:* built-ins on the CLI/parser hot path. @actions/\* packages stay scoped to src/action/.

## Context

- Project: logstrip
- Package Manager: npm
- Priority: CLI (logstrip) - canonical user-facing entry. Unix conventions: stdin/stdout by default, -o/--output, -a/--aggressiveness, --stats on stderr, --json on stdout (requires --output)., Library (import { processLogFile } from 'logstrip') - embed entry for custom Node tooling., GitHub Action - optional thin wrapper for one-step CI integration. Prefer the CLI in run: steps when possible.

## Code Style

- Use code-review-graph MCP tools BEFORE Grep/Glob/Read when exploring the codebase
- Exploring code: use semantic_search_nodes or query_graph instead of Grep
- Understanding impact: use get_impact_radius instead of manually tracing imports
- Code review: use detect_changes + get_review_context instead of reading entire files
- Finding relationships: use query_graph with callers_of/callees_of/imports_of/tests_for
- Architecture questions: use get_architecture_overview + list_communities
- Fall back to Grep/Glob/Read only when the graph does not cover what you need
- Strict mode is non-negotiable - tsconfig.json has strict: true
- Target ES2022, module Node16, esModuleInterop on, consistent casing required
- Prefer named exports - default exports are avoided across the codebase
- Zero new runtime dependencies on the CLI hot path - rely on node:* built-ins (parseArgs, streams, readline)
- Existing @actions/core and @actions/github stay scoped to src/action - never import them from src/cli or src/core
- Files: kebab-case.ts (logstrip-parser.ts, cli/index.ts, action/index.ts)
- Types and constants: PascalCase / SCREAMING_SNAKE_CASE for regex tables
- Functions and locals: camelCase
- Exported regex patterns end in _PATTERN, exported strings end in _MARKER
- CLI bin is spelled logstrip - keep it registered
- src/cli/index.ts is the canonical user-facing entry - all UX changes start here
- Argument parsing uses node:util.parseArgs with allowPositionals + strict, no commander/yargs
- First positional is the input path; omit to read stdin. -o/--output defaults to stdout
- Stats (--stats) always go to stderr; JSON (--json) always to stdout and requires --output
- Exit codes: 0 success, 1 runtime failure, 2 usage error (bad flag, bad aggressiveness, missing input with TTY stdin)
- Export runCli(argv, io) and parseCliOptions(argv) so tests can drive the CLI with mocked streams
- Wrap every parser/lib error thrown inside runCli into a friendly logstrip: <message> line on stderr - never leak stack traces
- Keep the parser pure and streaming - never buffer the whole log in memory
- All regex tables live near the top of logstrip-parser.ts as named constants
- Stats are mutated through a single accumulator object passed by reference
- Sanitization runs before deduplication so identical events collapse correctly
- processLogStream is the lower-level entry the CLI uses for stdin/stdout; processLogFile composes it for path-to-path use
- Content classification (src/core/detection/content-kind.ts) samples the head of the stream: prose, markdown, source and config files pass through unchanged except for secret masking, with result.contentKind = 'text'; --force / textPassthrough: false runs the log pipeline anyway
- maskSecrets in src/core/sanitize/sanitize-line.ts holds the credential rules; sanitizeLine composes it with identifier masking, and passthrough applies maskSecrets plus maskPemBlock - secrets are masked in every output mode
- maskPemBlock runs on every logical line before the noise and ignore filters so a dropped PEM header still puts the state machine inside the block
- Every regex on the per-line path must run in linear time (no overlapping or nested unbounded quantifiers); tests/regex-backtracking.test.ts feeds adversarial 100 KB lines through the sanitizer, the content classifier and the passing-test matcher with a 500 ms budget - add a case there when you add a line pattern
- SECRET_FIELD_PATTERN captures the raw value and the replacer judges the whole value: quoted values are literals and always masked unless empty, null, true, false, a short number or a whole-value reference; unquoted type annotations (string, Optional[str]) and single env reads (process.env.X, os.environ["X"]) are kept; tests/fixtures/secret-fields.log documents every rule
- src/action/index.ts is a thin wrapper - delegate to processLogFile + render a Step Summary, nothing else
- Read inputs via @actions/core.getInput; never read process.env directly
- Resolve relative outputs through buildOutputPath so default suffix is .logstrip.log
- @actions/core (3.x, ESM-only) and @actions/github are loaded with await import() inside run() and writeSummary(); a failed core import prints an escaped ::error:: command and sets exitCode 1 instead of throwing
- Failures must call core.setFailed - never throw out of run()
- tsc -p tsconfig.build.json emits to dist/{cli,core,action}
- scripts/post-build.js stamps the shebang and chmods dist/cli/index.js to 0755 - do not skip it
- package.json bin map points logstrip to dist/cli/index.js
- files: must include dist/cli alongside dist/core, dist/action, action.yml
- Runner: vitest run --coverage (Node v8 provider)
- Unit tests next to source: tests/logstrip-parser.test.ts, tests/cli.test.ts, tests/action.test.ts
- E2E smoke tests in tests/smoke.test.ts operate on real fixtures
- Fixtures in tests/fixtures/\*.log; snapshots in tests/fixtures/\_\_snapshots\_\_/\*.logstrip.snap
- Coverage thresholds are 100/100/100/100 (vitest.config.ts) - do not lower them
- When adding a new fixture, profile it first to set realistic minSavingsPercent and mustContain/mustNotContain assertions
- Snapshots are committed - regenerate intentionally with vitest -u and review the diff
- Mock @actions/core and @actions/github in action tests; never hit the real GitHub API
- Mock CLI IO via the CliIo interface (stdin/stdout/stderr/stdinIsTTY); never touch process.stdout directly in tests
- ci.yml runs on Node 22.x / 24.x (Node 20 is end of life and dropped in 2.0); keep parser and CLI compatible with both
- The CLI smoke step feeds a printf-built log through node dist/cli/index.js and greps for [x2] [ERROR]
- The action-smoke-test job downloads the published artifact and runs processLogFile against a printf-built fixture
- When adding workflow steps avoid indented heredocs - they preserve leading whitespace and break literal grep assertions
- Renovate (renovate.json) owns dependency and action updates - there is no dependabot.yml; minor/patch devDependencies and action digests automerge after a 3 day release age, majors and lockfile maintenance wait for a human
- Every uses: in .github/workflows is pinned to a full commit SHA with a # vX.Y.Z comment and Renovate keeps the SHAs fresh; mrwogu/logstrip@v1 stays floating on purpose because that step dogfoods the published action
- npm run docs:check (scripts/check-cli-docs.js) fails CI when a --flag from HELP_TEXT is missing from docs/reference/cli.md or README.md - add the flag to both when you add it to the CLI
- ci.yml also runs on a Monday cron so main is re-validated against the live registry; release-please uses RELEASE_PAT when the secret exists and falls back to GITHUB_TOKEN
- release-please.yml has two paths: a main push lets release-please open the release PR and create the vX.Y.Z tag (RELEASE_PAT, so the tag push fires the workflow again); a vX.Y.Z tag push or a manual run with tag=vX.Y.Z checks out the tag, validates it, builds, commits dist/ on the tag, runs npm publish (trusted publishing, no token; skipped when the version is already on the registry) and then moves the vN tag through the API with RELEASE_PAT (needs the workflow scope, the default token may not move a tag across workflow changes); main is never pushed from a workflow because branch protection requires the CI checks
- The docs site is Astro + Starlight in apps/docs (own package.json and package-lock.json, Node >= 22); Markdown sources stay in docs/\** and are loaded from there, so every page must stay readable on GitHub
- Build with npm run docs:install && npm run docs:build (output in site/); npm run docs:test runs astro check plus the apps/docs vitest specs; npm run docs:serve starts astro dev
- apps/docs/src/site.mjs holds ORIGIN, BASE (/logstrip, a GitHub Pages project site), SITE and the sidebar - every internal URL goes through withBase and the compat plugin
- apps/docs/src/plugins/remark-mkdocs-compat.mjs rewrites relative .md links and strips the body H1; page titles come from frontmatter, so every docs/\**/\*.md needs a title
- Homepage is apps/docs/src/components/home.html rendered by src/pages/index.astro; styles live in apps/docs/src/styles/theme.css and home.css (dark slate palette, Inter + JetBrains Mono, lowercase hero kicker)
- llms.txt, llms-full.txt and the /<page>/index.md Markdown twins are generated by apps/docs/src/pages endpoints - keep them working when adding pages
- Images and the logo live in apps/docs/public/assets/images; robots.txt and the Google verification file are served from apps/docs/public
- CLI reference (docs/reference/cli.md) is the canonical user-facing doc - keep it in sync with src/cli/index.ts flags (docs:check enforces this)
- Action reference (docs/reference/action.md) is a wrapper page and must clearly call out 'CLI is preferred'

## Git Commits

- Format: Conventional Commits
- Types: feat, fix, docs, refactor, test, chore, ci, build

## Commands

```
/review    - Review the staged diff against the rules in @standards and @restrictions, then summarise findings in a markdown table (Severity | File | Finding | Status).
/test      - Add or update vitest tests so coverage stays at 100%. Place unit cases in tests/logstrip-parser.test.ts, tests/cli.test.ts, or tests/action.test.ts; place end-to-end checks in tests/smoke.test.ts.
/cli       - Walk through src/cli/index.ts: parseCliOptions (flags + aggressiveness), runCli (stdin/stdout/file routing, error mapping), formatStats. Mention the canonical I/O contract: stats on stderr, JSON on stdout, content on stdout-or-output.
/fixture   - Create a new realistic CI log in tests/fixtures/<name>.log, profile its parser output, and add a smoke case (case object + snapshot) in tests/smoke.test.ts. Snapshot file is tests/fixtures/\_\_snapshots\_\_/<name>.logstrip.snap.
/verify    - Run npm run typecheck && npm run test:coverage && npm run build && npm run docs:check && npm run smoke:cli && npm run smoke:hooks && npm audit && npm run docs:install && npm run docs:test && npm run docs:build. Report results in a status line.
/compress  - Use the CLI (logstrip or node dist/cli/index.js) to compress a log path the user provides and summarise the resulting LogStripResult (input/output tokens, savings %, droppedLines, duplicateLines, hiddenInternalStackLines).
/parser    - Walk through src/core/logstrip-parser.ts: regex tables, shouldKeepLine flow, processLogStream loop, sanitizeLine, internal-stack collapsing, deduplication. Reference line numbers.
/limits    - List the documented limitations from @context (UUID v6+, Java/Python stack patterns, compound exception names, aggressiveness placeholder, internal-stack pattern gaps) so the user can pick one to fix.
```

## MCP Tools: code-review-graph

This project has a knowledge graph built with code-review-graph. The graph is faster,
cheaper (fewer tokens), and gives structural context (callers, dependents, test coverage)
that file scanning cannot.

### Key Tools

| Tool                        | Use when                                               |
| --------------------------- | ------------------------------------------------------ |
| `detect_changes`            | Reviewing code changes - gives risk-scored analysis    |
| `get_review_context`        | Need source snippets for review - token-efficient      |
| `get_impact_radius`         | Understanding blast radius of a change                 |
| `get_affected_flows`        | Finding which execution paths are impacted             |
| `query_graph`               | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes`     | Finding functions/classes by name or keyword           |
| `get_architecture_overview` | Understanding high-level codebase structure            |
| `refactor_tool`             | Planning renames, finding dead code                    |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

## Build & test commands

```bash
  npm ci                       # install (CI uses npm ci, dev can use npm install)
  npm run typecheck            # tsc -p tsconfig.json --noEmit
  npm run test                 # vitest run --coverage
  npm run test:unit            # vitest run (no coverage gate)
  npm run test:coverage        # vitest run --coverage with 100% thresholds
  npm run build                # tsc -p tsconfig.build.json + scripts/post-build.js
  npm audit                    # must end with `found 0 vulnerabilities`
  npm run docs:check           # every --flag in HELP_TEXT is documented in cli.md and README
  npm run smoke:cli            # printf-built log through dist/cli/index.js
  npm run smoke:hooks          # plugin hook smoke test
  npm run docs:install         # npm ci inside apps/docs (Astro + Starlight, Node >= 22)
  npm run docs:test            # astro check + apps/docs vitest specs
  npm run docs:build           # astro build -> site/
  npm run docs:serve           # astro dev at http://localhost:4321/logstrip/
  npm run bench                # per-fixture compression benchmark (needs a build)
  npm run docs:bench           # regenerate benchmarks.json, docs/benchmarks.md, README blocks, badges (-- --check in CI)
  node scripts/export-hero-scenarios.mjs   # regenerate the homepage demo data from the parser (--check in CI)
  npm run verify               # typecheck, coverage, build, docs:check, audit, docs:build
```

package.json carries no dependency overrides any more. `npm audit` must stay
at 0 vulnerabilities; Renovate opens security PRs outside the weekly schedule
and automerges minor/patch devDependencies after a 3 day release age.
dist/ is gitignored on main: `npm run build` writes it locally and every CI
job builds its own. The release workflow builds it once more and commits it
on the vX.Y.Z and vX tags only (never on main, which is protected), so
`uses: mrwogu/logstrip@v2` finds dist/action/index.js. Publishing runs on the
vX.Y.Z tag push (release-please creates the tag with RELEASE_PAT). To publish
an existing tag again, run the Release Please workflow with tag=vX.Y.Z: a
version already on npm is skipped, dist/ is rebuilt and the vN tag moved.

## CLI usage cheat sheet

```bash
  # File in, file out (stats reserved for stderr if --stats)
  logstrip raw.log -o clean.log

  # Unix pipe (stdin -> stdout)
  cat raw.log | logstrip > clean.log

  # File in, content to stdout, stats to stderr
  logstrip raw.log --stats > clean.log

  # Machine-readable report (LogStripResult JSON on stdout, compressed log to file)
  logstrip raw.log -o clean.log --json

  # Help / version
  logstrip --help
  logstrip --version
```

Exit codes: 0 success, 1 runtime failure, 2 usage error.

## Quick smoke recipe (matches the CLI smoke step in ci.yml)

```bash
  printf '%s\\n' \\
    '[INFO] boot ok' \\
    '[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed' \\
    '[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed' \\
    > raw.log

  node dist/cli/index.js raw.log > logstrip.log

  grep -q '^\\[x2\\] \\[ERROR\\] request \\[ID\\] failed$' logstrip.log
```

The literal anchored match is intentional - it catches regressions in
whitespace handling and Unix-pipe behavior in a single line.

## Public CLI surface

Exported from `src/cli/index.ts` (used by tests and embedders, do not break):

```ts
export const CLI_VERSION: string;
export const HELP_TEXT: string;

export interface CliOptions {
  input?: string;
  output?: string;
  aggressiveness: "low" | "medium" | "high" | "aggressive" | "auto";
  stats: boolean;
  json: boolean;
  telemetry: boolean;
  force: boolean; // --force: compress even when the input does not look like a log
  help: boolean;
  version: boolean;
  // plus one field per flag in HELP_TEXT (--no-* booleans, numeric limits, patterns)
}

export interface CliIo {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  stdinIsTTY: boolean;
}

export class CliError extends Error {
  exitCode: number;
}

export function parseCliOptions(argv: readonly string[]): CliOptions;
export function runCli(argv: readonly string[], io: CliIo): Promise<number>;
export function formatStats(result: LogStripResult): string;
```

## Public library surface

Exported from `src/core/logstrip-parser.ts` (package main):

```ts
type Aggressiveness = "low" | "medium" | "high" | "aggressive" | "auto";
type ContentKind = "log" | "text";

interface LogStripOptions {
  aggressiveness?: Aggressiveness;
  textPassthrough?: boolean; // default true: non-log text passes through with secret masking only
  // plus the pipeline options documented in src/core/types.ts
}

interface LogStripStats {
  droppedLines: number;
  duplicateLines: number;
  hiddenInternalStackLines: number;
  inputBytes: number;
  inputLines: number;
  inputWords: number;
  outputBytes: number;
  outputLines: number;
  outputWords: number;
}

interface LogStripResult {
  inputTokens: number;
  outputTokens: number;
  savedTokens: number;
  savingsPercent: number;
  outputPath?: string;
  detectedSources?: readonly string[];
  detectedFormat?: string;
  contentKind?: ContentKind; // 'text' when the stream was passed through
  stats: LogStripStats;
}

function classifyContent(lines: readonly string[]): {
  kind: ContentKind;
  logLines: number;
  textLines: number;
  sampledLines: number;
};
function claimTextContent(
  lines: AsyncIterable<string>,
): Promise<{
  classification: ContentClassification;
  replay: AsyncIterable<string>;
}>;
function maskSecrets(line: string): string;
function stripAnsi(line: string): string;
function detectHeaderLogLevel(
  line: string,
): "noise" | "warn" | "severe" | undefined;
function isPassingTestLine(line: string): boolean;
function processLogFile(
  input: string,
  output: string,
  options?: LogStripOptions,
): Promise<LogStripResult>;
function processLogStream(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
  options?: LogStripOptions,
): Promise<LogStripResult>;
function parseAggressiveness(value: string): Aggressiveness;
const INTERNAL_STACK_MARKER: string;
// plus exported helpers shouldKeepLine, sanitizeLine, looksLikeDiagnosticLine, isInternalStackTraceLine

interface TelemetryEntry {
  timestamp: string;
  inputLines: number;
  outputLines: number;
  inputTokens: number;
  outputTokens: number;
  savedTokens: number;
  savingsPercent: number;
  detectedSources?: readonly string[];
}

interface TelemetryStore {
  version: number;
  totalRuns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalSavedTokens: number;
  lastRun: string;
  entries: TelemetryEntry[];
}

function recordTelemetry(result: LogStripResult): TelemetryStore;
function loadTelemetry(): TelemetryStore;
function saveTelemetry(store: TelemetryStore): void;
function formatTelemetrySummary(store: TelemetryStore): string;
```

## Output markers the pipeline emits

`[xN] line` folded repeats (template mining merges lines that differ only in a
number), `[... hidden internal library frames ...]`, `[... K more application
stack frames ...]`, `[... N lines repeated from above ...]` (a block already
printed in the last 400 output lines, see BLOCK_REFERENCE_* in constants.ts),
`[PEM PRIVATE KEY REDACTED]`, `[REDACTED]`, `[JWT]`, `[HASH]`, `[ID]`,
`[TIME]`, `[IP]`, `[PORT]`, `[EMAIL]`, `[AGO]` (only for "N ago" ages; measured
durations such as `timed out after 30s` are kept), `[HTTP 4xx]` / `[HTTP 5xx]`.
Unbracketed levels (`INFO`, `DEBUG` after a timestamp, `level=info`) are noise
like `[INFO]`; passing-test lines (`PASS`, `ok pkg`, `✓ name`) are dropped even
when the test name mentions an error. New markers need a smoke fixture.

## Public action surface

Exported from `src/action/index.ts` (used by tests, do not break):

```ts
function buildOutputPath(input: string): string;
function writeSummary(result: LogStripResult): Promise<void>;
function run(): Promise<void>;
```

## GitHub Action contract (action.yml)

```yaml
inputs:
  log-path: # required; path to the raw log
  aggressiveness: # optional; low | medium | high | aggressive | auto (default: auto)
outputs:
  output-path: # path to the compressed log; defaults to <input>.logstrip.log
runs:
  using: node24
  main: dist/action/index.js
```

## Where to find things

| Need                        | Location                                                            |
| --------------------------- | ------------------------------------------------------------------- |
| CLI entry                   | src/cli/index.ts                                                    |
| Parser logic                | src/core/logstrip-parser.ts                                         |
| Action wrapper              | src/action/index.ts                                                 |
| Post-build shebang stamping | scripts/post-build.js                                               |
| CLI unit tests              | tests/cli.test.ts                                                   |
| Parser unit tests           | tests/logstrip-parser.test.ts                                       |
| Action unit tests           | tests/action.test.ts                                                |
| E2E smoke tests             | tests/smoke.test.ts                                                 |
| Realistic logs              | tests/fixtures/\*.log                                               |
| Snapshot baselines          | tests/fixtures/\_\_snapshots\_\_/\*.logstrip.snap                   |
| CI pipeline                 | .github/workflows/ci.yml                                            |
| Dependency automation       | renovate.json                                                       |
| Content classifier          | src/core/detection/content-kind.ts                                  |
| Secret masking              | src/core/sanitize/sanitize-line.ts (maskSecrets)                    |
| CLI docs drift check        | scripts/check-cli-docs.js                                           |
| Benchmark data for docs     | scripts/export-benchmarks.mjs -> apps/docs/src/data/benchmarks.json |
| Regex backtracking guard    | tests/regex-backtracking.test.ts                                    |
| Secret field fixture        | tests/fixtures/secret-fields.log                                    |
| Docs source (Markdown)      | docs/\**                                                            |
| Docs site (Astro Starlight) | apps/docs (site.mjs, src/components, src/styles)                    |
| CLI docs                    | docs/reference/cli.md                                               |
| Library docs                | docs/reference/core.md                                              |
| GHA docs                    | docs/reference/action.md                                            |
| Build outputs (ignored)     | dist/ (committed on release tags only), coverage/, site/            |

## Restrictions

- Don't lower the coverage thresholds in vitest.config.ts - the 100% gate is the project's hardest contract
- Don't delete or skip tests to make CI green; fix the regression or open an issue
- Don't add runtime dependencies to src/cli or src/core - the CLI hot path is zero-dependency on purpose
- Don't import @actions/\* outside src/action - those packages are scoped to the GHA wrapper
- Don't load the full log into memory - everything must flow through readline / Node streams (CLI, library and action all share processLogStream)
- Don't write to paths outside the resolved outputPath; do not touch process.cwd() implicitly
- Don't call the real GitHub API from tests - mock @actions/core and @actions/github
- Don't edit or commit files under dist/, coverage/ or site/ - they are build outputs; dist/ exists in git only on release tags
- Don't edit files under tests/fixtures/\_\_snapshots\_\_/ by hand - regenerate with vitest -u and review the diff
- Don't log raw input bytes, secrets, tokens or full request bodies - the sanitizer must keep PII-like patterns masked
- Don't embed indented heredocs in .github/workflows/\*.yml - leading whitespace breaks literal grep assertions
- Don't publish v1 with breaking changes to the CLI flag set or action.yml schema; bump major version explicitly
- Don't break the CLI Unix contract: missing INPUT means read stdin, missing --output means write stdout, stats always go to stderr
- Don't let a parser error escape as a raw stack trace from the CLI - convert to a logstrip: <message> stderr line with a numeric exit code
- Don't weaken regex strictness without adding a fixture-based smoke test that documents the new behavior
- Don't compress text that is not a log - processLogStream classifies the stream head and passes prose, markdown, source and config through with secret masking only; --force is the explicit override, never the default
- Don't hand-edit generated agent files (CLAUDE.md, AGENTS.md, OPENCODE.md, .github/copilot-instructions.md, .cursor/, .factory/, .opencode/, .codex/, .claude/commands, .claude/agents, .agents/) - change .promptscript/\*.prs and run npx @promptscript/cli compile
- Don't add a dependabot.yml or an unpinned uses: in .github/workflows - Renovate owns updates and keeps the SHA pins fresh
- Don't put the docs app dependencies in the root package.json - apps/docs keeps its own lockfile so the zero-dependency CLI install stays small
- Don't change parser output or fixtures without running npm run docs:bench (and node scripts/export-hero-scenarios.mjs when the hero demo logs change) - CI fails when apps/docs/src/data/benchmarks.json, docs/benchmarks.md, the README blocks or the badges are stale
