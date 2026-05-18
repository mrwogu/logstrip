---
mode: agent
description: Compress a log with ContextBonsai and report token savings.
---

# ContextBonsai log compression

Use the ContextBonsai CLI to compress the log described by the user.

Workflow:

1. Parse the input log path, optional output path, and optional aggressiveness level from the request.
2. Verify `bonsai` or `context-bonsai` is installed.
3. If neither binary exists, tell the user to run `npm i -g context-bonsai`.
4. Run `bonsai <input> -o <output> --stats`, defaulting `<output>` to `<input>.bonsai.log`.
5. Analyze the compressed file, not the raw log.
6. Report output path, savings percentage, input/output token estimates, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs into the response.
