---
title: Compress docker compose logs with LogStrip
description: Trim multi-container docker compose logs into compact, AI-ready context. Follow mode, per-service compression, CI integration.
---
# Docker Compose

`docker compose logs` interleaves output from every service. The result is
noisy, repetitive, and full of timestamps and container IDs - exactly the
shape LogStrip is built for.

## Snapshot all services

```bash
docker compose logs --no-color > raw_logs.txt
npx -y logstrip raw_logs.txt -o clean.log --stats
```

Pass `--no-color` so ANSI escapes do not leak into the compressed output.

## One step with stdin

```bash
docker compose logs --no-color 2>&1 | npx -y logstrip > clean.log
```

## Follow mode with a time budget

When tailing live logs, cap the run so the CLI exits cleanly:

```bash
docker compose logs --no-color --follow 2>&1 \
  | npx -y logstrip --timeout 60 -o clean.log --stats
```

`--timeout 60` flushes the compressed output after 60 seconds and sets
`timedOut: true` in `--json` output. See
[CLI reference - sampling and timeouts](../reference/cli.md#sampling-and-timeouts).

## Per-service compression

When one service dominates the noise, compress it on its own:

```bash
docker compose logs --no-color api > raw_api.log
docker compose logs --no-color worker > raw_worker.log

npx -y logstrip raw_api.log    -o clean_api.log    --stats
npx -y logstrip raw_worker.log -o clean_worker.log --stats
```

## CI: capture compose logs on failure

```yaml
- name: Bring up stack
  run: docker compose up -d --wait

- name: Run integration tests
  run: pytest tests/integration -ra
  continue-on-error: true
  id: tests

- name: Capture compose logs on failure
  if: steps.tests.outcome == 'failure'
  run: |
    docker compose logs --no-color > raw_logs.txt
    npx -y logstrip raw_logs.txt -o clean.log --stats

- name: Upload compact logs
  if: steps.tests.outcome == 'failure'
  uses: actions/upload-artifact@v4
  with:
    name: compose-logs
    path: clean.log
```

## Tighter compression for chatty stacks

Stacks with health-check spam (databases, brokers, gateways) benefit from
`high` or `aggressive`:

```bash
docker compose logs --no-color \
  | npx -y logstrip -a aggressive --exclude 'healthcheck|ping' > clean.log
```

See [CLI reference - aggressiveness](../reference/cli.md#aggressiveness-and-context-retention)
and [include/exclude patterns](../reference/cli.md#include-exclude-patterns).
