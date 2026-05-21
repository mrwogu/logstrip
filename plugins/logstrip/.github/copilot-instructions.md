# LogStrip for GitHub Copilot

When a task involves CI, build, test, runtime, scanner, or deployment logs, prepare the log with LogStrip before asking Copilot to diagnose it.

## Auto-detection of pasted logs

When the user pastes content that resembles log output into the chat, automatically compress it with LogStrip before analysing.

**Detection heuristics** - treat the paste as log output when 2+ of these match:
- Timestamps (ISO 8601, `HH:MM:SS`, relative deltas)
- Log levels (`[INFO]`, `[ERROR]`, `WARN`, `DEBUG`, `FATAL`)
- Stack traces (`at package.Class.method(`)
- CI/build markers (`FAIL`, `PASS`, `npm ERR!`, `cargo error`, `make[`, `pytest`, `jest`)
- Repeated line patterns across 5+ lines

**Auto-activation procedure:**
1. Write the pasted content to a temp file: `mktemp` → `<temp>.log`
2. Run `logstrip <temp>.log -o <temp>.log.logstrip.log --stats`
3. If `logstrip` is not installed, suggest: `npm i -g logstrip`
4. Read and analyse the compressed `.logstrip.log` output - skip line-by-line analysis of the raw paste
5. Report savings stats alongside the diagnosis

## Log file workflow

1. Identify the raw log path and choose an output path, usually `<input>.logstrip.log`.
2. Verify the CLI is available with `logstrip --version`.
3. If the CLI is missing, tell the user to install it with `npm i -g logstrip`.
4. Run `logstrip <input> -o <output> --stats`, adding `--aggressiveness <level>` only when the user asks for a non-default level.
5. Use the compressed output for analysis and summarize the `--stats` savings: input tokens, output tokens, savings percent, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs back into chat. Keep LogStrip stats separate from compressed content when piping.
