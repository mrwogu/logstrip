---
description: Compress a log with LogStrip and report token savings.
argument-hint: <input-log> [--output <output-log>] [--aggressiveness low|medium|high|aggressive]
---

Use the LogStrip CLI to compress the log described in `$ARGUMENTS`.

Workflow:

1. Parse the input path, optional output path, and optional aggressiveness level from `$ARGUMENTS`.
2. Verify `logstrip` or `logstrip` is available with `logstrip --version` or `logstrip --version`.
3. If neither binary exists, tell the user to install it with `npm i -g logstrip`; do not install it automatically.
4. Run the CLI with `--stats`, using `-o <output-log>` when an output path is provided.
5. Summarize the output path, savings percentage, input/output token estimates, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs back into the conversation.
