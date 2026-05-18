---
name: context-bonsai
description: Compress noisy CI, build, runtime, and test logs with the ContextBonsai CLI. Use when the user asks to trim, compress, reduce, or prepare logs for LLM analysis.
user-invocable: true
---

# ContextBonsai Log Compression

Use ContextBonsai when a user provides or points to a verbose log and wants the diagnostic signal preserved while noise is removed.

## Procedure

1. Identify the input log path and desired output path. If no output path is given, use `<input>.bonsai.log`.
2. Verify `bonsai` or `context-bonsai` is already installed. If missing, instruct the user to run `npm i -g context-bonsai`.
3. Run `bonsai <input> -o <output> --stats`, adding `--aggressiveness <level>` when requested.
4. Report the output path, savings percentage, estimated input/output tokens, dropped lines, duplicate lines, and hidden internal stack lines.
5. If the command fails, show the concise error and suggest the smallest next step.

## Guardrails

- Do not print raw logs unless the user explicitly asks for excerpts.
- Do not install packages automatically.
- Do not use `--json` unless an output path is present.
- Keep stats separate from compressed content when piping.
