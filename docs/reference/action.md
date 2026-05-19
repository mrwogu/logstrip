# GitHub Action Reference

The GitHub Action is an **optional, thin wrapper** around the LogStrip
CLI / library. The CLI is the canonical distribution channel - the action
exists so you can drop LogStrip into a workflow with one step and get a
GitHub Step Summary for free.

If you can call shell from your workflow, prefer the CLI directly:

```yaml
- run: npx -y logstrip raw_logs.txt -o clean.log --stats
```

## Usage

```yaml
- uses: mrwogu/logstrip@v1
  id: logstrip
  with:
    log-path: raw_logs.txt
    aggressiveness: high
```

## Inputs

| Name | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `log-path` | yes | none | Path to the raw log file. |
| `aggressiveness` | no | `high` | Compression level. Accepted values: `low`, `medium`, `high`, `aggressive`. |

## Outputs

| Name | Description |
| :--- | :--- |
| `output-path` | Path to the compressed output file. |

For an input named `raw.log`, the output file is written next to it as
`raw.logstrip.log`. The action sets `steps.<id>.outputs.output-path` accordingly,
so downstream steps can reference the compressed artifact by ID.

## Step Summary

The action writes a summary table with:

- repository slug;
- estimated input tokens;
- estimated output tokens;
- saved tokens;
- savings percentage;
- dropped line count;
- deduplicated line count.

Token estimates use the current lightweight formula:

```text
tokens = ceil(word_count * 1.3)
```

This is the same calculation the CLI exposes through `--stats` and `--json`.

## Permissions

The action only reads the input log file and writes a compressed output file.
It does not require repository write permissions.

```yaml
permissions:
  contents: read
```

If a later step uploads the compressed log as an artifact or posts it to an
external system, configure that step's permissions separately.

## When to prefer the CLI

- You already have a `run:` step that pipes test output.
- You want machine-readable output (`--json`) for downstream tooling.
- You want to fan out to multiple log files in one step.
- You are not on GitHub Actions (GitLab CI, CircleCI, Jenkins, local pre-push
  hook, etc.).

In all of these cases the CLI gives you the same parser without the action
indirection. See the [CLI reference](cli.md) for flags and recipes.
