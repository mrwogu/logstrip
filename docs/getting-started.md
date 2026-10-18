---
title: Install LogStrip CLI
description: Install the LogStrip log compression CLI in one command. File, pipe, or stdin - trim noisy logs for AI agents in seconds.
---
# Getting Started

**In 30 seconds.** LogStrip is a command-line tool that cuts a noisy log down
to the lines an AI agent needs. It runs offline, needs no model, and gives the
same output for the same input.

```bash
npx -y logstrip raw.log --stats
```

What you get:

- **A shorter log.** Routine `INFO` and `DEBUG` lines, passing tests, progress
  output and repeats are removed. Errors, the first occurrence of each event,
  context and your stack frames stay.
- **A count, not a guess.** Repeats fold into `[x2] line`, and `--stats` prints
  the tokens saved.
- **Safer to paste.** Tokens, passwords, keys and connection strings are masked.
- **Nothing to set up.** No model and no account. Compression needs no network.

Before and after:

```text
# raw.log
[INFO] boot ok
[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed
[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed
    at lib (/repo/node_modules/pkg/index.js:1:1)

# logstrip raw.log
[x2] [ERROR] request [ID] failed
[... hidden internal library frames ...]
```

How much you save depends on how noisy the log is. See
[Benchmarks](benchmarks.md) for measured results, and
[Why LogStrip](why-logstrip.md) for what is kept and what is dropped.

## 1. Install the CLI

LogStrip requires Node.js 22+.

```bash
npm install --global logstrip
```

The package registers the `logstrip` binary.

Don't want a global install? Use `npx`:

```bash
npx -y logstrip raw.log -o clean.log
```

## 2. Trim your first log

Three equally valid ways to feed the parser:

```bash
# File in, file out
logstrip raw.log -o clean.log

# Unix pipe
cat raw.log | logstrip > clean.log

# File in, compressed log to stdout, stats to stderr
logstrip raw.log --stats > clean.log
```

PowerShell:

```powershell
Get-Content raw.log | logstrip > clean.log
logstrip raw.log --stats > clean.log
```

The default aggressiveness is `auto`, which starts at `high` and adapts to the
log while running every detection booster automatically. Override with
`-a low|medium|high|aggressive` for a fixed level.

## 3. Wire it into a script

```bash
#!/usr/bin/env bash
set -euo pipefail

npm test > raw.log 2>&1 || true   # keep the log even on failure
logstrip raw.log -o clean.log --stats
your-ai-agent analyze --file clean.log
```

## 4. Read the stats

When `--stats` is set the CLI prints a compact report to `stderr`:

```text
LogStrip compression report
  input lines     : 4128
  output lines    : 312
  dropped lines   : 3640
  duplicate lines : 87
  hidden internal : 89
  input tokens    : 21450
  output tokens   : 4138
  saved tokens    : 17312
  savings         : 80.71%
  output path     : clean.log
```

Need the same report machine-readable? Use `--json` (requires `--output`):

```bash
logstrip raw.log -o clean.log --json
```

## 5. (Optional) Use it in GitHub Actions

If you do not want a `run:` step calling the CLI, the same engine is exposed
as a thin GitHub Action wrapper. See [GitHub Action](reference/action.md) for
the full contract.

```yaml
- name: Run tests and keep raw logs
  run: npm test > raw_logs.txt 2>&1 || true

- name: Compress logs with LogStrip
  uses: mrwogu/logstrip@v1
  id: logstrip
  with:
    log-path: raw_logs.txt
    aggressiveness: auto

- name: Analyze compact logs
  run: your-ai-agent analyze --file "${{ steps.logstrip.outputs.output-path }}"
```

## Next steps

- [Why LogStrip](why-logstrip.md) - what it keeps, what it drops, when not to use it.
- [Benchmarks](benchmarks.md) - measured savings for every test fixture.
- [CLI Reference](reference/cli.md) - every flag, exit code, JSON schema.
- [Configuration](guides/configuration.md) - custom sources and patterns via `.logstrip.yml`.
- [Agent Plugins](guides/plugins.md) - drop-in instructions for Claude Code, Copilot, Cursor, Codex, Droid, and OpenCode.
- [Examples](examples/index.md) - real-world CI recipes.

Want to hack on LogStrip itself? See [CONTRIBUTING.md](https://github.com/mrwogu/logstrip/blob/main/CONTRIBUTING.md).
