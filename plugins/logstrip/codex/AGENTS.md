# LogStrip for Codex

Use LogStrip whenever Codex reads or encounters CI, build, test, runtime, scanner, or deployment logs.

## Auto-detection of pasted logs

When the user pastes content that resembles log output (2+ of: timestamps, log levels, stack traces, CI/build markers, repeated line patterns across 5+ lines), automatically compress it with LogStrip before analysing:

1. Write the pasted content to a temp file: `mktemp` → `<temp>.log`
2. Run `logstrip <temp>.log -o <temp>.log.logstrip.log --stats`
3. If `logstrip` is not installed, suggest: `npm i -g logstrip`
4. Read and analyse the compressed `.logstrip.log` output — skip line-by-line analysis of the raw paste
5. Report savings stats alongside the diagnosis

## Log file workflow

1. Locate the raw log path and choose an output path, usually `<input>.logstrip.log`.
2. Verify `logstrip` or `logstrip` is available.
3. If the CLI is missing, ask the user to install it with `npm i -g logstrip`.
4. Run `logstrip <input> -o <output> --stats`, using the default `high` aggressiveness unless the user requests another level.
5. Analyze the compressed file instead of the raw log.
6. Report the output path, input/output token estimates, savings percentage, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs into Codex responses. Keep stats on stderr separate from compressed content.
