<section class="bonsai-hero" markdown="1">
<div class="bonsai-hero__inner" markdown="1">
<div class="bonsai-hero__copy" markdown="1">
<p class="bonsai-kicker">cli compression for agentic pipelines</p>

# smaller logs. cleaner agents.

<p class="bonsai-lede">A zero-dependency CLI that turns chaotic server logs, build pipelines, vulnerability scanners, and container workloads into compact, high-signal context that AI agents can actually reason about.</p>
<p class="bonsai-lede bonsai-lede--small">Toggle the demo to watch a noisy raw log become a compact, sanitized Bonsai artifact.</p>

<p class="bonsai-actions">
  <a class="bonsai-button" href="getting-started/">install the cli</a>
  <a class="bonsai-button bonsai-button--ghost" href="#live-demo">watch the demo</a>
  <a class="bonsai-button bonsai-button--ghost" href="guides/plugins/">agent plugins</a>
</p>
</div>

<div class="bonsai-demo bonsai-demo--toggle" data-bonsai-compare aria-label="Interactive raw-to-Bonsai terminal comparison">
  <div class="bonsai-demo__bar">
    <span class="bonsai-demo__dot"></span>
    <span class="bonsai-demo__dot"></span>
    <span class="bonsai-demo__dot"></span>
    <span class="bonsai-demo__title">raw.log → bonsai.log</span>
  </div>
  <div class="bonsai-demo__fallback">
    <strong>Demo fallback</strong>
    <pre>[INFO] boot ok
[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed
[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed</pre>
    <pre>[x2] [ERROR] request [ID] failed</pre>
    <span>JavaScript adds the interactive raw/Bonsai toggle here.</span>
  </div>
</div>
</div>
</section>

<div class="bonsai-ecosystem-strip" aria-label="Supported log ecosystems" data-bonsai-reveal>
  <div class="bonsai-ecosystem-strip__track">
    <span>GitHub Actions</span><span>GitLab CI</span><span>Jenkins</span><span>Docker</span><span>Kubernetes</span><span>Helm</span><span>Terraform</span><span>npm</span><span>pnpm</span><span>yarn</span><span>Vitest</span><span>Jest</span><span>Pytest</span><span>Maven</span><span>Gradle</span><span>Go test</span><span>Rust/Cargo</span><span>Webpack</span><span>Trivy</span><span>Snyk</span><span>Semgrep</span><span>nginx</span><span>PostgreSQL</span><span>Kafka</span><span>Redis</span><span>Cloud Run</span><span>AWS Lambda</span><span>Datadog</span><span>Sentry</span><span>OpenTelemetry</span>
    <span>GitHub Actions</span><span>GitLab CI</span><span>Jenkins</span><span>Docker</span><span>Kubernetes</span><span>Helm</span><span>Terraform</span><span>npm</span><span>pnpm</span><span>yarn</span><span>Vitest</span><span>Jest</span><span>Pytest</span><span>Maven</span><span>Gradle</span><span>Go test</span><span>Rust/Cargo</span><span>Webpack</span><span>Trivy</span><span>Snyk</span><span>Semgrep</span><span>nginx</span><span>PostgreSQL</span><span>Kafka</span><span>Redis</span><span>Cloud Run</span><span>AWS Lambda</span><span>Datadog</span><span>Sentry</span><span>OpenTelemetry</span>
  </div>
</div>

<div class="bonsai-grid" markdown="1">
<div class="bonsai-card" data-bonsai-reveal data-delay="1" markdown="1">
<span class="bonsai-metric">npm i -g context-bonsai</span>

### one install away

Installs one CLI with two aliases: `bonsai` (short) and `context-bonsai` (explicit). Same behavior, same binary, zero runtime dependencies on the hot path.
</div>

<div class="bonsai-card" data-bonsai-reveal data-delay="2" markdown="1">
<span class="bonsai-metric">stream</span>

### gigabyte-safe

Built on Node streams and `readline`, so multi-gigabyte logs never have to fit in memory.
</div>

<div class="bonsai-card" data-bonsai-reveal data-delay="3" markdown="1">
<span class="bonsai-metric">100/100</span>

### coverage gate

Statement, branch, function, and line coverage are pinned to 100% across the parser, CLI, and Action.
</div>

<div class="bonsai-card" data-bonsai-reveal data-delay="4" markdown="1">
<span class="bonsai-metric">unix</span>

### pipe-native

`cat raw.log | bonsai > clean.log`. Stats on stderr, JSON on stdout (with `--output`), exit codes 0/1/2.
</div>
</div>

<section class="bonsai-engine" data-bonsai-reveal markdown="1">
<p class="bonsai-kicker">hybrid context engine</p>

## advanced detection, not regex-only filtering

ContextBonsai scores each sanitized line, keeps nearby context, dampens repeated spam, folds near-identical diagnostics with volatile values, and hides internal framework frames: compact incident narrative, not a noisy transcript.

<div class="bonsai-engine__grid" markdown="1">
<div class="bonsai-engine__step" markdown="1"><span>01</span>**Score signals** from log level, JSON severity, container failures, scanner findings, package managers, diagnostic keywords, and stack frames.</div>
<div class="bonsai-engine__step" markdown="1"><span>02</span>**Promote context** with a before/after window so setup lines near the failure survive even when they are not errors themselves.</div>
<div class="bonsai-engine__step" markdown="1"><span>03</span>**Dampen repeats** with TF-IDF-style frequency tracking, then fold adjacent diagnostic variants into `[xN]` summaries.</div>
<div class="bonsai-engine__step" markdown="1"><span>04</span>**Summarize deltas** by listing only differing `key=value` values when repeated events share the same shape.</div>
<div class="bonsai-engine__step" markdown="1"><span>05</span>**Collapse internals** by replacing low-value framework/runtime stack frames with one marker while preserving app frames.</div>
<div class="bonsai-engine__step" markdown="1"><span>06</span>**Detect sources** across 700+ ecosystems so JSON reports can tell agents what kind of log they are reading.</div>
</div>
</section>

## why ContextBonsai exists

DevOps, SysOps, and GitOps teams often paste entire raw logs into AI agents during incident response. LLMs are bad at high-noise dumps. <span class="bonsai-accent-shift">ContextBonsai eases that pain and reduces token costs.</span>

<div class="bonsai-grid" markdown="1">
<div class="bonsai-card" data-bonsai-reveal data-delay="1" markdown="1">
<span class="bonsai-metric">problem</span>

### too much noise

Raw logs mix signal with thousands of low-value lines and repeated frames.
</div>

<div class="bonsai-card" data-bonsai-reveal data-delay="2" markdown="1">
<span class="bonsai-metric">impact</span>

### weaker ai answers

Large noisy prompts dilute root-cause context and inflate LLM spend.
</div>

<div class="bonsai-card" data-bonsai-reveal data-delay="3" markdown="1">
<span class="bonsai-metric">outcome</span>

### compact signal

ContextBonsai produces deterministic, AI-ready logs that are cheaper to analyze.
</div>
</div>


### validation that catches regressions

<div class="bonsai-grid" markdown="1">
<div class="bonsai-card" data-bonsai-reveal data-delay="1" markdown="1"><span class="bonsai-metric">snapshots</span>Golden outputs lock down exact compression behavior, including sanitization, duplicate-shaped grouping, context windows, and hidden internal frames.</div>
<div class="bonsai-card" data-bonsai-reveal data-delay="2" markdown="1"><span class="bonsai-metric">smoke corpus</span>Fixtures cover noisy server logs, CI failures, scanner findings, container crashes, Spring Boot stacks, nginx upstream failures, and Node runtime crashes.</div>
<div class="bonsai-card" data-bonsai-reveal data-delay="3" markdown="1"><span class="bonsai-metric">100%</span>TypeScript units and smoke tests run under a strict **100/100/100/100** coverage gate before release.</div>
</div>

### why teams keep it in every pipeline

<div class="bonsai-grid" markdown="1">
<div class="bonsai-card" data-bonsai-reveal data-delay="1" markdown="1"><span class="bonsai-metric">ops-first</span>Built for incident workflows where raw logs hit AI assistants under pressure.</div>
<div class="bonsai-card" data-bonsai-reveal data-delay="2" markdown="1"><span class="bonsai-metric">700+</span>Automatic source awareness across CI, runtimes, scanners, infra, and cloud logs.</div>
<div class="bonsai-card" data-bonsai-reveal data-delay="3" markdown="1"><span class="bonsai-metric">deterministic</span>Snapshot-tested output and a strict **100/100/100/100** quality gate.</div>
<div class="bonsai-card" data-bonsai-reveal data-delay="4" markdown="1"><span class="bonsai-metric">cheaper prompts</span>Lower token usage per incident while keeping root-cause context intact.</div>
</div>

<div class="bonsai-agents-strip" data-bonsai-reveal>
  <span class="bonsai-agents-strip__label">plugins for every listed agent</span>
  <div class="bonsai-agents-strip__logos">
    <div class="bonsai-agent-logo" title="Claude Code"><img src="assets/images/logo-claude-code.svg" alt="Claude Code"></div>
    <div class="bonsai-agent-logo" title="Droid"><img src="assets/images/logo-droid.png" alt="Droid"></div>
    <div class="bonsai-agent-logo" title="Copilot"><img src="assets/images/logo-copilot.svg" alt="Copilot"></div>
    <div class="bonsai-agent-logo" title="Cursor"><img src="assets/images/logo-cursor.svg" alt="Cursor"></div>
    <div class="bonsai-agent-logo" title="Codex"><img src="assets/images/logo-codex.png" alt="Codex"></div>
    <div class="bonsai-agent-logo" title="OpenCode"><img src="assets/images/logo-opencode.png" alt="OpenCode"></div>
  </div>
  <a class="bonsai-button" href="guides/plugins/">install for your agent</a>
</div>

## live demo

The hero terminal is interactive: switch from `raw.log` to `bonsai` to see the
browser-side demo compress repeated errors, mask volatile identifiers, collapse
framework stack frames, and show the agent-ready summary.

If your browser blocks JavaScript, the same transformation looks like this:

```text
[INFO] boot ok
[DEBUG] retry cache warming
[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed
[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed
    at lib (/repo/node_modules/pkg/index.js:1:1)
```

```text
[x2] [ERROR] request [ID] failed
[... hidden internal stack frames ...]
```

## cli in one line

`bonsai` and `context-bonsai` are two command names for the same CLI executable.

```bash
bonsai raw.log -o clean.log --stats
```

The CLI writes the compressed log to `clean.log` and a short stats block to
`stderr`. Stdin and stdout are supported too:

```bash
cat raw.log | bonsai > clean.log
```

You can also run it instantly without installation via `npx`:

```bash
npx -y context-bonsai raw.log -o clean.log --stats
```

Run `bonsai --help` for every flag, or read the [CLI reference](reference/cli.md).

## optional: github action

When you would rather not call the CLI from a `run:` step, the same parser is
exposed as a thin GitHub Action wrapper:

```yaml
- name: Compress logs with ContextBonsai
  uses: mrwogu/context-bonsai@v1
  id: bonsai
  with:
    log-path: raw_logs.txt
    aggressiveness: high
```

The action writes `steps.bonsai.outputs.output-path` and a GitHub Step Summary
with estimated input tokens, output tokens, and savings.

## next steps

- [Getting Started](getting-started.md)
- [CLI Reference](reference/cli.md)
- [Core TypeScript API](reference/core.md)
- [GitHub Action](reference/action.md)
- [Plugin Installation](guides/plugins.md)
- [Workflow Examples](examples/index.md)
