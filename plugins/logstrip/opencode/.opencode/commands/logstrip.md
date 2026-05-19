---
description: Compress a log with LogStrip and report token savings.
---

Use the LogStrip CLI to compress the log described in `$ARGUMENTS`.

Workflow:

1. Parse the input path, optional output path, and optional aggressiveness level.
2. Verify `logstrip` or `logstrip` is available.
3. If neither binary exists, tell the user to install it with `npm i -g logstrip`.
4. Run `logstrip <input> -o <output> --stats`, defaulting `<output>` to `<input>.logstrip.log`.
5. Summarize the output path, savings percentage, input/output token estimates, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs back into the conversation.
