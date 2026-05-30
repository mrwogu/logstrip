---
title: CLI and Action Configuration
description: Configure input, output, aggressiveness levels, stats, and JSON reporting for the LogStrip CLI and GitHub Action. Default and custom settings explained.
---
# Configuration

The current release keeps configuration intentionally small. The CLI exposes
the canonical contract; the GitHub Action wrapper maps its inputs onto the same
options.

## Input

| Surface | How it is provided |
| :--- | :--- |
| CLI | First positional argument, or `stdin` when omitted. |
| Action | `log-path` input. |
| Library | `inputPath` argument to `processLogFile`, or a `Readable` stream to `processLogStream`. |

The parser is stream-based end-to-end, so large logs can be handled without
loading the whole file into memory.

## Output

| Surface | How it is provided |
| :--- | :--- |
| CLI | `--output <path>`, or `stdout` when omitted. |
| Action | Written next to the input as `<basename>.logstrip<ext>`. |
| Library | `outputPath` argument to `processLogFile`, or a `Writable` stream to `processLogStream`. |

Default file naming when running the action or omitting `--output`:

| Input | Output |
| :--- | :--- |
| `raw.log` | `raw.logstrip.log` |
| `test-output.txt` | `test-output.logstrip.txt` |
| `raw` | `raw.logstrip.log` |

## Aggressiveness

Accepted values:

| Value | Status |
| :--- | :--- |
| `low` | accepted |
| `medium` | accepted |
| `high` | accepted |
| `aggressive` | accepted |
| `auto` | default |

`auto` is the default. It starts at `high`, adapts the effective level to the
log via a sliding decision window, and runs the detection and compression
boosters (stack-window collapse, root-cause cascade pruning, multilingual
keyword detection, majority-vote format detection, adaptive context windows)
automatically. The fixed
levels (`low`, `medium`, `high`, `aggressive`) give you deterministic, non-adaptive
filtering when you need it.

## Stats and reports

| Surface | How to get stats |
| :--- | :--- |
| CLI | `--stats` (human-readable, stderr) or `--json` (machine-readable, stdout, requires `--output`). |
| Action | Always written as a GitHub Step Summary table. |
| Library | Returned as a `LogStripResult` from `processLogFile` / `processLogStream`. |

## Package scripts

```bash
npm run typecheck
npm run test:coverage
npm run build
npm run docs:build
```

The coverage configuration requires `100%` statements, branches, functions,
and lines across `src/core`, `src/cli`, and `src/action`.
