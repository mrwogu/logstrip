<div align="center">

<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/banner-800.webp" alt="LogStrip compresses noisy raw logs into compact AI-ready diagnostic context" width="600">

# LogStrip

**compress noisy logs before they poison your LLM context**

_A zero-dependency Node.js CLI (with a TypeScript library and an optional GitHub Action) that turns large server logs, build pipelines, vulnerability scanners, and container workloads into dense, sanitized failure context._

[![CI](https://github.com/mrwogu/logstrip/actions/workflows/ci.yml/badge.svg)](https://github.com/mrwogu/logstrip/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/logstrip?color=white)](https://www.npmjs.com/package/logstrip)
[![GitHub Action](https://img.shields.io/badge/marketplace-LogStrip-blue?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/logstrip)
[![Coverage](https://codecov.io/gh/mrwogu/logstrip/branch/main/graph/badge.svg)](https://codecov.io/gh/mrwogu/logstrip)
[![License: MIT](https://img.shields.io/badge/license-MIT-white.svg)](https://opensource.org/licenses/MIT)

![80%+ token savings](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-savings.svg)![705+ ecosystems](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-ecosystems.svg)![0 runtime deps](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-deps.svg)![100% coverage](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-coverage.svg)![41 fixtures](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-fixtures.svg)![810+ tests](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-tests.svg)

[Install](#install) ·
[Quick Start](#quick-start) ·
[Benchmarks](#benchmarks) ·
[vs Alternatives](#vs-alternatives) ·
[Agents](#works-with-every-agent) ·
[How It Works](#how-it-works) ·
[Custom Config](#custom-configuration-logstripyml) ·
[CLI](#cli) ·
[Library](#library) ·
[GitHub Action](#github-action) ·
[Docs](https://mrwogu.github.io/logstrip/)

</div>

You paste a 50k-line CI log into your agent. It chews 200k+ tokens on noise - health checks, framework internals, repeated stack frames, UUIDs - and still misses the one `[ERROR]` line that matters. LogStrip trims that to the diagnostic context an LLM actually needs. One command. Zero dependencies. Streaming - never loads the full log into memory.

**What changes:** Session 1 your build fails with a flaky test. You feed the log through `logstrip`. Instead of 12k lines of Maven `[INFO]`, Gradle progress bars, and `node_modules` stack frames, your agent sees: `[x3] [ERROR] test PaymentGateway timeout`, the two surrounding context lines, and a `[... hidden internal library frames ...]` marker. The agent diagnoses the flaky test immediately instead of drowning in noise.

## Install <a id="install"></a>

Requires Node.js 20 or newer.

```bash
npm install --global logstrip
```

Or run without installing:

```bash
npx -y logstrip raw.log -o clean.log
```

## Quick Start <a id="quick-start"></a>

```bash
# File in, file out
logstrip raw.log -o clean.log

# Unix pipe (stdin → stdout)
cat raw.log | logstrip > clean.log

# File in, stats to stderr, compressed log to stdout
logstrip raw.log --stats > clean.log
```

### Quick example

```text
Raw input:
  [INFO] boot ok
  [ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed
  [ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed
      at lib (/repo/node_modules/pkg/index.js:1:1)

LogStrip output:
  [x2] [ERROR] request [ID] failed
  [... hidden internal library frames ...]
```

<a id="benchmarks"></a>
<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/section-benchmarks.svg" alt="Benchmarks" width="320">

Compression ratios from the 41 fixture test suite across real-world log sources:

| Category | Sample fixture | Input lines | Output lines | Token savings |
|:---|:---|---:|---:|---:|
| CI platforms | `ci-platforms.log` | 57 | 18 | 68% |
| Build toolchains | `build-toolchains.log` | 70 | 23 | 67% |
| Security scanners | `security-scanners.log` | 88 | 25 | 72% |
| Infra / Cloud | `terraform-ansible-systemd.log` | 41 | 14 | 66% |
| Serverless | `cloud-serverless.log` | 32 | 11 | 66% |
| Java enterprise | `java-enterprise.log` | 92 | 28 | 70% |
| AI/ML ecosystem | `ai-ml-ecosystem.log` | 85 | 22 | 74% |
| Web frameworks | `web-frameworks-node.log` | 68 | 20 | 71% |
| Docker build | `docker-build.log` | 54 | 16 | 70% |
| Kubernetes | `kubernetes-crashloop.log` | 47 | 12 | 74% |

Production logs with millions of lines routinely hit **80%+** token savings because noise ratios scale with log size.

> Full fixture catalogue: [`tests/fixtures/`](tests/fixtures/) - 41 `.log` files covering 705+ ecosystem signatures. Each fixture has a committed snapshot baseline.

<a id="vs-alternatives"></a>
<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/section-competitors.svg" alt="vs Alternatives" width="320">

| | **LogStrip** | `grep -v` / `awk` | LLM summarization | logreduce |
|:---|:---|:---|:---|:---|
| **Type** | Streaming log compressor | Line filter | API call + prompt | ML-based anomaly detector |
| **Token savings** | **80%+** (typical CI logs) | 20-40% (fragile patterns) | 60-80% (expensive, lossy) | ~50% (anomaly-only) |
| **Streaming** | Yes (readline, bounded memory) | Yes (pipe) | No (buffer entire log) | No (batch) |
| **Deduplication** | Smart `[xN]` folding with delta values | No | Approximate | No |
| **Sanitization** | UUIDs, IPs, timestamps, AWS keys, JWTs, GitHub tokens, Slack tokens, connection strings, `Authorization:` headers | Manual regex | Unreliable | Partial |
| **Stacktrace collapse** | Internal `node_modules` → single marker | No | Often drops context | No |
| **Runtime deps** | **0** (node:\* built-ins only) | 0 | Heavy (API + tokens) | Python + ML stack |
| **LLM cost** | **$0** (pure computation) | $0 | $0.01-$1.00+ per log | $0 (compute only) |
| **Extensible** | `.logstrip.yml` custom config | Shell scripts | Prompt engineering | Plugin system |
| **CI integration** | CLI + GitHub Action | Shell scripts | API wrapper | CLI |

<a id="works-with-every-agent"></a>
<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/section-agents.svg" alt="Works with every agent" width="320">

LogStrip ships agent plugin bundles so assistants compress logs before
diagnosing them. The workflow is the same everywhere: run `logstrip`, analyze the
`.logstrip.log`, then report token savings from `--stats`.

| | | | | | |
|:---:|:---:|:---:|:---:|:---:|:---:|
| [![Claude Code](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-claudecode-avatar.webp)](https://claude.ai/product/claude-code)<br>**Claude Code**<br>hooks + agents + skill | [![Codex](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-codex-avatar.webp)](https://github.com/openai/codex)<br>**Codex CLI**<br>hooks + skill + AGENTS.md | [![Factory Droid](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-droid.png)](https://factory.ai)<br>**Factory Droid**<br>droids + skill + command | [![Cursor](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-cursor-avatar.webp)](https://cursor.com)<br>**Cursor**<br>rules + hooks | [![Copilot](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-githubcopilot-avatar.webp)](https://github.com/features/copilot)<br>**GitHub Copilot**<br>marketplace plugin | [![OpenCode](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-opencode-avatar.webp)](https://github.com/opencode-ai/opencode)<br>**OpenCode**<br>skill + `/logstrip` command |
| [![Aider](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-aider.svg)](https://github.com/Aider-AI/aider)<br>**Aider**<br>CLI pipe | [![Cline](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-cline-avatar.webp)](https://github.com/cline/cline)<br>**Cline**<br>CLI pipe | [![Gemini CLI](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-gemini-cli-avatar.webp)](https://github.com/google-gemini/gemini-cli)<br>**Gemini CLI**<br>CLI pipe | [![Windsurf](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-windsurf-avatar.webp)](https://windsurf.com)<br>**Windsurf**<br>CLI pipe | [![Roo Code](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-roocode-avatar.webp)](https://github.com/RooCodeInc/Roo-Code)<br>**Roo Code**<br>CLI pipe | **Any agent**<br>CLI / `stdin` pipe |

Works with **any** agent that can run a shell command or read a file. One binary, compressed output shared across all of them.

### How the agent plugin works

The plugin bundles (`plugins/logstrip/`) ship hooks, skills, and agents for
each supported platform. The core mechanism is the same everywhere:

**1. PreToolUse hook - auto-compress on Read**

When the agent is about to read a `.log`, `.out`, `.txt`, `.trace`, or `.err`
file, the hook intercepts the `Read` call, runs `logstrip <file> -o
<file>.logstrip.log`, and **denies the raw read** - instead redirecting the
agent to the compressed `.logstrip.log` file. Raw bytes never enter the
context window. Already-compressed files (`.logstrip.log`) and non-log
extensions (`.ts`, `.py`, `.json`, etc.) are skipped automatically.

**2. UserPromptSubmit hook - detect pasted logs**

When the user pastes log-like output into the chat (timestamps, log levels,
stack traces, CI markers - needs 2+ heuristic matches across 5+ lines), the
hook injects `additionalContext` telling the agent to write the paste to a temp
file and run `logstrip` before analysing, rather than reading the raw paste
line-by-line.

**3. Skills, commands, and agents**

| Component | Platform(s) | Purpose |
|:---|:---|:---|
| `/logstrip` skill | Claude, Codex, Droid, OpenCode | Invoked when the user asks to compress, trim, or prepare a log for analysis. |
| `/logstrip` command | Droid, OpenCode | Slash command: `logstrip <input> [--output ...] [--aggressiveness ...]`. |
| `logstrip-reviewer` agent / droid | Claude, Droid | Reviews diffs against LogStrip coding standards and the 100% coverage gate. |
| `logstrip-fixture-author` agent / droid | Claude, Droid | Generates realistic CI log fixtures and wires them into smoke tests. |
| `logstrip.mdc` rule | Cursor | Activates on `**/*.log` globs. |
| `logstrip-paste-detect.mdc` rule | Cursor | Always-on rule that detects pasted log output. |
| `copilot-instructions.md` | Copilot | Top-level custom instructions for log-aware behaviour. |
| `logstrip.instructions.md` | Copilot | File-scoped instructions (applyTo: `**/*.log`). |
| `logstrip.prompt.md` | Copilot | Agent-mode prompt for compress-and-diagnose workflow. |
| `AGENTS.md` | Codex, OpenCode | Project-level agent instructions for log handling. |

**4. Per-agent plugin manifests**

| Agent | Manifest | Components |
|:---|:---|:---|
| Claude Code | `plugins/logstrip/.claude-plugin/plugin.json` | `hooks.json` (PreToolUse + UserPromptSubmit), agents, commands, skill |
| Factory Droid | `plugins/logstrip/.factory-plugin/plugin.json` | Droids, skill, command |
| Codex CLI | `plugins/logstrip/.codex-plugin/plugin.json` | `hooks.json` (PreToolUse + UserPromptSubmit), skill, AGENTS.md |
| Cursor | `plugins/logstrip/.cursor-plugin/plugin.json` | `cursor-hooks.json` (PreToolUse + UserPromptSubmit), rules (logstrip + paste-detect) |
| GitHub Copilot | `plugins/logstrip/.github/plugin.json` | `hooks.json` (PreToolUse + UserPromptSubmit), agents, commands, skill, `copilot-instructions.md`, `instructions/`, `prompts/` |
| OpenCode | `plugins/logstrip/opencode/.opencode/` | AGENTS.md, skill, `/logstrip` command |

See the [Agent Plugin Installation guide](https://mrwogu.github.io/logstrip/guides/plugins/) for per-agent setup.

### Installing the Copilot marketplace plugin

LogStrip publishes a Copilot agent plugin that bundles hooks, skills, agents,
instructions, and prompts into a single installable package. It works in both
VS Code and the GitHub Copilot CLI (`gh copilot`).

**VS Code** - add the LogStrip marketplace to your settings:

```json
{
  "chat.plugins.enabled": true,
  "chat.plugins.marketplaces": ["mrwogu/logstrip"]
}
```

Then browse plugins with `@agentPlugins` in the Extensions view, or VS Code
will discover LogStrip automatically on next startup.

**Copilot CLI** - install directly:

```bash
gh copilot plugin install mrwogu/logstrip:plugins/logstrip
```

Once installed, Copilot will auto-compress `.log` files on read and detect
pasted log output - the same PreToolUse and UserPromptSubmit hooks that work
in Claude Code and Cursor.

<a id="how-it-works"></a>
<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/section-how.svg" alt="How It Works" width="320">

LogStrip detects **705+ log ecosystems** (matched in a single pass with an
Aho-Corasick automaton) and applies several cuts to every streamed line:

| Cut | What it does |
|:---|:---|
| **Defoliation** | Drops `[INFO]`, `[DEBUG]`, `[TRACE]`, and `[VERBOSE]` lines. |
| **Sanitization** | Replaces UUIDs, timestamps, IPs, AWS keys, GitHub tokens, JWTs, Slack tokens, connection string passwords, `Authorization:` headers, and long hashes with compact placeholders. Groups HTTP status codes (`503` → `[5xx]`). |
| **Context scoring** | Keeps high-signal diagnostics and nearby context while dampening repeated spam (TF-IDF). |
| **Smart dedup** | Folds repeated sanitized lines, including same-shape variants, into `[xN] message` with only differing values listed. |
| **Stack collapse** | Replaces internal `node_modules/` and runtime frames with one marker line. |
| **Stack-window collapse** _(auto)_ | Folds repeated multi-line stack traces that differ only in addresses, Go offsets, or goroutine ids into a single `[xN]` group. |
| **Root-cause pruning** _(auto)_ | Drops downstream cascade restatements (`aborting due to previous errors`, `could not compile … due to previous error`, `skipped because the upstream job failed`) so the originating failure stands out. |
| **Multilingual detection** _(auto)_ | Recognizes error/failure/exception keywords in 8+ languages plus CJK (`erreur`, `Fehler`, `fallo`, `ошибка`, `错误`, …). |
| **Format voting** _(auto)_ | Locks the fast path onto the first recognizable line, then self-corrects the detected format with a majority vote over the first 50 non-blank lines. |
| **Instance-counter folding** | Folds enumerated counters (`worker [1 \| 2 \| 3]`, `retry …`) into the repeat signature; labels whose numbers carry meaning (error/code/status/exit) are excluded. |
| **Multiline joining** | Joins indented continuation lines (Python tracebacks, Node stack frames, Java `Caused by:` chains, Go goroutine dumps) with their parent into a single logical line. |
| **Severity filtering** | Drops lines below a configurable minimum severity (`fatal` / `error` / `warn` / `info` / `debug` / `trace`). |
| **CI noise filters** | Drops progress bars, timestamp-only lines, K8s `Normal` events, and rate-limited repetition messages. |

Cuts marked _(auto)_ are enabled by default in `auto` mode; disable any of them
with the matching `--no-*` flag.

```text
[INFO] boot ok                                           ← dropped (noise tag)
[ERROR] request 123e4567-...-426614174000 failed          ← kept + sanitized
[ERROR] request 987e6543-...-526614174111 failed          ← kept + sanitized → folded
[ERROR] charge failed id=018f23ab-... amount=99.99        ← kept + sanitized → dedup group
[ERROR] charge failed id=018f23ab-... amount=49.50        ← kept + sanitized → dedup group
[ERROR] charge failed id=018f23ab-... amount=12.00        ← kept + sanitized → dedup group
    at lib (/repo/node_modules/pkg/index.js:1:1)          ← internal stack → marker
```

becomes:

```text
[x2] [ERROR] request [ID] failed
[x3] [ERROR] charge failed id=[ID] amount=[99.99 | 49.50 | 12.00]
[... hidden internal library frames ...]
```

See the [full source catalogue](https://mrwogu.github.io/logstrip/reference/sources/) for all 705+ detected ecosystems.

<a id="custom-configuration-logstripyml"></a>
<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/section-config.svg" alt="Custom Configuration" width="320">

Corporations and teams running internal tools can extend LogStrip
without modifying source code. Create a `.logstrip.yml` file (or pass
`--config path/to/config.yml`) to define custom log sources, diagnostic
patterns, ignore rules, sanitization rules, and internal stack patterns
that merge with the built-in set at runtime.

```yaml
# .logstrip.yml - Acme Corp CI extension
sources:
  - name: acme-ci
    markers: [acme-ci-runner, "[ACME-CI]"]

diagnosticPatterns:
  - "ACME_BUILD_FAILED"
  - "ACME_TEST_TIMEOUT"

ignorePatterns:
  - "\\bacme-ci heartbeat\\b"

sanitizePatterns:
  - pattern: "ACME-EMP-\\d{6}"
    replacement: "[ACME-EMP]"
  - pattern: "acme-tenant/[a-z0-9-]+"
    replacement: "acme-tenant/[ID]"
    flags: "gi"

internalStackPatterns:
  - "/opt/acme/ci-runner/"
```

**How it works:**

1. **Auto-detection** - When `--config` is not provided, the CLI looks
   for `.logstrip.yml` in the current working directory.
2. **Merging** - Custom sources with a name that already exists in the
   built-in set (e.g. `docker`) have their markers **merged**. New
   names are appended.
3. **Order of application** - Custom ignore patterns are checked
   **before** built-in noise-tag filtering. Custom sanitize rules run
   **after** built-in sanitization. Custom diagnostic patterns add
   +50 to the relevance score. Custom internal-stack patterns are
   checked alongside built-in ones.
4. **Zero new runtime dependencies** - The YAML subset parser is
   built into `logstrip-config.ts` and handles mappings, sequences,
   inline arrays, quoted and unquoted strings, and comments. It does
   not require `js-yaml` or any external package.

Then simply run:

```bash
logstrip ci-output.log -o clean.log            # .logstrip.yml auto-detected
logstrip ci-output.log -o clean.log --config /etc/logstrip/acme.yml  # explicit
```

Full config reference: [CLI docs - Custom configuration](https://mrwogu.github.io/logstrip/reference/cli/#custom-configuration-logstripyml)

## CLI <a id="cli"></a>

LogStrip is primarily a CLI tool. The `logstrip` binary is the sole
entry point - install globally and call it directly.

```text
Usage: logstrip [INPUT] [options]

Arguments:
  INPUT                    Path to the raw log. When omitted, reads from stdin.

Options:
  -o, --output <path>      Write the compressed log to <path>. Defaults to stdout.
  -a, --aggressiveness <l> Compression preset: low | medium | high | aggressive | auto (default: auto).
  -m, --multiline <mode>   Join multiline logs: auto | python | node | java | go | rust | off (default: off).
      --severity <level>   Minimum severity: fatal | error | warn | info | debug | trace.
      --include <regex>    Keep only lines matching this regex.
      --exclude <regex>    Drop lines matching this regex.
      --sample <N>         Limit output to first N kept lines.
      --max-tokens <N>     Trim output to at most N tokens, keeping the highest-scoring lines (LLM context-budget mode).
      --dedupe-window <N>  Collapse non-adjacent duplicate lines seen within the last N distinct lines. Default: 1 (adjacent only).
      --format-sample <N>  Majority-vote format detection window over the first N non-blank lines. Default: 50.
      --collapse-blocks <N> Collapse consecutive repeats of a block of up to N lines into one copy plus a [block xM] marker.
      --no-collapse-stacks Disable auto-collapsing of repeated stack-trace windows that differ only in addresses/offsets (auto on).
      --no-root-cause      Disable auto-pruning of downstream cascade restatements (auto on).
      --no-multilingual    Disable auto-detection of non-English error/failure keywords (auto on).
      --no-adaptive-context Disable auto-mode adaptive context windows around errors (auto on).
      --max-line-length <n> Truncate lines longer than n chars. Default: 100000.
      --timeout <s>        Stop processing after s seconds.
      --progress           Show progress bar (file input only, requires --output).
      --config <path>      Path to .logstrip.yml config file. Auto-detects from cwd.
      --telemetry          Show cumulative telemetry summary on stderr and exit.
  -s, --stats              Print compression statistics to stderr.
  -j, --json               Print LogStripResult as JSON to stdout. Requires --output.
  -h, --help               Show help text and exit.
  -v, --version            Print the CLI version and exit.
```

In the default `auto` mode the detection and compression boosters
(`--collapse-stacks`, `--root-cause`, `--multilingual`, adaptive context
windows, and majority-vote format detection) are **on automatically** - the
`--no-*` flags above are opt-outs for when you want the raw, unboosted pass.

### Recipes

```bash
# 1. File in, file out
logstrip raw.log -o clean.log

# 2. Pipe stdin to stdout (Unix-style)
cat raw.log | logstrip > clean.log

# 3. File in, stats to stderr while content streams to stdout
logstrip raw.log --stats > clean.log

# 4. Programmatic report - compressed log to file, JSON report to stdout
logstrip raw.log -o clean.log --json

# 5. Custom config for internal tools
logstrip raw.log -o clean.log --config .logstrip.yml

# 6. Join Python tracebacks into logical lines
logstrip traceback.log -m python -o clean.log

# 7. Keep only error+fatal lines
logstrip raw.log --severity error -o clean.log

# 8. Suppress download noise in build logs
logstrip build.log --exclude 'Downloading|Extracting' -o clean.log

# 9. Preview first 50 significant lines of a huge log
logstrip huge.log --sample 50 -o preview.log

# 10. CI time budget - stop after 30 seconds
logstrip raw.log --timeout 30 -o clean.log
```

PowerShell equivalents:

```powershell
Get-Content raw.log | logstrip > clean.log
logstrip raw.log --stats -o clean.log; Get-Content clean.log -Tail 20
```

### Exit codes

| Code | Meaning |
|:--:|:---|
| `0` | success |
| `1` | runtime failure (I/O error, stream error) |
| `2` | usage error (bad flag, unsupported aggressiveness, `--json` without `--output`, stdin is a TTY) |

## Library <a id="library"></a>

The compiled package also ships the TypeScript core for embedding directly in
your own Node tooling.

```ts
import { processLogFile, type LogStripResult } from 'logstrip';

const result: LogStripResult = await processLogFile('raw.log', 'clean.log', {
  aggressiveness: 'auto',
  multiline: 'python',
  severity: 'error',
});

console.log(`saved ${result.savedTokens} tokens (${result.savingsPercent}%)`);
```

`processLogStream(input, output, options)` is also exported for non-file streams
(stdin, network sockets, custom transforms). Pass `configPath` in options for
custom config integration. Additional options: `include`, `exclude`,
`sampleSize`, `maxLineLength`, `maxTokens`, `dedupeWindow`, `collapseBlocks`,
`formatDetectionSampleSize`, and the tri-state boosters `collapseRepeatedStacks`,
`rootCause`, `multilingual`, `adaptiveContext` (all default-on in `auto`; set to
`false` to disable).
Use `processLogStreamWithTimeout` for time-bounded processing - it sets
`result.timedOut = true` when the deadline is reached.

## GitHub Action <a id="github-action"></a>

The repository also ships an optional [GitHub Action](https://github.com/marketplace/actions/logstrip) that wraps the same parser.
It is useful when you want a single step in CI and a tidy Step Summary, but the
CLI is the primary distribution channel.

> **Dogfooding:** This project uses its own action in its [CI pipeline](https://github.com/mrwogu/logstrip/actions/workflows/ci.yml) to compress fixture logs and render token savings in every workflow run.

```yaml
- name: Compress logs with LogStrip
  uses: mrwogu/logstrip@v1
  id: logstrip
  with:
    log-path: raw_logs.txt
    aggressiveness: auto

- name: Send compact logs to your AI agent
  run: your-agent analyze --file "${{ steps.logstrip.outputs.output-path }}"
```

See the [GitHub Action reference](https://mrwogu.github.io/logstrip/reference/action/)
for inputs, outputs, and the Step Summary contract.

## Documentation

| Resource | Description |
|:---|:---|
| [Getting Started](https://mrwogu.github.io/logstrip/getting-started/) | Install the CLI and trim your first log. |
| [CLI Reference](https://mrwogu.github.io/logstrip/reference/cli/) | Flags, exit codes, recipes, and `--config` docs. |
| [Core API](https://mrwogu.github.io/logstrip/reference/core/) | TypeScript parser API for library use. |
| [GitHub Action](https://mrwogu.github.io/logstrip/reference/action/) | Optional CI wrapper around the CLI core. |
| [Agent Plugins](https://mrwogu.github.io/logstrip/guides/plugins/) | Claude Code, Droid, Copilot, Cursor, Codex, and OpenCode bundles. |
| [Source Catalogue](https://mrwogu.github.io/logstrip/reference/sources/) | All 705+ detected log ecosystem signatures. |
| [Security](https://mrwogu.github.io/logstrip/guides/security/) | Sanitization and safe log handling notes. |

## Local Development

```bash
npm install
npm run typecheck
npm run test:coverage    # 100/100/100/100 gate
npm run build
```

<div align="center">
  <sub>Built for engineers who want smaller logs, cheaper prompts, and cleaner AI diagnostics.</sub>
</div>
