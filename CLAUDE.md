# CLAUDE.md

<!-- PromptScript 2026-05-21T20:36:23.654Z | source: .promptscript/project.prs | target: claude - do not edit -->

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

typescript, Node.js >= 20

## Code Style

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
- src/action/index.ts is a thin wrapper - delegate to processLogFile + render a Step Summary, nothing else
- Read inputs via @actions/core.getInput; never read process.env directly
- Resolve relative outputs through buildOutputPath so default suffix is .logstrip.log
- @actions/github is imported dynamically to avoid CJS/ESM conflicts in tests
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
- ci.yml runs on Node 20.x / 22.x / 24.x; keep parser and CLI compatible with all three
- The CLI smoke step feeds a printf-built log through node dist/cli/index.js and greps for [x2] [ERROR]
- The action-smoke-test job downloads the published artifact and runs processLogFile against a printf-built fixture
- When adding workflow steps avoid indented heredocs - they preserve leading whitespace and break literal grep assertions
- MkDocs Material with mkdocs.yml + docs/\**; build with mkdocs build --strict
- CLI reference (docs/reference/cli.md) is the canonical user-facing doc - keep it in sync with src/cli/index.ts flags
- Action reference (docs/reference/action.md) is a wrapper page and must clearly call out 'CLI is preferred'
- Custom CSS lives in docs/assets/stylesheets/extra.css (dark theme, JetBrains Mono, lowercase hero)
- Logo asset is docs/assets/images/logo.svg

## Git Commits

- Format: Conventional Commits
- Types: feat, fix, docs, refactor, test, chore, ci, build

## Commands

```
/review    -
/test      -
/cli       -
/fixture   -
/verify    -
/compress  -
/parser    -
/limits    -
```

## Build & test commands

```bash
    npm ci                       # install (CI uses npm ci, dev can use npm install)
    npm run typecheck            # tsc -p tsconfig.json --noEmit
    npm run test                 # vitest run --coverage
    npm run test:unit            # vitest run (no coverage gate)
    npm run test:coverage        # vitest run --coverage with 100% thresholds
    npm run build                # tsc -p tsconfig.build.json + scripts/post-build.js
    npm audit                    # must end with `found 0 vulnerabilities`
    npm run docs:build           # mkdocs build --strict
    npm run docs:serve           # local MkDocs preview
```

Dependency overrides in package.json keep `@actions/http-client@^3.0.2` and
`undici@^6.25.0` to clear known advisories - keep them in sync with audit.

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
      aggressiveness: 'low' | 'medium' | 'high' | 'aggressive';
      stats: boolean;
      json: boolean;
      help: boolean;
      version: boolean;
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
    type Aggressiveness = 'low' | 'medium' | 'high' | 'aggressive';

    interface LogStripOptions { aggressiveness?: Aggressiveness }

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
      stats: LogStripStats;
    }

    function processLogFile(input: string, output: string, options?: LogStripOptions): Promise<LogStripResult>;
    function processLogStream(input: NodeJS.ReadableStream, output: NodeJS.WritableStream, options?: LogStripOptions): Promise<LogStripResult>;
    function parseAggressiveness(value: string): Aggressiveness;
    const INTERNAL_STACK_MARKER: string;
    // plus exported helpers shouldKeepLine, sanitizeLine, looksLikeDiagnosticLine, isInternalStackTraceLine
```

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
      log-path:        # required; path to the raw log
      aggressiveness:  # optional; low | medium | high | aggressive (default: high)
    outputs:
      output-path:     # path to the compressed log; defaults to <input>.logstrip.log
    runs:
      using: node20
      main: dist/action/index.js
```

## Where to find things

| Need                          | Location                                              |
| ----------------------------- | ----------------------------------------------------- |
| CLI entry                     | src/cli/index.ts                                      |
| Parser logic                  | src/core/logstrip-parser.ts                             |
| Action wrapper                | src/action/index.ts                                   |
| Post-build shebang stamping   | scripts/post-build.js                                 |
| CLI unit tests                | tests/cli.test.ts                                     |
| Parser unit tests             | tests/logstrip-parser.test.ts                           |
| Action unit tests             | tests/action.test.ts                                  |
| E2E smoke tests               | tests/smoke.test.ts                                   |
| Realistic logs                | tests/fixtures/\*.log                                  |
| Snapshot baselines            | tests/fixtures/\_\_snapshots\_\_/\*.logstrip.snap            |
| CI pipeline                   | .github/workflows/ci.yml                              |
| Docs source                   | docs/, mkdocs.yml, requirements-docs.txt              |
| CLI docs                      | docs/reference/cli.md                                 |
| Library docs                  | docs/reference/core.md                                |
| GHA docs                      | docs/reference/action.md                              |
| Build outputs (do not edit)   | dist/, coverage/, site/                               |

## Don'ts

- Don't lower the coverage thresholds in vitest.config.ts - the 100% gate is the project's hardest contract
- Don't delete or skip tests to make CI green; fix the regression or open an issue
- Don't add runtime dependencies to src/cli or src/core - the CLI hot path is zero-dependency on purpose
- Don't import @actions/\* outside src/action - those packages are scoped to the GHA wrapper
- Don't load the full log into memory - everything must flow through readline / Node streams (CLI, library and action all share processLogStream)
- Don't write to paths outside the resolved outputPath; do not touch process.cwd() implicitly
- Don't call the real GitHub API from tests - mock @actions/core and @actions/github
- Don't edit files under dist/, coverage/ or site/ - they are build outputs
- Don't edit files under tests/fixtures/\_\_snapshots\_\_/ by hand - regenerate with vitest -u and review the diff
- Don't log raw input bytes, secrets, tokens or full request bodies - the sanitizer must keep PII-like patterns masked
- Don't embed indented heredocs in .github/workflows/\*.yml - leading whitespace breaks literal grep assertions
- Don't publish v1 with breaking changes to the CLI flag set or action.yml schema; bump major version explicitly
- Don't break the CLI Unix contract: missing INPUT means read stdin, missing --output means write stdout, stats always go to stderr
- Don't let a parser error escape as a raw stack trace from the CLI - convert to a logstrip: <message> stderr line with a numeric exit code
- Don't weaken regex strictness without adding a fixture-based smoke test that documents the new behavior
