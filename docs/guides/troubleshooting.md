---
title: Troubleshooting Log Compression
description: Fix empty output, exit codes, missing files, and short stack traces in the LogStrip CLI and GitHub Action. Common errors and solutions.
---
# Troubleshooting

## The compressed log is empty

LogStrip removes low-value lines. If a log only contains `[INFO]`,
`[DEBUG]`, `[TRACE]`, or `[VERBOSE]` entries - or the same levels printed
without brackets, such as `2026-05-16 10:24:31,044 - app - INFO - started` or
`level=info msg="started"` - the compressed output can be empty.

Add at least one error or warning line to verify the pipeline:

```text
[ERROR] smoke test failure
```

## My file came out unchanged

If the output has the same number of lines as the input, `savings` is `0%`
and `--stats` prints `content kind    : text (passed through, secrets masked)`,
LogStrip did not take the input for a log. It reads the first 100 non-blank
lines (up to 256 KiB), and when they look like prose, markdown, source code or
configuration (a README, a YAML file, `notes.txt`) it copies the input through
instead of compressing it, because the line scorer would drop most of such a
file.

The text is passed through unchanged except for credentials: tokens,
passwords, connection-string passwords, `Authorization` headers, cloud keys
and PEM private key blocks are masked even in text that is copied as it is.

The decision is made from the first sampled lines only. If the input is a log
that begins with a long stretch of configuration-like or prose-like output, or
you want a text file compressed anyway, use `--force`:

```bash
logstrip output.txt --force -o clean.log
```

From the library, pass `textPassthrough: false`. The `contentKind` field of
`--json` output (`"text"` or `"log"`) tells you which way a run went.

## Parts of my file were replaced with `[REDACTED]`

Text that LogStrip copies through still has its credentials masked, with the
same rules the compressor applies to logs. Those rules favour safety over
fidelity, so besides real secrets they also mask look-alikes such as an
example like `password=hunter2`, or a sentence that mentions an
`Authorization:` header (the rest of that line is masked). Any key that ends
in `password`, `secret`, `token`, `api_key`, `auth` and similar names counts,
so `DB_PASSWORD=...`, `apiKey: ...` and `"client_secret": "..."` are masked
too, and so is an assignment in source code such as `const accessToken = load()`
or `password = readSecret()`. Values that carry no secret stay as they are: an
empty value, `null`, `true`, `false`, a number under four digits, a type
(`previousToken: string`, `password: Optional[str]`), a plain environment read
(`token: process.env.NPM_TOKEN`, `os.environ["DB_PASSWORD"]`, but not
`os.getenv("DB", "hunter2")`), a GitHub permission (`id-token: write`) and a
plain reference such as
`token: ${{ secrets.NPM_TOKEN }}` or `DB_PASSWORD=${DB_PASSWORD}`. A reference
with a default, a command or anything after it (`${NAME:-x}`, `$(cat file)`,
`$HOME/x`, or a closing bracket or backtick right behind it) is masked. The original file is never modified; only
the copy is. Read the file directly when you need the exact text.

## The CLI exits with code `2`

Exit code `2` is a usage error. Common causes:

- Unknown flag - run `logstrip --help` to see the supported options.
- Unsupported `--aggressiveness` value - use one of `low`, `medium`, `high`, `aggressive`, `auto`.
- `--json` without `--output` - JSON would collide with the compressed log on stdout.
- No `INPUT` argument and `stdin` is a terminal - either pass a file path or pipe a log.

## The CLI exits with code `1`

Exit code `1` is a runtime failure (missing file, permission error, stream
error). The error message goes to `stderr`. Confirm the input path exists and
that the user running the CLI can read it / write the output path.

## The action cannot find the log file

Make sure the previous step writes the file in the workspace and that
`log-path` matches the relative path:

```yaml
- run: npm test > raw_logs.txt 2>&1 || true

- uses: mrwogu/logstrip@v1
  with:
    log-path: raw_logs.txt
```

## The workflow stops before LogStrip runs

If the test step exits non-zero, GitHub Actions stops by default. Capture the
failure and continue:

```yaml
- name: Run tests and keep raw logs
  run: npm test > raw_logs.txt 2>&1 || true
```

You can fail the job later after the AI analysis step.

## Stack traces are too short

The current release hides internal `node_modules/`, `node:internal`, and
system library frames. Application frames such as `/src/app.ts:10:5` are
preserved.

If a library frame is needed for a specific investigation, inspect the raw log
artifact with short retention, or pipe through `--aggressiveness low` after
planned aggressiveness tuning lands.

## I want both the compressed log and the stats

Use `--stats`:

```bash
logstrip raw.log -o clean.log --stats
```

`clean.log` receives the compressed content; `stderr` shows the stats block.
Or use `--json` for a machine-readable report on `stdout`.
