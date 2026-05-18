# Troubleshooting

## The compressed log is empty

ContextBonsai removes low-value lines. If a log only contains `[INFO]`,
`[DEBUG]`, `[TRACE]`, or `[VERBOSE]` entries, the compressed output can be
empty.

Add at least one error or warning line to verify the pipeline:

```text
[ERROR] smoke test failure
```

## The CLI exits with code `2`

Exit code `2` is a usage error. Common causes:

- Unknown flag - run `bonsai --help` to see the supported options.
- Unsupported `--aggressiveness` value - use one of `low`, `medium`, `high`, `aggressive`.
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

- uses: mrwogu/context-bonsai@v1
  with:
    log-path: raw_logs.txt
```

## The workflow stops before ContextBonsai runs

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
bonsai raw.log -o clean.log --stats
```

`clean.log` receives the compressed content; `stderr` shows the stats block.
Or use `--json` for a machine-readable report on `stdout`.
