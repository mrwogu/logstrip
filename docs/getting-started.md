---
title: Install LogStrip CLI
description: Install the LogStrip log compression CLI in one command. File, pipe, or stdin — trim noisy logs for AI agents in seconds.
---
# Getting Started

LogStrip is primarily distributed as an npm CLI. This page covers the
fastest path from "I have a noisy log" to "I have a compact, LLM-ready
artifact".

## 1. Install the CLI

LogStrip requires Node.js 20 or newer.

```bash
npm install --global logstrip
```

The package registers two binaries: `logstrip` (short) and `logstrip`
(verbose, useful when something else owns the `logstrip` name).

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

The default aggressiveness is `high`. Override with `-a low|medium|high|aggressive`.

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
    aggressiveness: high

- name: Analyze compact logs
  run: your-ai-agent analyze --file "${{ steps.logstrip.outputs.output-path }}"
```

## Verify locally

```bash
npm install
npm run typecheck
npm run test:coverage
npm run build
node dist/cli/index.js --help
```

The parser is stream-based, so local verification never requires loading the
full log into memory.
