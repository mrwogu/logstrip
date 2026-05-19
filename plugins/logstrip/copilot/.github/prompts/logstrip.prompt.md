---
mode: agent
description: Compress a log with LogStrip and report token savings. Auto-detects pasted log output.
---

# LogStrip log compression

Use the LogStrip CLI to compress the log described by the user.

## Auto-detection of pasted logs

When the user pastes content that resembles log output (timestamps, log levels, stack traces, CI markers, repeated line patterns), write it to a temp file and run `logstrip` before analysing.

## Workflow

1. Parse the input log path, optional output path, and optional aggressiveness level from the request.
2. Verify `logstrip` or `logstrip` is installed.
3. If neither binary exists, tell the user to run `npm i -g logstrip`.
4. Run `logstrip <input> -o <output> --stats`, defaulting `<output>` to `<input>.logstrip.log`.
5. Analyze the compressed file, not the raw log.
6. Report output path, savings percentage, input/output token estimates, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs into the response.
