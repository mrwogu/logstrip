---
title: Compare LogStrip
description: How LogStrip differs from pasting raw logs, tail and grep, model-based prompt compressors such as LLMLingua, and log shippers or observability platforms. Facts per category, no invented numbers.
---
# Compare LogStrip

People get logs in front of a model in a few other ways. This page compares
LogStrip with each, on attributes that we can state for the whole category.
Where a category varies too much to say, the cell says "Depends" and gives the
reason.

We give no figures for other tools. We have not benchmarked them, and a number
copied from a paper about prose prompts would say little about logs. The
LogStrip numbers are on the [Benchmarks](benchmarks.md) page.

The categories:

- **`tail` and `grep`.** Cut the log down by hand with a pattern.
- **Model-based prompt compressors.** LLMLingua and similar tools, which use a
  language model to remove low-information tokens. See
  [Why LogStrip](why-logstrip.md) for how that differs.
- **Log shippers and observability platforms.** Collect, store and query logs
  in a backend. Cloud and self-hosted products both belong here.

The baseline is the raw log. Nothing is removed, so you pay for every token and
every secret stays in. Asking a chat model to summarize the log is another
option. It shares the trade-offs of the model-based column, and it also
rewrites events as prose.

## What it takes to run

| | `tail` / `grep` | Model-based compressors | Shippers and platforms | LogStrip |
| :--- | :--- | :--- | :--- | :--- |
| **Needs a model** | No | Yes | No. Some products add model features. | No |
| **Needs network** | No | Depends: a local model needs none, a hosted API does | Depends: hosted needs it, self-hosted needs your own network | No for compression. See the note below. |
| **Works in CI without setup** | Yes | Depends: needs a model download, a GPU or an API key | Depends: needs an account or an agent | Yes: `npx -y logstrip` on Node.js 22+ |
| **Cost per run** | None | Compute or API calls, plus the tokens you still send | Depends on the plan, often priced on ingest | CPU time. No fee, MIT licensed. |

Network note: compression never uses the network. In an interactive terminal
the CLI checks npm once a day for a newer version. It does not run when stderr
is redirected, as in CI, and `LOGSTRIP_NO_UPDATE_CHECK=1` turns it off. Usage
statistics stay on your machine. See the [CLI reference](reference/cli.md).

## What the output looks like

| | `tail` / `grep` | Model-based compressors | Shippers and platforms | LogStrip |
| :--- | :--- | :--- | :--- | :--- |
| **Same input, same output** | Yes | Depends: model version, hardware and settings can change it | Yes for a stored query | Yes, pinned by snapshot tests |
| **Lines stay whole** | Yes | No guarantee: tokens are removed inside lines | Yes: events come back as stored | Yes: kept, folded or hidden behind a marker |
| **Stack frames** | Depends on the pattern: `grep ERROR` drops the frames below the error | No rule keeps a frame whole | Depends: multi-line traces need parsing at ingest | Your frames kept, internal library frames hidden |
| **Identifiers and line numbers** | Exact | Depends: no rule keeps them | Exact | Masked by rule. `--preserve-id-suffix` keeps an id tail. |
| **Repeats** | Only adjacent identical lines fold, with `uniq -c` | Removed as predictable, no count | Yes, as an aggregation query | Folded into `[xN]` with the values that differed |
| **Secrets** | Left in | Not a design goal | Depends: scrubbing rules you configure | Masked in every mode. Not a secret scanner, see [Security](guides/security.md). |
| **Who decides what matters** | Your pattern | A language model's token scores | Your queries and alerts | Line scoring rules: level, keywords, frames, findings |

For `tail` and `grep`, timestamps and ids defeat `uniq -c` because the lines are
never identical.

## Scale

| | `tail` / `grep` | Model-based compressors | Shippers and platforms | LogStrip |
| :--- | :--- | :--- | :--- | :--- |
| **Streams with bounded memory** | Yes | Depends: bounded by the compressor model's context window or by chunking | Yes | Yes, line by line |
| **Output size** | Whatever matches | A target ratio you choose | Whatever the query returns | Follows the log. A log that is all failure comes back mostly whole. `--max-tokens` sets a hard cap. |

## How to choose

- **You know the exact string you need.** Use `grep`. It is faster than anything
  else and you control it fully.
- **You need to search, retain or alert on logs over time.** Use an
  observability platform. LogStrip does not store or index anything.
- **Your input is prose,** such as documents or long instructions, and you accept
  lossy token pruning. A model-based compressor is built for that. LogStrip
  passes prose through untouched.
- **A person or an agent has to read a failing log now.** Use LogStrip. It is
  built for that case.

They combine. Pull the log from your platform, run it through LogStrip, and send
the result to the model.

## Related

- [Why LogStrip](why-logstrip.md) - what it keeps, what it drops, what it rewrites.
- [Benchmarks](benchmarks.md) - measured savings, with their limits.
- [Getting Started](getting-started.md) - install and run in 30 seconds.
