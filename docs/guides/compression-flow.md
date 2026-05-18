# Compression Flow for AI Readiness

ContextBonsai processes raw logs through a multi-step engine to optimize them for AI consumption. This flow ensures high-signal context is preserved while noise is minimized.

| Step | What happens | Why it matters for AI |
| :-- | :-- | :-- |
| 1. Drop obvious noise | Remove low-value telemetry (`[INFO]`, `[DEBUG]`, `[TRACE]`, `[VERBOSE]`) before it reaches the scorer. | Cuts prompt bloat immediately. |
| 2. Score relevance | Add signal from errors, JSON severity, scanner findings, container failures, npm/yarn errors, diagnostic keywords, and stack frames. | Works across server, CI, scanner, and container ecosystems. |
| 3. Preserve context windows | Keep a few soft lines before and after high-score diagnostics. | Captures setup and follow-up context without retaining the whole log. |
| 4. Sanitize entropy | Normalize UUIDs, timestamps, hashes, and IPs before deduplication. Repeated structured fields such as `amount=99.99`, `amount=49.50`, and `amount=12.00` collapse to `amount=[99.99 \| 49.50 \| 12.00]` only inside folded `[xN]` groups. | Stabilizes repeated events and masks sensitive-looking identifiers without hiding one-off values. |
| 5. Damp repeated spam | Penalize high-frequency sanitized lines and fold adjacent same-shape diagnostics into `[xN]` delta summaries. | Reduces repetition without losing frequency info. |
| 6. Collapse internals | Replace low-value framework/library stack frames with a single marker. | Keeps user-code frames visible while shrinking noisy stacks. |
| 7. Detect source | Identify dominant log ecosystems in the stream. | Helps route incidents to the right owner/toolchain. |
