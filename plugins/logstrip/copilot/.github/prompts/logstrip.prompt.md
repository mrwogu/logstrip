---
mode: agent
description: Compress a log with LogStrip and report token savings.
---

# LogStrip log compression

Use the LogStrip CLI to compress the log described by the user.

Workflow:

1. Parse the input log path, optional output path, and optional aggressiveness level from the request.
2. Verify `logstrip` or `logstrip` is installed.
3. If neither binary exists, tell the user to run `npm i -g logstrip`.
4. Run `logstrip <input> -o <output> --stats`, defaulting `<output>` to `<input>.logstrip.log`.
5. Analyze the compressed file, not the raw log.
6. Report output path, savings percentage, input/output token estimates, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs into the response.
