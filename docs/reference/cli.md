# CLI Reference

The CLI is the primary distribution channel for ContextBonsai. It is published
to npm as `context-bonsai` and exposes two binaries:

| Binary | Purpose |
| :--- | :--- |
| `bonsai` | Short alias - preferred when the name is free. |
| `context-bonsai` | Verbose alias - useful when `bonsai` is already taken. |

Both binaries point at the same compiled entry: `dist/cli/index.js`.

## Synopsis

```text
bonsai [INPUT] [options]
```

### Arguments

| Argument | Description |
| :--- | :--- |
| `INPUT` | Path to a raw log file. When omitted, the CLI reads from `stdin`. |

### Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `-o`, `--output <path>` | Write the compressed log to `<path>`. When omitted, the compressed log is written to `stdout`. | _(stdout)_ |
| `-a`, `--aggressiveness <level>` | Compression preset: `low`, `medium`, `high`, `aggressive`. | `high` |
| `-s`, `--stats` | Print compression statistics to `stderr` after the log has been processed. | off |
| `-j`, `--json` | Print the `BonsaiResult` as JSON to `stdout`. Requires `--output` so the compressed log does not collide with the report. | off |
| `-h`, `--help` | Print the help text and exit. | - |
| `-v`, `--version` | Print the CLI version and exit. | - |

## I/O contract

- The compressed log goes to `--output` when set, otherwise to `stdout`.
- Stats (`--stats`) always go to `stderr` so they never collide with the
  compressed log on `stdout`.
- The JSON report (`--json`) always goes to `stdout`. To prevent
  contamination, `--json` requires `--output`.
- When `INPUT` is omitted and `stdin` is a terminal (TTY), the CLI exits with
  code `2` rather than waiting forever for input.

## Exit codes

| Code | Meaning |
| :--: | :--- |
| `0` | Success. |
| `1` | Runtime failure (file not found, stream error, internal exception). |
| `2` | Usage error (unknown flag, unsupported aggressiveness, `--json` without `--output`, stdin is a TTY). |

## Recipes

### File in, file out

```bash
bonsai raw.log -o clean.log
```

### Stdin in, stdout out

```bash
cat raw.log | bonsai > clean.log
```

PowerShell:

```powershell
Get-Content raw.log | bonsai > clean.log
```

### Stats alongside content

```bash
bonsai raw.log --stats > clean.log
# compressed log -> clean.log
# stats          -> stderr (visible in the terminal or CI summary)
```

### Machine-readable report

```bash
bonsai raw.log -o clean.log --json
```

`stdout` will contain a `BonsaiResult` object:

```json
{
  "stats": {
    "inputLines": 4128,
    "outputLines": 312,
    "inputWords": 21450,
    "outputWords": 4138,
    "inputBytes": 412800,
    "outputBytes": 31200,
    "droppedLines": 3640,
    "duplicateLines": 87,
    "hiddenInternalStackLines": 89
  },
  "inputTokens": 27885,
  "outputTokens": 5379,
  "savedTokens": 22506,
  "savingsPercent": 80.71,
  "detectedSources": ["webpack", "npm", "kubernetes"],
  "outputPath": "clean.log"
}
```

`detectedSources` is ranked by lightweight source fingerprints gathered during
streaming. It is informational and does not change the compressed log output.

## Aggressiveness and context retention

`--aggressiveness` controls how much context survives around high-signal lines.
The parser uses a hybrid scoring model instead of a single binary filter:

- hard signals (`[ERROR]`, JSON `"level":"error"`, scanner findings, container
  failures, npm/yarn errors, stack frames) are emitted immediately;
- nearby soft lines are kept through a small before/after context window;
- repeated sanitized lines are dampened so spam eventually falls below the keep
  threshold;
- adjacent diagnostic variants with the same stable shape are folded as delta
  summaries, so repeated lines like `amount=99.99`, `amount=49.50`, and
  `amount=12.00` render as `[x3] ... amount=[99.99 | 49.50 | 12.00]`;
- `aggressive` still drops pure warning noise, but preserves warning lines with
  diagnostic keywords such as `failed`, `timeout`, `refused`, `crashed`,
  `killed`, `terminated`, `unauthorized`, and `unavailable`.

For the most predictable AI-agent input, start with the default `high` preset.
Use `aggressive` when the input is very noisy and warnings are mostly low-value.

### Use inside a shell script

```bash
#!/usr/bin/env bash
set -euo pipefail

bonsai raw.log -o clean.log --json | jq '.savingsPercent'
```

## Stats block format

When `--stats` is enabled the CLI writes a fixed-shape block to `stderr`:

```text
ContextBonsai compression report
  input lines     : <int>
  output lines    : <int>
  dropped lines   : <int>
  duplicate lines : <int>
  hidden internal : <int>
  input tokens    : <int>
  output tokens   : <int>
  saved tokens    : <int>
  savings         : <float>%
  output path     : <path>   # only when --output was set
```

This format is stable across patch releases. If you need to parse it from
shell, prefer `--json` instead.

## Embedding in Node

If you'd rather call the CLI from JavaScript without spawning a subprocess,
import the helper directly:

```ts
import { runCli } from 'context-bonsai/cli';

const exitCode = await runCli(['raw.log', '-o', 'clean.log', '--json'], {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  stdinIsTTY: Boolean(process.stdin.isTTY),
});
```

For library-style integration that returns a `BonsaiResult` directly, use
[`processLogFile` / `processLogStream`](core.md) instead.
