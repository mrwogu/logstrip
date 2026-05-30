---
title: LogStrip Cookbook
description: Copy-paste workflow recipes for compressing CI logs - npm/Vitest/Jest, pytest, docker compose, Kubernetes, and Jenkins. All recipes favour the CLI.
---
# Cookbook

Copy-paste recipes grouped by tool. Every example favours the CLI - it composes
naturally with any CI that can run a shell. The GitHub Action wrapper appears
in the npm-test recipe and is documented in full at
[Reference - GitHub Action](../reference/action.md).

<div class="logstrip-grid" markdown="1">

<div class="logstrip-card" markdown="1">
<span class="logstrip-metric">node</span>

### [npm test](npm-test.md)

`vitest`, `jest`, `mocha`, `node --test`, npm/yarn/pnpm. Stdin, matrix,
PowerShell, artifact upload, GitHub Action wrapper.
</div>

<div class="logstrip-card" markdown="1">
<span class="logstrip-metric">python</span>

### [pytest](pytest.md)

Multi-line traceback joining (`-m python`), GitHub Actions, GitLab CI,
tox, pre-push hooks.
</div>

<div class="logstrip-card" markdown="1">
<span class="logstrip-metric">docker</span>

### [docker compose](docker-compose.md)

`docker compose logs`, follow mode with `--timeout`, per-service
compression, on-failure capture in CI.
</div>

<div class="logstrip-card" markdown="1">
<span class="logstrip-metric">k8s</span>

### [Kubernetes](k8s.md)

`kubectl logs`, `stern`, previous-container post-mortems, crash-loop
debugging, ArgoCD / GitOps integration.
</div>

<div class="logstrip-card" markdown="1">
<span class="logstrip-metric">ci</span>

### [Jenkins](jenkins.md)

Declarative and scripted pipelines, console-log capture via REST,
multi-branch artifact archiving.
</div>

</div>

## Don't see your stack?

Every recipe is a thin shell wrapper around the same CLI:

```bash
<your-tool> 2>&1 | npx -y logstrip > clean.log
```

The patterns translate directly to GitLab CI, CircleCI, Buildkite, Drone,
Tekton, Azure Pipelines, AWS CodeBuild, and local pre-commit / pre-push
hooks. See the [CLI reference](../reference/cli.md) for every flag.
