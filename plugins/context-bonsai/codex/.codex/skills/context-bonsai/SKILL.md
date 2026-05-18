---
name: context-bonsai
description: Compress noisy CI, build, runtime, scanner, and test logs before Codex analyzes them. Use when the user asks to inspect, trim, reduce, summarize, or prepare logs for diagnosis.
---

# ContextBonsai Log Compression

ContextBonsai removes repeated low-signal lines, masks common identifiers, collapses internal stack frames, and reports token savings so Codex spends context on diagnostics instead of noise.

## Procedure

1. Identify the raw input log and desired output path. If no output path is supplied, use `<input>.bonsai.log`.
2. Verify `bonsai` or `context-bonsai` is installed. If not, instruct the user to run `npm i -g context-bonsai`.
3. Run `bonsai <input> -o <output> --stats`, adding `--aggressiveness <level>` only when requested.
4. Diagnose from the compressed output file.
5. Report the output path, savings percentage, input/output token estimates, dropped lines, duplicate lines, and hidden internal stack lines.

## Guardrails

- Do not print full raw logs unless the user explicitly requests excerpts.
- Do not install packages automatically.
- Do not use `--json` unless an output path is present.
- Keep stats separate from compressed content when piping.
