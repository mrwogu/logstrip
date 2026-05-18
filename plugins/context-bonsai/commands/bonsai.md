---
description: Compress a log with ContextBonsai and report token savings.
argument-hint: <input-log> [--output <output-log>] [--aggressiveness low|medium|high|aggressive]
---

Use the ContextBonsai CLI to compress the log described in `$ARGUMENTS`.

Workflow:

1. Parse the input path, optional output path, and optional aggressiveness level from `$ARGUMENTS`.
2. Verify `bonsai` or `context-bonsai` is available with `bonsai --version` or `context-bonsai --version`.
3. If neither binary exists, tell the user to install it with `npm i -g context-bonsai`; do not install it automatically.
4. Run the CLI with `--stats`, using `-o <output-log>` when an output path is provided.
5. Summarize the output path, savings percentage, input/output token estimates, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs back into the conversation.
