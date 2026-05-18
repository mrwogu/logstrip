# ContextBonsai for OpenCode

Use ContextBonsai whenever the user asks OpenCode to analyze CI, build, test, runtime, scanner, or deployment logs.

## Log workflow

1. Locate the raw log path and choose an output path, usually `<input>.bonsai.log`.
2. Verify `bonsai` or `context-bonsai` is available.
3. If the CLI is missing, ask the user to install it with `npm i -g context-bonsai`.
4. Run `bonsai <input> -o <output> --stats`, using the default `high` aggressiveness unless the user requests another level.
5. Analyze the compressed file instead of the raw log.
6. Report the output path, input/output token estimates, savings percentage, dropped lines, duplicate lines, and hidden internal stack lines.

Do not paste full raw logs into OpenCode responses. Keep stats separate from compressed content.
