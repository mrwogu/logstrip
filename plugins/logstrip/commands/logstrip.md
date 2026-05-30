---
description: 'Compress a log with LogStrip and report token savings. Also auto-detects pasted log output.'
argument-hint: <input-log> [--output <output-log>] [--aggressiveness low|medium|high|aggressive|auto]
---

Use the LogStrip CLI to compress the log described in `$ARGUMENTS`.

If the user pasted log-like output instead of providing a file path, write the pasted content to a temp file first, then compress it.

Workflow:

1. Parse the input path, optional output path, and optional aggressiveness level from `$ARGUMENTS`.
2. Verify `logstrip` is available with `logstrip --version`.
3. If the binary does not exist, tell the user to install it with `npm i -g logstrip`; do not install it automatically.
4. Run the CLI with `--stats`, using `-o <output-log>` when an output path is provided.
5. Summarize the output path, savings percentage, input/output token estimates, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs back into the conversation.
