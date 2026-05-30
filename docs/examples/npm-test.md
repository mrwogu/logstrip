---
title: Compress npm test logs with LogStrip
description: Trim noisy npm/yarn/pnpm/Vitest/Jest output in CI before handing it to an AI agent. Stdin pipes, matrix jobs, artifact upload, GitHub Action wrapper.
---
# npm test (Node.js)

Node test runners (`vitest`, `jest`, `mocha`, `node --test`) and package
managers (`npm`, `yarn`, `pnpm`) are some of the noisiest CI producers around.
The recipes below cover the most common shapes.

## File in, file out (most common)

```yaml
- name: Run tests
  run: npm test > raw_logs.txt 2>&1 || true

- name: Compress logs with LogStrip
  run: npx -y logstrip raw_logs.txt -o clean.log --stats

- name: Analyze
  run: your-ai-agent analyze --file clean.log
```

`|| true` keeps the log on disk even when the test step fails - otherwise you
lose the very output you wanted to compress.

## One step with stdin

When you do not need the raw log on disk, pipe directly:

```yaml
- name: Run tests and compress on the fly
  shell: bash
  run: |
    npm test 2>&1 | npx -y logstrip > clean.log || true
    cat clean.log
```

## Matrix jobs

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

## PowerShell / Windows runner

```yaml
- name: Run tests
  shell: pwsh
  run: npm test *> raw_logs.txt; if ($LASTEXITCODE -ne 0) { exit 0 }

- name: Compress logs with LogStrip
  shell: pwsh
  run: npx -y logstrip raw_logs.txt -o clean.log --stats
```

## Upload compact logs as an artifact

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

Keep the raw log around briefly for manual debugging if needed:

```yaml
- name: Upload raw logs for manual debugging
  uses: actions/upload-artifact@v4
  with:
    name: raw-logs
    path: raw_logs.txt
    retention-days: 1
```

## GitHub Action wrapper

Same engine, one fewer line:

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

The wrapper exists for ergonomics inside GitHub Actions specifically.
On any other CI provider, call the CLI directly. See the
[GitHub Action reference](../reference/action.md) for inputs, outputs,
and the Step Summary contract.

## Tuning for Node stack traces

Node throws are multi-line. Use `-m node` to keep each traceback as one
logical line during scoring and deduplication:

```bash
npx -y logstrip raw_logs.txt -m node -o clean.log --stats
```

See [CLI reference - multiline joining](../reference/cli.md#multiline-traceback-joining).
