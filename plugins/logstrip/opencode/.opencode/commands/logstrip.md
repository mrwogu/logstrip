---
description: Compress a log with LogStrip and report token savings. Auto-detects pasted log output.
---

Use the LogStrip CLI to compress the log described in `$ARGUMENTS`.

If the user pasted log-like output instead of providing a file path, write the pasted content to a temp file first, then compress it.

Workflow:

1. Parse the input path, optional output path, and optional aggressiveness level.
2. Verify `logstrip` is available.
3. If the binary does not exist, tell the user to install it with `npm i -g logstrip`.
4. Run `logstrip <input> -o <output> --stats`, defaulting `<output>` to `<input>.logstrip.log`.
5. Summarize the output path, savings percentage, input/output token estimates, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs back into the conversation.
