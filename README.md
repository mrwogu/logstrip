<div align="center">

# ContextBonsai

**compress noisy logs before they poison your LLM context**

_A zero-dependency Node.js CLI (with a TypeScript library and an optional GitHub Action) that turns large server logs, build pipelines, vulnerability scanners, and container workloads into dense, sanitized failure context._

[![CI](https://github.com/mrwogu/context-bonsai/actions/workflows/ci.yml/badge.svg)](https://github.com/mrwogu/context-bonsai/actions/workflows/ci.yml)
[![Docs](https://github.com/mrwogu/context-bonsai/actions/workflows/docs.yml/badge.svg)](https://github.com/mrwogu/context-bonsai/actions/workflows/docs.yml)
[![npm version](https://img.shields.io/npm/v/context-bonsai?color=white)](https://www.npmjs.com/package/context-bonsai)
[![Coverage](https://img.shields.io/badge/coverage-100%25-white)](vitest.config.ts)
[![License: MIT](https://img.shields.io/badge/license-MIT-white.svg)](https://opensource.org/licenses/MIT)

[**Quick Start**](#quick-start) · [**CLI**](#cli) · [**Library**](#library) · [**GitHub Action**](#github-action) · [**Agent Plugins**](docs/guides/plugins.md) · [**Documentation**](https://mrwogu.github.io/context-bonsai/)

</div>

---

## The Problem

- Large server logs, build pipelines, and container workloads routinely exceed practical LLM context limits.
- Repeated framework stack frames dilute the useful signal.
- UUIDs, timestamps, session IDs, and hashes waste tokens without helping diagnosis.
- Raw logs cause context poisoning by burying the real failure under noise.

## The Fix

ContextBonsai streams logs line by line, removes low-value entries, sanitizes expensive identifiers, folds repeated failures, and hides internal library stack traces. The result is a compact artifact ready to pass into agents such as Claude, Copilot, or any downstream analyzer.

---

## Quick Start

Requires Node.js 20 or newer.

```bash
npm install --global context-bonsai
bonsai raw.log -o clean.log --stats
```

Or, without installing:

```bash
cat raw.log | npx context-bonsai > clean.log
```

PowerShell:

```powershell
Get-Content raw.log | npx context-bonsai > clean.log
```

---

## CLI

ContextBonsai is primarily a CLI tool. Both `bonsai` and `context-bonsai` are
registered as bins, so you can call whichever feels natural.

```text
Usage: bonsai [INPUT] [options]

Arguments:
  INPUT                    Path to the raw log. When omitted, reads from stdin.

Options:
  -o, --output <path>      Write the compressed log to <path>. Defaults to stdout.
  -a, --aggressiveness <l> Compression preset: low | medium | high | aggressive (default: high).
  -s, --stats              Print compression statistics to stderr.
  -j, --json               Print BonsaiResult as JSON to stdout. Requires --output.
  -h, --help               Show help text and exit.
  -v, --version            Print the CLI version and exit.
```

### Recipes

```bash
# 1. File in, file out
bonsai raw.log -o clean.log

# 2. Pipe stdin to stdout (Unix-style)
cat raw.log | bonsai > clean.log

# 3. File in, stats to stderr while content streams to stdout
bonsai raw.log --stats > clean.log

# 4. Programmatic report - compressed log to file, JSON report to stdout
bonsai raw.log -o clean.log --json

# 5. Mix with other tools - watch the compressed feed while saving it
bonsai raw.log --stats -o clean.log && tail -n 20 clean.log
```

PowerShell equivalents:

```powershell
Get-Content raw.log | bonsai > clean.log
bonsai raw.log --stats -o clean.log; Get-Content clean.log -Tail 20
```

### Exit codes

| Code | Meaning |
| :--: | :------ |
| `0` | success |
| `1` | runtime failure (I/O error, stream error) |
| `2` | usage error (bad flag, unsupported aggressiveness, `--json` without `--output`, stdin is a TTY) |

---

## Library

The compiled package also ships the TypeScript core for embedding directly in
your own Node tooling.

```ts
import { processLogFile, type BonsaiResult } from 'context-bonsai';

const result: BonsaiResult = await processLogFile('raw.log', 'clean.log', {
  aggressiveness: 'high',
});

console.log(`saved ${result.savedTokens} tokens (${result.savingsPercent}%)`);
```

`processLogStream(input, output, options)` is also exported for non-file streams
(stdin, network sockets, custom transforms).

---

## GitHub Action

The repository also ships an optional GitHub Action that wraps the same parser.
It is useful when you want a single step in CI and a tidy Step Summary, but the
CLI is the primary distribution channel.

```yaml
- name: Compress logs with ContextBonsai
  uses: mrwogu/context-bonsai@v1
  id: bonsai
  with:
    log-path: raw_logs.txt
    aggressiveness: high

- name: Send compact logs to your AI agent
  run: your-agent analyze --file "${{ steps.bonsai.outputs.output-path }}"
```

See [docs/reference/action.md](docs/reference/action.md) for inputs, outputs,
and the Step Summary contract.

---

## How It Works

ContextBonsai applies several cuts to every streamed line:

| Cut | What it does |
| :--- | :--- |
| Defoliation | Drops `[INFO]`, `[DEBUG]`, `[TRACE]`, and `[VERBOSE]` lines. |
| Sanitization | Replaces UUIDs, timestamps, IPs, and long hashes with compact placeholders. |
| Context scoring | Keeps high-signal diagnostics and nearby context while dampening repeated spam. |
| Smart deduplication | Folds repeated sanitized lines, including same-shape variants, into `[xN] message` with only differing values listed. |
| Stacktrace truncation | Replaces internal `node_modules/` and runtime frames with one marker line. |

Example:

```text
[INFO] boot ok
[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed
[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed
[ERROR] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33456 amount=99.99
[ERROR] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33457 amount=49.50
[ERROR] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33458 amount=12.00
    at lib (/repo/node_modules/pkg/index.js:1:1)
```

becomes:

```text
[x2] [ERROR] request [ID] failed
[x3] [ERROR] charge failed requestId=[ID] amount=[99.99 | 49.50 | 12.00]
[... hidden internal library frames ...]
```

---

## Local Development

```bash
npm install
npm run typecheck
npm run test:coverage
npm run build
```

Documentation is built with MkDocs:

```bash
python3 -m pip install -r requirements-docs.txt
npm run docs:build
```

---

## Documentation

| Resource | Description |
| :--- | :--- |
| [Getting Started](docs/getting-started.md) | Install the CLI and trim your first log. |
| [CLI Reference](docs/reference/cli.md) | Flags, exit codes, recipes, and stdin/stdout contracts. |
| [Core API](docs/reference/core.md) | TypeScript parser API for library use. |
| [GitHub Action](docs/reference/action.md) | Optional CI wrapper around the CLI core. |
| [Examples](docs/examples/index.md) | CI recipes for common pipelines. |
| [Security](docs/guides/security.md) | Sanitization and safe log handling notes. |

---

<div align="center">
  <sub>Built for engineers who want smaller logs, cheaper prompts, and cleaner AI diagnostics.</sub>
</div>
