---
title: Log Sanitization and Security
description: How LogStrip sanitizes UUIDs, timestamps, hashes, and IPs before logs reach AI agents. Not a secret scanner - recommended security posture for CI workflows.
---
# Security

LogStrip is designed to reduce accidental data exposure before logs are passed to an LLM. The same sanitization rules apply whether the parser is invoked through the CLI, the library, or the GitHub Action wrapper.

## Sanitized values

The parser replaces common high-cardinality identifiers:

- UUIDs become `[ID]`;
- ISO and UTC timestamps become `[TIME]`;
- long hexadecimal or alphanumeric hashes become `[HASH]`.

This lowers token cost and removes identifiers that rarely help root-cause analysis.

## What is not guaranteed

LogStrip is not a secret scanner. It does not guarantee removal of:

- API keys;
- passwords;
- private keys;
- customer data;
- arbitrary access tokens.

Run a dedicated secret scanner before sending logs to third-party systems if your logs may contain sensitive content.

## Recommended workflow posture

When using the GitHub Action wrapper, use minimum permissions for the
compression step:

```yaml
permissions:
  contents: read
```

When using the CLI directly, run it as the same user / service account that
already has read access to the log; no extra privileges are required.

Only upload or forward the compressed artifact if your downstream AI system is
approved for the data class in your organization.

## Raw log retention

Avoid long artifact retention for raw logs. If a raw log is needed for debugging, configure short retention:

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: raw-logs
    path: raw_logs.txt
    retention-days: 1
```

Compressed logs are safer to share than raw logs, but they should still be treated as build data.
