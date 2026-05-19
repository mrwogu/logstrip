<section class="logstrip-hero" markdown="1">
<div class="logstrip-hero__inner" markdown="1">
<div class="logstrip-hero__copy" markdown="1">
<p class="logstrip-kicker">cli compression for agentic pipelines</p>

# smaller logs. cleaner agents.

<p class="logstrip-lede">A zero-dependency CLI that turns chaotic server logs, build pipelines, vulnerability scanners, and container workloads into compact, high-signal context that AI agents can actually reason about.</p>

<p class="logstrip-actions">
  <a class="logstrip-button" href="getting-started/">install the cli</a>
  <a class="logstrip-button logstrip-button--ghost" href="guides/plugins/">agent plugins</a>
</p>
</div>

<div class="logstrip-demo logstrip-demo--toggle" data-logstrip-compare aria-label="Interactive raw-to-Bonsai terminal comparison">
  <div class="logstrip-demo__bar">
    <span class="logstrip-demo__dot"></span>
    <span class="logstrip-demo__dot"></span>
    <span class="logstrip-demo__dot"></span>
    <span class="logstrip-demo__title">raw.log → logstrip.log</span>
  </div>
  <div class="logstrip-demo__fallback">
    <pre>[INFO] boot ok
[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed
[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed</pre>
    <pre>[x2] [ERROR] request [ID] failed</pre>
  </div>
</div>
</div>
</section>

<div class="logstrip-ecosystem-marquee" data-logstrip-reveal markdown="1">
<span class="logstrip-kicker">705+ detected ecosystems</span>

## your stack, covered

<div class="logstrip-ecosystem-marquee__pool" markdown="1">
<span class="logstrip-tool-pill">:simple-trivy: Trivy</span>
<span class="logstrip-tool-pill">:simple-snyk: Snyk</span>
<span class="logstrip-tool-pill">:material-shield-search: Semgrep</span>
<span class="logstrip-tool-pill">:simple-nginx: nginx</span>
<span class="logstrip-tool-pill">:simple-postgresql: PostgreSQL</span>
<span class="logstrip-tool-pill">:simple-redis: Redis</span>
<span class="logstrip-tool-pill">:fontawesome-brands-aws: AWS Lambda</span>
<span class="logstrip-tool-pill">:simple-datadog: Datadog</span>
<span class="logstrip-tool-pill">:simple-sentry: Sentry</span>
<span class="logstrip-tool-pill">:fontawesome-brands-docker: Docker</span>
<span class="logstrip-tool-pill">:simple-kubernetes: Kubernetes</span>
<span class="logstrip-tool-pill">:simple-terraform: Terraform</span>
<span class="logstrip-tool-pill">:simple-apachekafka: Kafka</span>
<span class="logstrip-tool-pill">:simple-elasticsearch: Elasticsearch</span>
<span class="logstrip-tool-pill">:simple-opentelemetry: OpenTelemetry</span>
<span class="logstrip-tool-pill">:simple-prometheus: Prometheus</span>
<span class="logstrip-tool-pill">:simple-grafana: Grafana</span>
<span class="logstrip-tool-pill">:simple-githubactions: GitHub Actions</span>
<span class="logstrip-tool-pill">:fontawesome-brands-gitlab: GitLab CI</span>
<span class="logstrip-tool-pill">:simple-cloudflare: Cloudflare</span>
<span class="logstrip-tool-pill">:simple-springboot: Spring Boot</span>
<span class="logstrip-tool-pill">:simple-django: Django</span>
<span class="logstrip-tool-pill">:simple-express: Express</span>
<span class="logstrip-tool-pill">:simple-nextdotjs: Next.js</span>
<span class="logstrip-tool-pill">:fontawesome-brands-jenkins: Jenkins</span>
<span class="logstrip-tool-pill">:simple-helm: Helm</span>
<span class="logstrip-tool-pill">:simple-mongodb: MongoDB</span>
<span class="logstrip-tool-pill">:simple-vitest: Vitest</span>
<span class="logstrip-tool-pill">:simple-jest: Jest</span>
<span class="logstrip-tool-pill">:simple-pytest: Pytest</span>
<span class="logstrip-tool-pill">:material-test-tube: Playwright</span>
<span class="logstrip-tool-pill">:fontawesome-brands-npm: npm</span>
<span class="logstrip-tool-pill">:fontawesome-brands-rust: Cargo</span>
<span class="logstrip-tool-pill">:simple-gradle: Gradle</span>
<span class="logstrip-tool-pill">:simple-webpack: Webpack</span>
<span class="logstrip-tool-pill">:simple-fastify: Fastify</span>
<span class="logstrip-tool-pill">:simple-nestjs: NestJS</span>
<span class="logstrip-tool-pill">:simple-react: React Native</span>
<span class="logstrip-tool-pill">:simple-flutter: Flutter</span>
<span class="logstrip-tool-pill">:simple-vercel: Vercel</span>
<span class="logstrip-tool-pill">:simple-argo: Argo</span>
<span class="logstrip-tool-pill">:fontawesome-brands-golang: Go test</span>
<span class="logstrip-tool-pill">:simple-pnpm: pnpm</span>
<span class="logstrip-tool-pill">:simple-cypress: Cypress</span>
<span class="logstrip-tool-pill">:simple-bun: Bun</span>
<span class="logstrip-tool-pill">:simple-apachemaven: Maven</span>
<span class="logstrip-tool-pill">:simple-electron: Electron</span>
<span class="logstrip-tool-pill">:simple-bazel: Bazel</span>
<span class="logstrip-tool-pill">:simple-tekton: Tekton</span>
<span class="logstrip-tool-pill">:fontawesome-brands-yarn: yarn</span>
</div>

<div class="logstrip-ecosystem-marquee__rows" data-logstrip-marquee-rows></div>

<p class="logstrip-sources-banner__more"><a href="reference/sources/">view all 705+ sources →</a></p>
</div>

<div class="logstrip-grid" markdown="1">
<div class="logstrip-card" data-logstrip-reveal data-delay="1" markdown="1">
<span class="logstrip-metric">npm i -g logstrip</span>

### one install away

Installs one CLI with two aliases: `logstrip` (short) and `logstrip` (explicit). Same behavior, same binary, zero runtime dependencies on the hot path.
</div>

<div class="logstrip-card" data-logstrip-reveal data-delay="2" markdown="1">
<span class="logstrip-metric">stream</span>

### gigabyte-safe

Built on Node streams and `readline`, so multi-gigabyte logs never have to fit in memory.
</div>

<div class="logstrip-card" data-logstrip-reveal data-delay="3" markdown="1">
<span class="logstrip-metric">100/100</span>

### coverage gate

Statement, branch, function, and line coverage are pinned to 100% across the parser, CLI, and Action.
</div>

<div class="logstrip-card" data-logstrip-reveal data-delay="4" markdown="1">
<span class="logstrip-metric">unix</span>

### pipe-native

`cat raw.log | logstrip > clean.log`. Stats on stderr, JSON on stdout (with `--output`), exit codes 0/1/2.
</div>
</div>

<section class="logstrip-engine" data-logstrip-reveal markdown="1">
<p class="logstrip-kicker">hybrid context engine</p>

## advanced detection, not regex-only filtering

LogStrip scores each sanitized line, keeps nearby context, dampens repeated spam, folds near-identical diagnostics with volatile values, and hides internal framework frames: compact incident narrative, not a noisy transcript.

<div class="logstrip-engine__grid" markdown="1">
<div class="logstrip-engine__step" markdown="1"><span>01</span>**Score signals** from log level, JSON severity, container failures, scanner findings, package managers, diagnostic keywords, and stack frames.</div>
<div class="logstrip-engine__step" markdown="1"><span>02</span>**Promote context** with a before/after window so setup lines near the failure survive even when they are not errors themselves.</div>
<div class="logstrip-engine__step" markdown="1"><span>03</span>**Dampen repeats** with TF-IDF-style frequency tracking, then fold adjacent diagnostic variants into `[xN]` summaries.</div>
<div class="logstrip-engine__step" markdown="1"><span>04</span>**Summarize deltas** by listing only differing `key=value` values when repeated events share the same shape.</div>
<div class="logstrip-engine__step" markdown="1"><span>05</span>**Collapse internals** by replacing low-value framework/runtime stack frames with one marker while preserving app frames.</div>
<div class="logstrip-engine__step" markdown="1"><span>06</span>**Detect sources** across 700+ ecosystems so JSON reports can tell agents what kind of log they are reading.</div>
</div>
</section>

## why LogStrip exists

DevOps, SysOps, and GitOps teams often paste entire raw logs into AI agents during incident response. LLMs are bad at high-noise dumps. <span class="logstrip-accent-shift">LogStrip eases that pain and reduces token costs.</span>

<div class="logstrip-grid" markdown="1">
<div class="logstrip-card" data-logstrip-reveal data-delay="1" markdown="1">
<span class="logstrip-metric">problem</span>

### too much noise

Raw logs mix signal with thousands of low-value lines and repeated frames.
</div>

<div class="logstrip-card" data-logstrip-reveal data-delay="2" markdown="1">
<span class="logstrip-metric">impact</span>

### weaker ai answers

Large noisy prompts dilute root-cause context and inflate LLM spend.
</div>

<div class="logstrip-card" data-logstrip-reveal data-delay="3" markdown="1">
<span class="logstrip-metric">outcome</span>

### compact signal

LogStrip produces deterministic, AI-ready logs that are cheaper to analyze.
</div>
</div>


### validation that catches regressions

<div class="logstrip-grid" markdown="1">
<div class="logstrip-card" data-logstrip-reveal data-delay="1" markdown="1"><span class="logstrip-metric">snapshots</span>Golden outputs lock down exact compression behavior, including sanitization, duplicate-shaped grouping, context windows, and hidden internal frames.</div>
<div class="logstrip-card" data-logstrip-reveal data-delay="2" markdown="1"><span class="logstrip-metric">smoke corpus</span>Fixtures cover noisy server logs, CI failures, scanner findings, container crashes, Spring Boot stacks, nginx upstream failures, and Node runtime crashes.</div>
<div class="logstrip-card" data-logstrip-reveal data-delay="3" markdown="1"><span class="logstrip-metric">100%</span>TypeScript units and smoke tests run under a strict **100/100/100/100** coverage gate before release.</div>
</div>

### why teams keep it in every pipeline

<div class="logstrip-grid" markdown="1">
<div class="logstrip-card" data-logstrip-reveal data-delay="1" markdown="1"><span class="logstrip-metric">ops-first</span>Built for incident workflows where raw logs hit AI assistants under pressure.</div>
<div class="logstrip-card" data-logstrip-reveal data-delay="2" markdown="1"><span class="logstrip-metric">700+</span>Automatic source awareness across CI, runtimes, scanners, infra, and cloud logs.</div>
<div class="logstrip-card" data-logstrip-reveal data-delay="3" markdown="1"><span class="logstrip-metric">deterministic</span>Snapshot-tested output and a strict **100/100/100/100** quality gate.</div>
<div class="logstrip-card" data-logstrip-reveal data-delay="4" markdown="1"><span class="logstrip-metric">cheaper prompts</span>Lower token usage per incident while keeping root-cause context intact.</div>
</div>

<div class="logstrip-agents-strip" data-logstrip-reveal>
  <span class="logstrip-agents-strip__label">plugins for every listed agent</span>
  <div class="logstrip-agents-strip__logos">
    <a class="logstrip-agent-logo" title="Claude Code" href="guides/plugins/#claude-code"><img src="assets/images/logo-claude-code.svg" alt="Claude Code"></a>
    <a class="logstrip-agent-logo" title="Droid" href="guides/plugins/#factory-droid"><img src="assets/images/logo-droid.png" alt="Droid"></a>
    <a class="logstrip-agent-logo" title="Copilot" href="guides/plugins/#github-copilot"><img src="assets/images/logo-copilot.svg" alt="Copilot"></a>
    <a class="logstrip-agent-logo" title="Cursor" href="guides/plugins/#cursor"><img src="assets/images/logo-cursor.svg" alt="Cursor"></a>
    <a class="logstrip-agent-logo" title="Codex" href="guides/plugins/#codex"><img src="assets/images/logo-codex.png" alt="Codex"></a>
    <a class="logstrip-agent-logo" title="OpenCode" href="guides/plugins/#opencode"><img src="assets/images/logo-opencode.png" alt="OpenCode"></a>
  </div>
  <a class="logstrip-button" href="guides/plugins/">install for your agent</a>
</div>

## cli in one line

`logstrip` and `logstrip` are two command names for the same CLI executable.

```bash
logstrip raw.log -o clean.log --stats
```

The CLI writes the compressed log to `clean.log` and a short stats block to
`stderr`. Stdin and stdout are supported too:

```bash
cat raw.log | logstrip > clean.log
```

You can also run it instantly without installation via `npx`:

```bash
npx -y logstrip raw.log -o clean.log --stats
```

Run `logstrip --help` for every flag, or read the [CLI reference](reference/cli.md).

## optional: github action

When you would rather not call the CLI from a `run:` step, the same parser is
exposed as a thin GitHub Action wrapper:

```yaml
- name: Compress logs with LogStrip
  uses: mrwogu/logstrip@v1
  id: logstrip
  with:
    log-path: raw_logs.txt
    aggressiveness: high
```

The action writes `steps.logstrip.outputs.output-path` and a GitHub Step Summary
with estimated input tokens, output tokens, and savings.

## next steps

- [Getting Started](getting-started.md)
- [CLI Reference](reference/cli.md)
- [Core TypeScript API](reference/core.md)
- [GitHub Action](reference/action.md)
- [Plugin Installation](guides/plugins.md)
- [Workflow Examples](examples/index.md)
