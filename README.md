<div align="center">

<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/banner-800.webp" alt="LogStrip compresses noisy raw logs into compact AI-ready diagnostic context" width="600">

# LogStrip

**compress noisy logs before they poison your LLM context**

_A zero-dependency Node.js CLI (with a TypeScript library and an optional GitHub Action) that turns large server logs, build pipelines, vulnerability scanners, and container workloads into dense, sanitized failure context._

[![CI](https://github.com/mrwogu/logstrip/actions/workflows/ci.yml/badge.svg)](https://github.com/mrwogu/logstrip/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/logstrip?color=white)](https://www.npmjs.com/package/logstrip)
[![Coverage](https://codecov.io/gh/mrwogu/logstrip/branch/main/graph/badge.svg)](https://codecov.io/gh/mrwogu/logstrip)
[![License: MIT](https://img.shields.io/badge/license-MIT-white.svg)](https://opensource.org/licenses/MIT)

![80%+ token savings](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-savings.svg)![705+ ecosystems](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-ecosystems.svg)![0 runtime deps](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-deps.svg)![100% coverage](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-coverage.svg)![38 fixtures](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-fixtures.svg)![357+ tests](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-tests.svg)

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

You paste a 50k-line CI log into your agent. It chews 200k+ tokens on noise – health checks, framework internals, repeated stack frames, UUIDs – and still misses the one `[ERROR]` line that matters. LogStrip trims that to the diagnostic context an LLM actually needs. One command. Zero dependencies. Streaming – never loads the full log into memory.

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

### 30-second demo

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

Compression ratios from the 38 fixture test suite across real-world log sources:

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

> Full fixture catalogue: [`tests/fixtures/`](tests/fixtures/) – 38 `.log` files covering 705+ ecosystem signatures. Each fixture has a committed snapshot baseline.

<a id="vs-alternatives"></a>
<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/section-competitors.svg" alt="vs Alternatives" width="320">

| | **LogStrip** | `grep -v` / `awk` | LLM summarization | logreduce |
|:---|:---|:---|:---|:---|
| **Type** | Streaming log compressor | Line filter | API call + prompt | ML-based anomaly detector |
| **Token savings** | **80%+** (typical CI logs) | 20–40% (fragile patterns) | 60–80% (expensive, lossy) | ~50% (anomaly-only) |
| **Streaming** | Yes (readline, bounded memory) | Yes (pipe) | No (buffer entire log) | No (batch) |
| **Deduplication** | Smart `[xN]` folding with delta values | No | Approximate | No |
| **Sanitization** | UUIDs, IPs, timestamps, AWS keys, JWTs | Manual regex | Unreliable | Partial |
| **Stacktrace collapse** | Internal `node_modules` → single marker | No | Often drops context | No |
| **Runtime deps** | **0** (node:\* built-ins only) | 0 | Heavy (API + tokens) | Python + ML stack |
| **LLM cost** | **$0** (pure computation) | $0 | $0.01–$1.00+ per log | $0 (compute only) |
| **Extensible** | `.logstrip.yml` custom config | Shell scripts | Prompt engineering | Plugin system |
| **CI integration** | CLI + GitHub Action | Shell scripts | API wrapper | CLI |

<a id="works-with-every-agent"></a>
<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/section-agents.svg" alt="Works with every agent" width="320">

LogStrip ships agent plugin bundles so assistants compress logs before
diagnosing them. The workflow is the same everywhere: run `logstrip`, analyze the
`.logstrip.log`, then report token savings from `--stats`.

| | | | | | |
|:---:|:---:|:---:|:---:|:---:|:---:|
| [![Claude Code](https://avatars.githubusercontent.com/anthropics?s=80)](https://claude.ai/product/claude-code)<br>**Claude Code**<br>marketplace plugin | [![Codex](https://avatars.githubusercontent.com/openai?s=80)](https://github.com/openai/codex)<br>**Codex CLI**<br>skill + command | [![Factory Droid](https://avatars.githubusercontent.com/factory-ai?s=80)](https://factory.ai)<br>**Factory Droid**<br>marketplace plugin | [![Cursor](https://avatars.githubusercontent.com/cursor-ai?s=80)](https://cursor.com)<br>**Cursor**<br>rule + command | [![Copilot](https://avatars.githubusercontent.com/github?s=80)](https://github.com/features/copilot)<br>**GitHub Copilot**<br>skill + command | [![OpenCode](https://avatars.githubusercontent.com/opencode-ai?s=80)](https://github.com/opencode-ai/opencode)<br>**OpenCode**<br>skill + `/logstrip` |
| [![Aider](https://avatars.githubusercontent.com/aider-ai?s=80)](https://github.com/Aider-AI/aider)<br>**Aider**<br>CLI pipe | [![Cline](https://avatars.githubusercontent.com/cline?s=80)](https://github.com/cline/cline)<br>**Cline**<br>CLI pipe | [![Gemini CLI](https://avatars.githubusercontent.com/google?s=80)](https://github.com/google-gemini/gemini-cli)<br>**Gemini CLI**<br>CLI pipe | [![Windsurf](https://avatars.githubusercontent.com/windsurf-ai?s=80)](https://windsurf.com)<br>**Windsurf**<br>CLI pipe | [![Roo Code](https://avatars.githubusercontent.com/roo-code?s=80)](https://github.com/RooCodeInc/Roo-Code)<br>**Roo Code**<br>CLI pipe | **Any agent**<br>CLI / `stdin` pipe |

Works with **any** agent that can run a shell command or read a file. One binary, compressed output shared across all of them.

See the [Agent Plugin Installation guide](https://mrwogu.github.io/logstrip/guides/plugins/) for per-agent setup.

<a id="how-it-works"></a>
<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/section-how.svg" alt="How It Works" width="320">

LogStrip detects **705+ log ecosystems** and applies several cuts to every streamed line:

| Cut | What it does |
|:---|:---|
| **Defoliation** | Drops `[INFO]`, `[DEBUG]`, `[TRACE]`, and `[VERBOSE]` lines. |
| **Sanitization** | Replaces UUIDs, timestamps, IPs, AWS keys, and long hashes with compact placeholders. |
| **Context scoring** | Keeps high-signal diagnostics and nearby context while dampening repeated spam (TF-IDF). |
| **Smart dedup** | Folds repeated sanitized lines, including same-shape variants, into `[xN] message` with only differing values listed. |
| **Stack collapse** | Replaces internal `node_modules/` and runtime frames with one marker line. |

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
# .logstrip.yml – Acme Corp CI extension
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

1. **Auto-detection** – When `--config` is not provided, the CLI looks
   for `.logstrip.yml` in the current working directory.
2. **Merging** – Custom sources with a name that already exists in the
   built-in set (e.g. `docker`) have their markers **merged**. New
   names are appended.
3. **Order of application** – Custom ignore patterns are checked
   **before** built-in noise-tag filtering. Custom sanitize rules run
   **after** built-in sanitization. Custom diagnostic patterns add
   +50 to the relevance score. Custom internal-stack patterns are
   checked alongside built-in ones.
4. **Zero new runtime dependencies** – The YAML subset parser is
   built into `logstrip-config.ts` and handles mappings, sequences,
   inline arrays, quoted and unquoted strings, and comments. It does
   not require `js-yaml` or any external package.

Then simply run:

```bash
logstrip ci-output.log -o clean.log            # .logstrip.yml auto-detected
logstrip ci-output.log -o clean.log --config /etc/logstrip/acme.yml  # explicit
```

Full config reference: [CLI docs – Custom configuration](https://mrwogu.github.io/logstrip/reference/cli/#custom-configuration-logstripyml)

## CLI <a id="cli"></a>

LogStrip is primarily a CLI tool. Both `logstrip` and `logstrip` are
registered as bins, so you can call whichever feels natural.

```text
Usage: logstrip [INPUT] [options]

Arguments:
  INPUT                    Path to the raw log. When omitted, reads from stdin.

Options:
  -o, --output <path>      Write the compressed log to <path>. Defaults to stdout.
  -a, --aggressiveness <l> Compression preset: low | medium | high | aggressive (default: high).
      --config <path>      Path to .logstrip.yml config file. Auto-detects from cwd.
  -s, --stats              Print compression statistics to stderr.
  -j, --json               Print LogStripResult as JSON to stdout. Requires --output.
  -h, --help               Show help text and exit.
  -v, --version            Print the CLI version and exit.
```

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
  aggressiveness: 'high',
});

console.log(`saved ${result.savedTokens} tokens (${result.savingsPercent}%)`);
```

`processLogStream(input, output, options)` is also exported for non-file streams
(stdin, network sockets, custom transforms). Pass `configPath` in options for
custom config integration.

## GitHub Action <a id="github-action"></a>

The repository also ships an optional GitHub Action that wraps the same parser.
It is useful when you want a single step in CI and a tidy Step Summary, but the
CLI is the primary distribution channel.

```yaml
- name: Compress logs with LogStrip
  uses: mrwogu/logstrip@v1
  id: logstrip
  with:
    log-path: raw_logs.txt
    aggressiveness: high

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
