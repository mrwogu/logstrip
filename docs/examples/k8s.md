---
title: Compress Kubernetes logs with LogStrip
description: Trim kubectl, stern, and pod logs into compact, AI-ready context. Multi-pod aggregation, crash-loop debugging, ArgoCD pipelines.
---
# Kubernetes

`kubectl logs` and `stern` produce repetitive, timestamped, container-prefixed
streams. LogStrip collapses the repetition, sanitizes pod IDs / UUIDs, and
keeps the crash window intact.

## Single pod

```bash
kubectl logs -n prod deploy/api --tail=5000 > raw_logs.txt
npx -y logstrip raw_logs.txt -o clean.log --stats
```

## Previous container (post-crash forensics)

```bash
kubectl logs -n prod pod/api-7d8c9 --previous \
  | npx -y logstrip -m auto > crash.log
```

`-m auto` joins multi-line stack traces across languages - useful when you
don't know whether the app is Python, Node, Java, or Go.

## Multi-pod with stern

[stern](https://github.com/stern/stern) tails every pod matching a selector:

```bash
stern --no-color -n prod 'api-.*' --since 10m \
  | npx -y logstrip --timeout 120 -o clean.log --stats
```

`--no-color` is required - ANSI escapes wreck dedup. `--timeout 120` exits
after two minutes; the output is still complete.

## Filter to specific containers

```bash
kubectl logs -n prod deploy/api -c sidecar --tail=2000 \
  | npx -y logstrip -a aggressive --severity warn > clean.log
```

## CronJob post-mortem

```bash
JOB=$(kubectl get jobs -n batch -o name | tail -1)
kubectl logs -n batch "$JOB" --all-containers > raw_logs.txt
npx -y logstrip raw_logs.txt -o clean.log --json > stats.json
```

`stats.json` includes `detectedSources` and `detectedFormat`, useful when
piping into a triage agent.

## Crash-loop debugging

```bash
for POD in $(kubectl get pods -n prod -l app=api -o name); do
  kubectl logs -n prod "$POD" --previous \
    >> raw_logs.txt 2>/dev/null || true
done

npx -y logstrip raw_logs.txt -m auto -o clean.log --stats
```

## ArgoCD / GitOps pipeline

```yaml
- name: Capture failing pod logs
  if: failure()
  run: |
    kubectl logs -n ${{ inputs.namespace }} \
      deploy/${{ inputs.app }} --tail=5000 > raw_logs.txt
    npx -y logstrip raw_logs.txt -o clean.log --stats

- name: Upload compact pod logs
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: pod-logs-${{ inputs.app }}
    path: clean.log
```

See [Supported Sources](../reference/sources.md) for the full list of
Kubernetes-adjacent ecosystems LogStrip auto-detects (kubelet, etcd, CNI
plugins, Helm, ArgoCD, Flux, etc.).
