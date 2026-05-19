# LogStrip for GitHub Copilot

When a task involves CI, build, test, runtime, scanner, or deployment logs, prepare the log with LogStrip before asking Copilot to diagnose it.

1. Identify the raw log path and choose an output path, usually `<input>.logstrip.log`.
2. Verify the CLI is available with `logstrip --version` or `logstrip --version`.
3. If the CLI is missing, tell the user to install it with `npm i -g logstrip`.
4. Run `logstrip <input> -o <output> --stats`, adding `--aggressiveness <level>` only when the user asks for a non-default level.
5. Use the compressed output for analysis and summarize the `--stats` savings: input tokens, output tokens, savings percent, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs back into chat. Keep LogStrip stats separate from compressed content when piping.
