---
name: Bug Report
about: LogStrip dropped something it should keep, kept noise, crashed or behaved unexpectedly
title: '[BUG] '
labels: bug
assignees: ''
---

## Description

A clear and concise description of the bug.

## Command

The exact command line, including flags and any `.logstrip.yml` settings that apply.
If you use the GitHub Action, paste the `with:` block instead.

```bash
logstrip build.log -o clean.log --stats
```

## Log excerpt

The smallest excerpt of the input log that reproduces the problem.
**Remove or replace secrets, tokens, internal hostnames and personal data before pasting.**

```text
paste the minimal input here
```

## Expected output

What LogStrip should have produced.

## Actual output

What LogStrip produced, or the full error message and exit code.

```text
paste the output here
```

## Environment

- LogStrip version: [output of `logstrip --version`]
- Node.js version: [output of `node --version`]
- OS: [e.g., Ubuntu 24.04, macOS 15, Windows 11]
- How you run it: [global npm install, npx, library import, GitHub Action]

## Additional Context

Anything else that helps, such as the CI system that produced the log.
