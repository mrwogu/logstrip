<div align="center">

<img src="https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/banner-800.webp" alt="LogStrip compresses noisy raw logs into compact AI-ready diagnostic context" width="600">

# LogStrip

**Log compressor for AI agents. Keeps the failure, drops the noise, masks the secrets. No model, no network, same output every time.**

_A zero-dependency Node.js CLI that cuts CI, server, scanner and container logs down to the lines an LLM needs. Ships with a TypeScript library, a GitHub Action and plugins for Claude Code, Codex, Cursor, Copilot, OpenCode and Factory Droid._

[![CI](https://github.com/mrwogu/logstrip/actions/workflows/ci.yml/badge.svg)](https://github.com/mrwogu/logstrip/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/logstrip?color=white)](https://www.npmjs.com/package/logstrip)
[![GitHub Action](https://img.shields.io/badge/marketplace-LogStrip-blue?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/logstrip)
[![Coverage](https://codecov.io/gh/mrwogu/logstrip/branch/main/graph/badge.svg)](https://codecov.io/gh/mrwogu/logstrip)
[![License: MIT](https://img.shields.io/badge/license-MIT-white.svg)](https://opensource.org/licenses/MIT)

![token savings on test fixtures](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-savings.svg)![705+ ecosystems](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-ecosystems.svg)![0 runtime deps](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-deps.svg)![100% coverage](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-coverage.svg)![test fixtures](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-fixtures.svg)![810+ tests](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/tags/stat-tests.svg)

[At a glance](#at-a-glance) ·
[Install](#install) ·
[Savings](#savings-measured) ·
[Coverage](#what-it-covers) ·
[Quality](#quality-and-safety) ·
[Limitations](#genuine-limitations) ·
[Agents](#works-with-every-agent) ·
[vs Alternatives](#vs-alternatives) ·
[How It Works](#how-it-works) ·
[CLI](#cli) ·
[Library](#library) ·
[Docs](https://mrwogu.github.io/logstrip/)

</div>

Your agent reads a failing CI log. Most of it is boot messages, health checks, passing tests, download progress and the same stack trace printed again. The agent pays for every line and still has to find the one `[ERROR]` that matters.

LogStrip reads the log once, line by line, and keeps what explains the failure: errors and warnings, the first occurrence of each event with a count, a bit of context, your stack frames. Everything else is dropped or folded, and it says what it removed. Ids, timestamps and credentials are masked on the way out.

```text
# raw.log (4 lines)
[INFO] boot ok
[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed
[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed
    at lib (/repo/node_modules/pkg/index.js:1:1)

# logstrip raw.log (2 lines)
[x2] [ERROR] request [ID] failed
[... hidden internal library frames ...]
```

## At a glance

For people who compare token optimizers. The row below is written in the shape of the comparison tables out there, so it can be copied as it is.

| | LogStrip |
| :--- | :--- |
| **What it optimizes** | Logs that reach the model: files the agent reads, output you paste, CI job output, command output you pipe, JSON test and scanner reports |
| **Mechanism** | Line scoring + duplicate folding + stack frame collapse + secret and id masking + optional token budget. Rules, not a model. |
| **Claimed savings** | 51.3% fewer tokens over the 51 log fixtures in this repo (median 42.0% per fixture, range 16.7% to 87.2%) |
| **How the claim is backed** | Every fixture and its snapshot is committed. `npm run bench` reruns the table. Token count is LogStrip's own estimate (words x 1.3), not a model tokenizer. No whole-session A/B yet, see [limitations](#genuine-limitations). |
| **Coverage** | Focused: logs only. Prose, code and config pass through untouched. |
| **Setup** | `npm i -g logstrip` or `npx -y logstrip`. Node.js 22+. Zero runtime dependencies. No config file, no account, no model. |
| **Agent integration** | Plugins with hooks for Claude Code, Codex, Cursor, GitHub Copilot and Factory Droid. Skill and command for OpenCode. Any other agent: pipe. |
| **Quality / safety** | Whole lines only, never cut mid-line. Repeats keep their count. Order is kept. Same input, same output, pinned by snapshot tests. Secrets masked in every mode. |
| **Network** | None for compression. A once-a-day npm version check in an interactive terminal, off with `LOGSTRIP_NO_UPDATE_CHECK=1`. |
| **License** | MIT |
| **Best for** | Developers who feed CI, server, container and scanner logs to a coding agent and want a deterministic tool with numbers they can rerun. |

## Install

Requires Node.js 22 or newer.

```bash
npm install --global logstrip
```

Or run it once without installing:

```bash
npx -y logstrip raw.log -o clean.log --stats
```

Quick start:

```bash
# File in, file out
logstrip raw.log -o clean.log

# Unix pipe (stdin to stdout)
cat raw.log | logstrip > clean.log

# Content to stdout, stats to stderr
logstrip raw.log --stats > clean.log

# Hard cap for a small context window
kubectl logs deploy/checkout --since=1h | logstrip --max-tokens 4000
```

## Savings, measured

<!-- bench:readme:start -->
Measured on the 51 test fixtures in the repository, with LogStrip's own token estimate (words times 1.3): **51.3%** fewer tokens overall (42,705 to 20,805). Per fixture the median is 42.0%, the lowest 16.7% and the highest 87.2%. These are small logs that we wrote, so run `logstrip --stats` on yours.

10 of the 25 single-tool fixtures, best first: the 6 best, the 2 nearest the median and the 2 weakest.

| Fixture | Lines in / out | Input tokens | Output tokens | Savings |
| :--- | ---: | ---: | ---: | ---: |
| `apache-httpd-noisy` | 30 / 4 | 485 | 62 | 87.2% |
| `docker-build` | 26 / 4 | 309 | 64 | 79.3% |
| `jest-noisy` | 47 / 8 | 284 | 63 | 77.8% |
| `maven-downloads-failure` | 13 / 3 | 124 | 32 | 74.2% |
| `java-spring-boot-realistic` | 25 / 10 | 305 | 95 | 68.8% |
| `vitest-failure` | 43 / 14 | 257 | 91 | 64.6% |
| `node-crash-realistic` | 24 / 13 | 181 | 101 | 44.2% |
| `mocha-spec-failure` | 45 / 24 | 236 | 136 | 42.4% |
| `server-json` | 11 / 7 | 43 | 34 | 20.9% |
| `kubernetes-crashloop` | 18 / 15 | 150 | 125 | 16.7% |
<!-- bench:readme:end -->

Every row, both groups and the method: [Benchmarks](https://mrwogu.github.io/logstrip/benchmarks/).

How to read this:

- **The number is reproducible.** The fixtures are in [`tests/fixtures/`](tests/fixtures/), each with a committed snapshot of the output. `npm run build && npm run bench` prints the same table on your machine. The docs, the badges and this README are generated from one run, CI fails when they drift.
- **It is an estimate.** Tokens are whitespace words times 1.3, the same number `--stats` prints. Real tokenizers count paths and hashes higher, so on noisy logs the real saving is usually a bit larger than shown. We did not want to pick a tokenizer and call it the truth.
- **It depends on the log.** Chatter compresses most. A short log where almost every line is already an error compresses least, and that is correct: LogStrip keeps what carries a diagnosis.
- **These are small logs that we wrote.** Not production traffic. Run `logstrip --stats` on one of yours before you trust any number here.

## What it covers

Token waste comes from many places. LogStrip handles one of them well and does not pretend to handle the rest.

| Source of tokens | Covered | How |
| :--- | :---: | :--- |
| Log file the agent opens (`.log`, `.out`, `.err`, `.trace`, `.txt`) | yes | PreToolUse hook compresses it and redirects the read to the `.logstrip.log` copy. Raw bytes never enter the context. |
| Log output pasted into the chat | yes | UserPromptSubmit hook spots log-like pastes and tells the agent to run `logstrip` first |
| CI job output | yes | CLI in a step, or the GitHub Action |
| Command output you pipe (`kubectl logs`, `docker logs`, `pytest`, `npm test`) | yes | stdin to stdout, bounded memory |
| JSON reports from test runners and scanners (Jest, Trivy, Snyk) | yes | Semantic compression: repeated entries grouped, empty fields pruned, the result stays valid JSON |
| Source files, search results, MCP tool schemas, conversation history | no | Out of scope. Text that is not a log passes through with only secrets masked. |

## Quality and safety

What a log needs that prose does not, and how LogStrip handles it:

- **Lines stay whole.** A line is kept, folded into `[xN]`, or replaced by a marker that says what is missing. It is never cut in the middle, so a path or an error message never loses its end.
- **Repeats keep their count.** `[x412] [ERROR] charge failed amount=[99.99 | 49.50 | 12.00]` tells the agent it happened 412 times and which values differed. A model-based compressor removes the repeats as predictable and loses the count.
- **Order is the story.** Output follows the input order, also under `--max-tokens`. A folded group sits where its first line was.
- **Your frames stay.** Application stack frames are kept, `node_modules`, JDK and runtime frames collapse into one `[... hidden internal library frames ...]` line.
- **Same input, same output.** No model, no randomness. Snapshot tests pin the output of every fixture, so a change in behaviour shows up as a diff in review.
- **Secrets are masked in every mode.** Tokens, JWTs, connection string passwords, `Authorization:` headers, PEM blocks and high-entropy strings become `[REDACTED]`. This also runs when a file is passed through untouched. It is not a secret scanner, see [Security](https://mrwogu.github.io/logstrip/guides/security/).
- **Not a log? Not touched.** The first 100 non-blank lines are classified. Prose, markdown, source and config are copied through unchanged (secrets still masked). `--force` compresses anyway.
- **The raw file is never modified.** Output goes to stdout or to `-o`, the compressed copy sits next to the original.

## Genuine limitations

Things I would want to know before I install it.

- **The savings number is an estimate on our own fixtures.** Words times 1.3, on 51 small logs we wrote. There is no whole-session cost measurement yet. If you run one, open an issue, I will link it.
- **Logs only.** It does nothing for the code your agent reads, the search results it gets or the tool schemas it loads. Other tools cover that, LogStrip is meant to sit next to them.
- **Failure-dense logs barely shrink.** `kubernetes-crashloop` saves 16.7% because almost every line is a warning or a panic. That is by design, but do not expect 80% on every log.
- **Identifiers are masked by default.** UUIDs, hashes, IPs and the line numbers inside stack frames become placeholders so repeats can fold. To follow one request across lines you need `--preserve-id-suffix N`, and the exact line numbers are only in the raw file.
- **The hooks see what the agent reads and what you paste.** Output of commands the agent runs itself (`Bash` tool) is not intercepted. The plugin skill tells the agent to pipe through `logstrip`, but that depends on the agent following it.
- **Needs Node.js 22+.** There is no static binary. `npx -y logstrip` works without an install, but the first run downloads the package.
- **Heuristics can be wrong.** A line that looks like noise but carries the diagnosis can be dropped. Aggressiveness presets, `--include`, `--severity` and `.logstrip.yml` are there for that case. If you hit one, a fixture in an issue is the fastest way to get it fixed.

## Works with every agent

The workflow is the same everywhere: run `logstrip`, read the `.logstrip.log`, report the savings from `--stats`. The plugin bundles in [`plugins/logstrip/`](plugins/logstrip/) teach the agent to do it on its own.

| | | | | | |
|:---:|:---:|:---:|:---:|:---:|:---:|
| [![Claude Code](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-claudecode-avatar.webp)](https://claude.ai/product/claude-code)<br>**Claude Code**<br>hooks + agents + skill | [![Codex](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-codex-avatar.webp)](https://github.com/openai/codex)<br>**Codex CLI**<br>hooks + skill + AGENTS.md | [![Factory Droid](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-droid.png)](https://factory.ai)<br>**Factory Droid**<br>droids + skill + command | [![Cursor](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-cursor-avatar.webp)](https://cursor.com)<br>**Cursor**<br>rules + hooks | [![Copilot](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-githubcopilot-avatar.webp)](https://github.com/features/copilot)<br>**GitHub Copilot**<br>marketplace plugin | [![OpenCode](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-opencode-avatar.webp)](https://github.com/opencode-ai/opencode)<br>**OpenCode**<br>skill + `/logstrip` command |
| [![Aider](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-aider.svg)](https://github.com/Aider-AI/aider)<br>**Aider**<br>CLI pipe | [![Cline](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-cline-avatar.webp)](https://github.com/cline/cline)<br>**Cline**<br>CLI pipe | [![Gemini CLI](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-gemini-cli-avatar.webp)](https://github.com/google-gemini/gemini-cli)<br>**Gemini CLI**<br>CLI pipe | [![Windsurf](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-windsurf-avatar.webp)](https://windsurf.com)<br>**Windsurf**<br>CLI pipe | [![Roo Code](https://raw.githubusercontent.com/mrwogu/logstrip/main/assets/logo-roocode-avatar.webp)](https://github.com/RooCodeInc/Roo-Code)<br>**Roo Code**<br>CLI pipe | **Any agent**<br>CLI / `stdin` pipe |

### What the hooks do

1. **PreToolUse, auto-compress on read.** When the agent is about to read a `.log`, `.out`, `.txt`, `.trace` or `.err` file, the hook runs `logstrip <file> -o <file>.logstrip.log`, denies the raw read and points the agent at the compressed copy. Files that are already compressed, and files that are not logs (the classifier says text), are left alone.
2. **UserPromptSubmit, pasted logs.** When a paste looks like a log (timestamps, levels, stack traces, CI markers, two or more signals across five or more lines), the hook adds context telling the agent to write it to a temp file and run `logstrip` before reading it line by line.
3. **Skills, commands, rules.** `/logstrip` skill (Claude, Codex, Droid, OpenCode), `/logstrip` command (Droid, OpenCode), Cursor rules on `**/*.log` and on pastes, Copilot instructions and prompt, `AGENTS.md` for Codex and OpenCode. Claude Code and Droid also get two agents: a reviewer for this repo's standards and a fixture author.

Per-agent setup, manifests and the bundle contents: [Agent Plugins](https://mrwogu.github.io/logstrip/guides/plugins/).

### Copilot marketplace plugin

VS Code, add the marketplace to your settings:

```json
{
  "chat.plugins.enabled": true,
  "chat.plugins.marketplaces": ["mrwogu/logstrip"]
}
```

Copilot CLI:

```bash
gh copilot plugin install mrwogu/logstrip:plugins/logstrip
```

## vs Alternatives

Compared on what can be said for a whole category, not on numbers. I have not benchmarked other tools, and "Depends" says why the answer varies.

<!-- compare:readme:start -->
| | LogStrip | `tail` / `grep` | Model-based compressors | Shippers and platforms |
| :--- | :--- | :--- | :--- | :--- |
| **Needs a model** | No | No | Yes | No. Some products add model features. |
| **Needs network** | No for compression. See the note below. | No | Depends: a local model needs none, a hosted API does | Depends: hosted needs it, self-hosted needs your own network |
| **Cost per run** | CPU time. No fee, MIT licensed. | None | Compute or API calls, plus the tokens you still send | Depends on the plan, often priced on ingest |
| **Same input, same output** | Yes, pinned by snapshot tests | Yes | Depends: model version, hardware and settings can change it | Yes for a stored query |
| **Lines stay whole** | Yes: kept, folded or hidden behind a marker | Yes | No guarantee: tokens are removed inside lines | Yes: events come back as stored |
| **Stack frames** | Your frames kept, internal library frames hidden | Depends on the pattern: `grep ERROR` drops the frames below the error | No rule keeps a frame whole | Depends: multi-line traces need parsing at ingest |
| **Identifiers and line numbers** | Masked by rule. `--preserve-id-suffix` keeps an id tail. | Exact | Depends: no rule keeps them | Exact |
| **Repeats** | Folded into `[xN]` with the values that differed | Only adjacent identical lines fold, with `uniq -c` | Removed as predictable, no count | Yes, as an aggregation query |
| **Secrets** | Masked in every mode. Not a secret scanner, see [Security](https://mrwogu.github.io/logstrip/guides/security/). | Left in | Not a design goal | Depends: scrubbing rules you configure |
| **Streams with bounded memory** | Yes, line by line | Yes | Depends: bounded by the compressor model's context window or by chunking | Yes |
<!-- compare:readme:end -->

Network note: compression never uses the network. In an interactive terminal the CLI checks npm once a day for a newer version. It does not run when stderr is redirected, as in CI, and `LOGSTRIP_NO_UPDATE_CHECK=1` turns it off. The full table with the rows left out here: [Compare](https://mrwogu.github.io/logstrip/compare/). Why logs are not prose and why there is no model inside: [Why LogStrip](https://mrwogu.github.io/logstrip/why-logstrip/).

## How it works

Five stages, one pass, bounded memory. LogStrip detects **705+ log ecosystems** in a single pass (Aho-Corasick) and lists them in the output, so the agent knows what it is reading.

| Stage | What it does |
|:---|:---|
| **classify** | Samples the first 100 non-blank lines. Prose, markdown, source and config pass through with secrets masked. Logs continue. |
| **sanitize** | Masks tokens, keys, passwords, JWTs, PEM blocks. Replaces UUIDs, timestamps, IPs, emails and long hashes with `[ID]`, `[TIME]`, `[IP]`, `[EMAIL]`, `[HASH]`. Groups HTTP status codes (`503` becomes `[5xx]`). Runs before dedup so identical events fold. |
| **score** | Rates each line by level, error keywords (in 8+ languages plus CJK), stack frames, scanner findings, container failures. Drops `[INFO]`, `[DEBUG]`, `[TRACE]`, progress bars, download lines and passing tests. Keeps context around a failure, sized to how dense the errors are. Prunes cascade restatements (`aborting due to previous errors`). |
| **dedupe** | Folds repeats into `[xN]` with the values that differed, also lines that differ only in a counter. Collapses internal library frames into one marker. Replaces a block that repeats earlier output with `[... N lines repeated from above ...]`. Folds repeated stack windows that differ only in addresses. |
| **budget** | With `--max-tokens N`, keeps the highest scoring lines that fit, in their original order. |

Cuts marked auto in the CLI help are on by default in `auto` mode, each has a `--no-*` opt-out. Step by step with examples: [Compression Flow](https://mrwogu.github.io/logstrip/guides/compression-flow/).

```text
[INFO] boot ok                                           <- dropped (noise level)
[ERROR] request 123e4567-...-426614174000 failed          <- kept + sanitized
[ERROR] request 987e6543-...-526614174111 failed          <- kept + sanitized, folded
[ERROR] charge failed id=018f23ab-... amount=99.99        <- kept + sanitized, group
[ERROR] charge failed id=018f23ab-... amount=49.50        <- kept + sanitized, group
[ERROR] charge failed id=018f23ab-... amount=12.00        <- kept + sanitized, group
    at lib (/repo/node_modules/pkg/index.js:1:1)          <- internal frame, marker
```

becomes:

```text
[x2] [ERROR] request [ID] failed
[x3] [ERROR] charge failed id=[ID] amount=[99.99 | 49.50 | 12.00]
[... hidden internal library frames ...]
```

All detected sources: [Supported Sources](https://mrwogu.github.io/logstrip/reference/sources/).

### Custom configuration (`.logstrip.yml`)

Internal tools have their own markers. A `.logstrip.yml` in the working directory (or `--config path`) adds sources, diagnostic patterns, ignore rules, sanitize rules and internal stack patterns on top of the built-in set. The YAML subset parser is built in, no new dependency.

```yaml
# .logstrip.yml
sources:
  - name: acme-ci
    markers: [acme-ci-runner, "[ACME-CI]"]

diagnosticPatterns:
  - "ACME_BUILD_FAILED"

ignorePatterns:
  - "\\bacme-ci heartbeat\\b"

sanitizePatterns:
  - pattern: "ACME-EMP-\\d{6}"
    replacement: "[ACME-EMP]"

internalStackPatterns:
  - "/opt/acme/ci-runner/"
```

Custom ignore patterns run before the built-in noise filter, custom sanitize rules after the built-in ones, custom diagnostic patterns add to the line score. Full reference: [CLI docs, custom configuration](https://mrwogu.github.io/logstrip/reference/cli/#custom-configuration-logstripyml).

## CLI

`logstrip` is the primary entry point. Missing `INPUT` means stdin, missing `--output` means stdout, `--stats` always goes to stderr, `--json` always to stdout.

```text
Usage: logstrip [INPUT] [options]
       logstrip hook

Stream-based log compression that trims noisy server logs, build
pipelines, vulnerability scanners, and container workloads down to the
diagnostic context an LLM actually needs.

Arguments:
  INPUT                    Path to the raw log. When omitted, reads from stdin.
                           Input that is not a log (prose, markdown, source code,
                           configuration) is copied through unchanged, with
                           credentials masked, instead of being compressed.

Subcommands:
  hook                     Run as an AI assistant plugin hook. Reads a JSON event
                           from stdin (PreToolUse or UserPromptSubmit) and emits
                           the matching hookSpecificOutput JSON to stdout. Used
                           by the bundled Droid, Claude, Codex, Copilot, and
                           Cursor plugin manifests.

Options:
  -o, --output <path>      Write the compressed log to <path>. Defaults to stdout.
  -a, --aggressiveness <l> Compression preset: low | medium | high | aggressive | auto.
                           Default: auto.
  -s, --stats              Print compression statistics to stderr.
  -j, --json               Print LogStripResult JSON to stdout. Requires --output.
  -m, --multiline <mode>   Multiline handling: auto | python | node | java | go | rust | off.
                           Default: off.
      --severity <level>   Minimum severity: fatal | error | warn | info | debug | trace.
      --include <regex>    Keep only lines matching this regex.
      --exclude <regex>    Drop lines matching this regex.
      --sample <N>         Limit output to first N kept lines.
      --max-tokens <N>     Trim output to at most N tokens, keeping the
                           highest-scoring lines (LLM context-budget mode).
      --dedupe-window <N>  Collapse non-adjacent duplicate lines seen within
                           the last N distinct lines. Default: 1 (adjacent only).
      --format-sample <N>  Majority-vote format detection window over the first
                           N non-blank lines. Default: 50.
      --collapse-blocks <N> Collapse consecutive repeats of a block of up to N
                           lines into one copy plus a [block xM] marker.
      --no-collapse-repeated-blocks Disable replacing a block of lines that
                           repeats earlier output (e.g. the same stack trace
                           printed again) with a [... N lines repeated from
                           above ...] marker.
      --no-collapse-stacks Disable auto-collapsing of repeated stack-trace
                           windows that differ only in addresses/offsets.
      --no-root-cause      Disable auto-pruning of downstream cascade
                           restatements (e.g. "aborting due to previous errors").
      --no-multilingual    Disable auto-detection of non-English error/failure
                           keywords (e.g. "erreur", "Fehler", "错误").
      --no-adaptive-context Disable auto-mode adaptive context windows that
                           widen around isolated errors and tighten around
                           clustered ones.
      --max-stack-frames <N> Keep at most N consecutive application stack
                           frames per trace; the rest collapse into a
                           [... K more application stack frames ...] marker.
                           0 keeps every frame. Default: 10.
      --no-template-mining Disable folding of near-identical lines that
                           differ only in a number after a generic word
                           label (e.g. "Retrying job 17" / "Retrying job 18").
      --no-json-report     Disable auto-detection of structured JSON documents
                           (test reports, scanner exports). Detected documents
                           are compressed semantically - repeated entries
                           grouped, duplicate fields referenced, empty fields
                           pruned - and stay valid JSON.
      --force              Compress even when the input does not look like a log.
                           Disables the text passthrough that copies prose,
                           markdown, code and config files through unchanged.
      --preserve-id-suffix <N> Keep the last N chars of redacted UUIDs/hashes
                           (e.g. [ID:74000]) instead of fully masking. 0-16,
                           0 masks fully. Default: 0.
      --max-line-length <n> Truncate lines longer than n chars. Default: 100000.
      --timeout <s>        Stop processing after s seconds.
      --progress           Show progress bar (file input only, requires --output).
      --config <path>      Path to .logstrip.yml config file. Auto-detects from cwd.
      --telemetry          Show cumulative telemetry summary on stderr and exit.
  -h, --help               Show this help text and exit.
  -v, --version            Print the CLI version and exit.

Examples:
  logstrip raw.log -o clean.log
  cat raw.log | logstrip > clean.log
  logstrip raw.log --stats > clean.log
  logstrip raw.log -o clean.log --json
  logstrip traceback.log -m python -o clean.log
  logstrip build.log --exclude 'Downloading|Extracting' -o clean.log
  logstrip output.txt --force -o clean.log
  logstrip huge.log --progress --timeout 30 -o clean.log
```

In `auto` mode the boosters (repeated stack collapse, root cause pruning, multilingual keywords, adaptive context, repeated block references, format voting, template mining, JSON reports) are on. The `--no-*` flags turn one off when you want the plain pass.

### Recipes

```bash
logstrip raw.log -o clean.log                                  # file to file
cat raw.log | logstrip > clean.log                             # pipe
logstrip raw.log --stats > clean.log                           # stats on stderr
logstrip raw.log -o clean.log --json                           # LogStripResult JSON on stdout
logstrip raw.log -o clean.log --config .logstrip.yml           # internal tools
logstrip traceback.log -m python -o clean.log                  # join Python tracebacks
logstrip raw.log --severity error -o clean.log                 # errors and fatals only
logstrip build.log --exclude 'Downloading|Extracting' -o clean.log
logstrip huge.log --sample 50 -o preview.log                   # first 50 kept lines
logstrip raw.log --timeout 30 -o clean.log                     # CI time budget
logstrip notes.txt --force -o clean.log                        # compress a non-log anyway
```

PowerShell:

```powershell
Get-Content raw.log | logstrip > clean.log
logstrip raw.log --stats -o clean.log; Get-Content clean.log -Tail 20
```

### Exit codes

| Code | Meaning |
|:--:|:---|
| `0` | success |
| `1` | runtime failure (I/O error, stream error) |
| `2` | usage error (bad flag, bad aggressiveness, `--json` without `--output`, stdin is a TTY) |

## Library

The same parser, for your own Node tooling.

```ts
import { processLogFile, type LogStripResult } from 'logstrip';

const result: LogStripResult = await processLogFile('raw.log', 'clean.log', {
  aggressiveness: 'auto',
  multiline: 'python',
  severity: 'error',
});

console.log(`saved ${result.savedTokens} tokens (${result.savingsPercent}%)`);
```

`processLogStream(input, output, options)` takes any readable and writable stream. `createLogStripTransform()` gives a Transform for a pipeline. `processLogStreamWithTimeout` sets `result.timedOut` when the deadline hits. Options group into filtering and limits (`include`, `exclude`, `sampleSize`, `maxTokens`), dedupe and folding (`dedupe`, `dedupeWindow`, `collapseBlocks`), context and sanitization (`contextBefore`, `contextAfter`, `preserveIdSuffix`), the auto boosters (`collapseRepeatedStacks`, `rootCause`, `multilingual`, `adaptiveContext`), detection and output (`formatDetectionSampleSize`, `outputFormat`, `textPassthrough`), custom config (`config`, `configPath`) and hooks (`signal`, `onDecision`, `tokenEstimator`). Full table: [Core API](https://mrwogu.github.io/logstrip/reference/core/).

## GitHub Action

Optional wrapper around the same parser, for a one-step workflow with a Step Summary. In `run:` steps the CLI is preferred. This repo uses the action in its own [CI](https://github.com/mrwogu/logstrip/actions/workflows/ci.yml).

```yaml
- name: Compress logs with LogStrip
  uses: mrwogu/logstrip@v2
  id: logstrip
  with:
    log-path: raw_logs.txt
    aggressiveness: auto

- name: Send compact logs to your AI agent
  run: your-agent analyze --file "${{ steps.logstrip.outputs.output-path }}"
```

Inputs, outputs and the Step Summary contract: [GitHub Action](https://mrwogu.github.io/logstrip/reference/action/).

## Documentation

| Page | What is there |
|:---|:---|
| [Getting Started](https://mrwogu.github.io/logstrip/getting-started/) | Install and trim the first log. |
| [Benchmarks](https://mrwogu.github.io/logstrip/benchmarks/) | Every fixture, the method, how to reproduce. |
| [Why LogStrip](https://mrwogu.github.io/logstrip/why-logstrip/) | What it keeps, drops and rewrites, and when not to use it. |
| [Compare](https://mrwogu.github.io/logstrip/compare/) | Against grep, model-based compressors and log platforms. |
| [CLI Reference](https://mrwogu.github.io/logstrip/reference/cli/) | Flags, exit codes, `.logstrip.yml`. |
| [Core API](https://mrwogu.github.io/logstrip/reference/core/) | The TypeScript surface. |
| [Agent Plugins](https://mrwogu.github.io/logstrip/guides/plugins/) | Setup per agent, hooks, bundle contents. |
| [Security](https://mrwogu.github.io/logstrip/guides/security/) | What is masked and what is not. |
| [Supported Sources](https://mrwogu.github.io/logstrip/reference/sources/) | All 705+ detected ecosystems. |
| [llms.txt](https://mrwogu.github.io/logstrip/llms.txt) | The docs as plain Markdown, for agents. |

## Local development

```bash
npm install
npm run typecheck
npm run test:coverage    # 100/100/100/100 gate
npm run build
npm run bench            # the savings table, from the built parser
```

Docs site (Astro Starlight in `apps/docs`, Markdown in `docs/`):

```bash
npm run docs:install
npm run docs:serve       # http://localhost:4321/logstrip/
npm run docs:build       # static site in site/
```

<div align="center">
  <sub>Made by <a href="https://github.com/mrwogu">Wojciech Guziak</a>. MIT.</sub>
</div>
