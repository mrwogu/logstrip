---
title: CI/CD Workflow Examples for Log Compression
description: Real workflow examples — compress test logs, use stdin pipes, matrix jobs, artifact upload, and the GitHub Action wrapper. GitHub Actions, PowerShell, and Unix pipes.
---
# Workflow Examples

The examples below favour the CLI - it composes naturally with any CI that can
run shell. The GitHub Action wrapper is shown last for completeness.

## Compress test logs before AI agent analysis (CLI in `run:`)

```yaml
- name: Run tests
  run: npm test > raw_logs.txt 2>&1 || true

- name: Compress logs with LogStrip
  run: npx -y logstrip raw_logs.txt -o clean.log --stats

- name: Analyze
  run: your-ai-agent analyze --file clean.log
```

## One-step pipeline with stdin

```yaml
- name: Run tests and compress on the fly
  shell: bash
  run: |
    npm test 2>&1 | npx -y logstrip > clean.log || true
    cat clean.log
```

## Windows runner with PowerShell

```yaml
- name: Run tests
  shell: pwsh
  run: npm test *> raw_logs.txt; if ($LASTEXITCODE -ne 0) { exit 0 }

- name: Compress logs with LogStrip
  shell: pwsh
  run: npx -y logstrip raw_logs.txt -o clean.log --stats
```

## Use with matrix jobs (CLI)

```yaml
strategy:
  matrix:
    node-version: [20.x, 22.x, 24.x]

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
      cache: npm

  - run: npm ci

  - name: Run tests
    run: npm test > "raw-node-${{ matrix.node-version }}.log" 2>&1 || true

  - name: Compress logs
    run: |
      npx -y logstrip "raw-node-${{ matrix.node-version }}.log" \
        -o "clean-node-${{ matrix.node-version }}.log" \
        --stats
```

## Upload compressed logs as an artifact

```yaml
- name: Run tests
  run: npm test > raw_logs.txt 2>&1 || true

- name: Compress logs
  run: npx -y logstrip raw_logs.txt -o clean.log --json > stats.json

- name: Upload compact logs and report
  uses: actions/upload-artifact@v4
  with:
    name: logstrip-logs
    path: |
      clean.log
      stats.json
    retention-days: 7
```

## Preserve raw logs briefly

```yaml
- name: Upload raw logs for manual debugging
  uses: actions/upload-artifact@v4
  with:
    name: raw-logs
    path: raw_logs.txt
    retention-days: 1
```

## GitHub Action wrapper (if you prefer one step over `run:`)

```yaml
- name: Run tests
  run: npm test > raw_logs.txt 2>&1 || true

- name: Compress logs
  uses: mrwogu/logstrip@v1
  id: logstrip
  with:
    log-path: raw_logs.txt

- name: Analyze
  run: your-ai-agent analyze --file "${{ steps.logstrip.outputs.output-path }}"
```

The action exists for ergonomics inside GitHub Actions specifically. Any other
CI provider (GitLab CI, CircleCI, Jenkins, Buildkite, local pre-push hooks)
should call the CLI directly.
