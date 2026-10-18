---
title: How Log Compression Works for AI
description: Step-by-step breakdown of how LogStrip scores, sanitizes, dampens, folds, and collapses logs into high-signal AI context. Hybrid context engine, not regex-only filtering.
---
# Compression Flow for AI Readiness

LogStrip processes raw logs through a multi-step engine to optimize them for AI consumption. This flow ensures high-signal context is preserved while noise is minimized.

| Step | What happens | Why it matters for AI |
| :-- | :-- | :-- |
| 1. Drop obvious noise | Remove low-value telemetry (`[INFO]`, `[DEBUG]`, `[TRACE]`, `[VERBOSE]`) before it reaches the scorer. The same levels are recognized without brackets when they sit in the line header - Spring Boot, logback/log4j, Python logging, loguru, `level=info` logfmt, glog - unless the text still reads as a diagnostic (`INFO ... connection refused` stays). | Cuts prompt bloat immediately, including for the many frameworks that never print `[INFO]`. Package transfer lines (`Downloaded from central: ... (25 kB at 745 kB/s)`, apt `Get:1 http://...`, pip `Downloading ... .whl`) are treated as progress noise unless they report a failure. Passing-test reports (`PASSED`, `✓`, `--- PASS:`, `ok pkg`, `PASS src/a.test.ts`, `UP-TO-DATE` Gradle tasks) are dropped in the same step, so a passing test called "returns an error for bad input" is not mistaken for a failure. |
| 2. Score relevance | Add signal from errors, JSON severity, unbracketed `WARN`/`ERROR` header levels, scanner findings, container failures, npm/yarn errors, diagnostic keywords, and stack frames. | Works across server, CI, scanner, and container ecosystems. |
| 3. Preserve context windows | Keep a few soft lines before and after high-score diagnostics. | Captures setup and follow-up context without retaining the whole log. |
| 4. Sanitize entropy | Normalize UUIDs, timestamps (ISO, comma-fraction, syslog, bare times of day, epoch fields), hashes, and IPs before deduplication. Repeated structured fields such as `amount=99.99`, `amount=49.50`, and `amount=12.00` collapse to `amount=[99.99 \| 49.50 \| 12.00]` only inside folded `[xN]` groups. Line and column numbers in JavaScript, Python, Java and Go stack frames become `[NN]`, so the same trace printed twice folds into one; the function and file stay, and the exact position is only in the raw log. | Stabilizes repeated events and masks sensitive-looking identifiers without hiding one-off values. |
| 5. Damp repeated spam | Penalize high-frequency sanitized lines and fold adjacent same-shape diagnostics into `[xN]` delta summaries. | Reduces repetition without losing frequency info. |
| 6. Collapse internals | Replace low-value framework/library stack frames with a single marker. | Keeps user-code frames visible while shrinking noisy stacks. |
| 7. Reference repeated blocks | Replace a run of lines that repeats earlier output (typically the same stack trace printed again for the next failure) with one `[... N lines repeated from above ...]` marker. | Removes the largest remaining redundancy in error-heavy logs without losing the first, full copy. |
| 8. Detect source | Identify dominant log ecosystems in the stream. | Helps route incidents to the right owner/toolchain. |
