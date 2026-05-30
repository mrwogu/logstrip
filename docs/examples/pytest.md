---
title: Compress pytest output with LogStrip
description: Trim pytest tracebacks and pip noise before handing logs to an AI agent. Multiline joining, GitHub Actions, GitLab CI, and stdin pipes.
---
# pytest (Python)

Python tracebacks span many indented lines. Run with `-m python` so each
traceback is treated as a single logical event during scoring and
deduplication.

## File in, file out (GitHub Actions)

```yaml
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'

- run: pip install -r requirements.txt

- name: Run pytest
  run: pytest -ra > raw_logs.txt 2>&1 || true

- name: Compress logs
  run: npx -y logstrip raw_logs.txt -m python -o clean.log --stats

- name: Analyze
  run: your-ai-agent analyze --file clean.log
```

## One step with stdin

```bash
pytest -ra 2>&1 | npx -y logstrip -m python > clean.log || true
```

## GitLab CI

```yaml
test:
  image: python:3.12
  script:
    - pip install -r requirements.txt
    - pytest -ra > raw_logs.txt 2>&1 || true
    - npx -y logstrip raw_logs.txt -m python -o clean.log --stats
  artifacts:
    when: always
    paths:
      - clean.log
    expire_in: 1 week
```

## Local pre-push hook

```bash
#!/usr/bin/env bash
# .git/hooks/pre-push
set -euo pipefail

pytest -ra > .pytest.raw.log 2>&1 || PYTEST_EXIT=$?
npx -y logstrip .pytest.raw.log -m python -o .pytest.clean.log --stats

if [[ ${PYTEST_EXIT:-0} -ne 0 ]]; then
  echo "Tests failed. Compact log: .pytest.clean.log"
  exit 1
fi
```

## Tox / multi-env

```bash
tox -p auto 2>&1 | npx -y logstrip -m python --severity warn > clean.log || true
```

`--severity warn` drops `INFO`/`DEBUG` chatter from coverage and plugin
discovery, leaving warnings, errors, and tracebacks.

See [CLI reference - severity filtering](../reference/cli.md#severity-filtering).
