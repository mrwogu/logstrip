---
title: Benchmarks
description: Measured token savings for every LogStrip test fixture, how the numbers are produced, what they do not tell you, and how to reproduce them with one command.
---
# Benchmarks

These are the token savings LogStrip measures on its own test fixtures. We
publish every row, including the weak ones, and we say what the numbers can and
cannot tell you. The table is generated from the parser, not typed by hand.

<!-- bench:summary:start -->
- Fixtures: 51
- Lines: 4,433 in, 1,922 out
- Tokens: 42,705 in, 20,805 out, 51.3% saved
- Per-fixture savings: median 42.0%, lowest 16.7%, highest 87.2%
- Measured with LogStrip 1.12.0
<!-- bench:summary:end -->

Savings are `1 - output tokens / input tokens`. A fixture that goes from 284
tokens to 63 saves 77.8%.

## What we measure

- **Fixtures.** Every `tests/fixtures/*.log` file in the repository, 50 in
  all. They are small, written by us, and covered by committed snapshot tests.
  None is a production log.
- **Run.** Each fixture goes through the parser once with default options, the
  same as `logstrip <file>`. No flags, no tuning per fixture.
- **Tokens.** LogStrip's own estimate: whitespace-separated words times 1.3.
  It is the number `--stats` prints. It is not a model tokenizer, so real
  counts differ by model. Lines full of paths, hashes and identifiers usually
  cost more real tokens than the estimate says.
- **Deterministic.** The same fixtures and the same parser give the same table.
  The page holds no timings, because those depend on the machine.

## Results

Two groups. Single-tool logs are one tool and one failure story, which is
closest to what you paste into a chat. Multi-tool samples mix a few lines from
many tools. We wrote them to test source detection, so they hold little
repetition to fold.

<!-- bench:groups:start -->
| Group | Fixtures | Input tokens | Output tokens | Savings | Median per fixture |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Single-tool logs | 25 | 6,672 | 3,245 | 51.4% | 44.2% |
| Multi-tool samples | 26 | 36,033 | 17,560 | 51.3% | 41.8% |
<!-- bench:groups:end -->

## Reading the results

- **Chatter compresses best.** The top of the table is logs that are mostly
  `INFO` and `DEBUG` lines, download progress, or passing tests around one
  failure: `apache-httpd-noisy`, `docker-build`, `jest-noisy`,
  `maven-downloads-failure`. Those lines carry little diagnostic value, and the
  error is a small share of the file.
- **Failure-only logs compress least.** `kubernetes-crashloop` is a few routine
  events followed by warnings and a panic with its stack, so there is little to
  drop. Short logs where most lines are errors, such as `server-json`, behave
  the same way. LogStrip keeps what carries a diagnosis, and here that is most
  of the file.
- **Repeats pay off when they exist.** Folding `[xN]`, hiding internal library
  frames and referencing repeated blocks only help when a log repeats itself.
  The fixtures are short, so they show less of this than a log with thousands
  of identical retries would.
- **Multi-tool samples sit in the middle.** One or two lines per tool means few
  duplicates. Savings come mostly from dropping routine levels.
- **One fixture dominates the token totals.** `all-sources-detection` is more
  than half of all input tokens, so the overall figure leans on it. The median
  per fixture is the more honest single number.

## What these numbers do not tell you

- **They are not a promise for your logs.** A 50,000-line CI log can save more
  or less than a 40-line fixture. Run `--stats` on yours.
- **They do not measure answer quality.** We count tokens, not whether an agent
  diagnoses the failure faster. The design goal is to keep the diagnostic lines,
  and the snapshot tests pin what is kept, but that is not a quality benchmark.
- **They do not compare tools.** We did not run other compressors on these
  fixtures. See [Compare](compare.md) for what we can say about each category
  without inventing numbers.
- **The estimate is rough.** If you need exact token counts, pass your own
  tokenizer through the `tokenEstimator` option of the [library](reference/core.md).

## Every fixture

Sorted by savings, best first.

<!-- bench:fixtures:start -->
| Fixture | Group | Lines in / out | Input tokens | Output tokens | Savings |
| :--- | :--- | ---: | ---: | ---: | ---: |
| `apache-httpd-noisy` | Single-tool | 30 / 4 | 485 | 62 | 87.2% |
| `docker-build` | Single-tool | 26 / 4 | 309 | 64 | 79.3% |
| `jest-noisy` | Single-tool | 47 / 8 | 284 | 63 | 77.8% |
| `maven-downloads-failure` | Single-tool | 13 / 3 | 124 | 32 | 74.2% |
| `java-spring-boot-realistic` | Single-tool | 25 / 10 | 305 | 95 | 68.8% |
| `vitest-failure` | Single-tool | 43 / 14 | 257 | 91 | 64.6% |
| `python-worker-logging` | Single-tool | 28 / 14 | 379 | 154 | 59.4% |
| `go-logfmt-service` | Single-tool | 15 / 5 | 163 | 67 | 58.9% |
| `ci-platforms` | Multi-tool | 57 / 24 | 537 | 228 | 57.5% |
| `all-sources-detection` | Multi-tool | 2,115 / 705 | 23,355 | 10,303 | 55.9% |
| `cloud-serverless` | Multi-tool | 32 / 12 | 392 | 175 | 55.4% |
| `go-test-verbose` | Single-tool | 18 / 9 | 82 | 39 | 52.4% |
| `terraform-ansible-systemd` | Multi-tool | 41 / 16 | 454 | 216 | 52.4% |
| `data-search-analytics` | Multi-tool | 147 / 65 | 1,167 | 565 | 51.6% |
| `json-test-report` | Single-tool | 165 / 106 | 1,044 | 505 | 51.6% |
| `go-rust-ruby-frameworks` | Multi-tool | 74 / 36 | 583 | 297 | 49.1% |
| `pytest-failure` | Single-tool | 36 / 16 | 293 | 149 | 49.1% |
| `maven-failure` | Single-tool | 41 / 15 | 286 | 149 | 47.9% |
| `java-enterprise` | Multi-tool | 47 / 26 | 338 | 181 | 46.5% |
| `build-toolchains` | Multi-tool | 70 / 38 | 595 | 332 | 44.2% |
| `node-crash-realistic` | Single-tool | 24 / 13 | 181 | 101 | 44.2% |
| `auth-secrets-config` | Multi-tool | 64 / 35 | 578 | 329 | 43.1% |
| `ecosystem-signals-realistic` | Multi-tool | 44 / 27 | 415 | 238 | 42.6% |
| `mocha-spec-failure` | Single-tool | 45 / 24 | 236 | 136 | 42.4% |
| `email-ci-infra` | Multi-tool | 89 / 48 | 738 | 427 | 42.1% |
| `backup-docs-messaging` | Multi-tool | 95 / 50 | 783 | 454 | 42.0% |
| `observability-analytics` | Multi-tool | 71 / 38 | 580 | 337 | 41.9% |
| `data-telemetry-scanners` | Multi-tool | 23 / 11 | 211 | 123 | 41.7% |
| `ai-ml-ecosystem` | Multi-tool | 62 / 37 | 528 | 311 | 41.1% |
| `pino-bunyan-numeric` | Single-tool | 12 / 4 | 82 | 49 | 40.2% |
| `networking-edge-serverless` | Multi-tool | 54 / 32 | 457 | 275 | 39.8% |
| `python-lint-async` | Multi-tool | 50 / 27 | 440 | 266 | 39.5% |
| `mobile-desktop-cms` | Multi-tool | 96 / 52 | 739 | 450 | 39.1% |
| `realtime-graphql` | Multi-tool | 53 / 30 | 433 | 268 | 38.1% |
| `nginx-access-noisy` | Single-tool | 16 / 10 | 380 | 236 | 37.9% |
| `orm-db-migrations` | Multi-tool | 65 / 38 | 526 | 331 | 37.1% |
| `security-scanners` | Multi-tool | 88 / 57 | 662 | 420 | 36.6% |
| `build-test-systems` | Multi-tool | 48 / 34 | 240 | 153 | 36.3% |
| `polyglot-stacks` | Single-tool | 64 / 41 | 390 | 249 | 36.1% |
| `nginx-502-burst` | Single-tool | 11 / 6 | 258 | 168 | 34.9% |
| `iot-game-embedded` | Multi-tool | 53 / 32 | 427 | 284 | 33.5% |
| `node-repeated-stack` | Single-tool | 29 / 17 | 215 | 145 | 32.6% |
| `web-frameworks-node` | Multi-tool | 60 / 31 | 478 | 322 | 32.6% |
| `infra-cloud` | Multi-tool | 16 / 7 | 182 | 124 | 31.9% |
| `scanner-vulnerability` | Single-tool | 12 / 8 | 107 | 73 | 31.8% |
| `webpack-bundle` | Single-tool | 27 / 20 | 267 | 194 | 27.3% |
| `secret-fields` | Single-tool | 22 / 14 | 250 | 188 | 24.8% |
| `sanitize-secrets-ipv6` | Single-tool | 17 / 11 | 102 | 77 | 24.5% |
| `ci-pkg-managers` | Multi-tool | 24 / 16 | 195 | 151 | 22.6% |
| `server-json` | Single-tool | 11 / 7 | 43 | 34 | 20.9% |
| `kubernetes-crashloop` | Single-tool | 18 / 15 | 150 | 125 | 16.7% |
<!-- bench:fixtures:end -->

## Reproduce it

You need Node.js 22+ and a clone of the repository.

```bash
git clone https://github.com/mrwogu/logstrip
cd logstrip
npm ci
npm run build
npm run bench        # per-fixture table with drop reasons and timings
npm run docs:bench   # rewrites this table, the homepage numbers, the README and its badges
```

`npm run bench` accepts a name filter, for example `npm run bench -- jest`.
`npm run docs:bench -- --check` exits with an error when the committed numbers
are stale. CI runs it after the build, so a change to a fixture or to the parser
needs `npm run docs:bench` in the same pull request.

To measure your own log:

```bash
logstrip raw.log -o clean.log --stats
```

## Related

- [Why LogStrip](why-logstrip.md) - what it keeps, what it drops, and when not
  to use it.
- [Compression Flow](guides/compression-flow.md) - the steps that produce these
  numbers.
- [Compare](compare.md) - LogStrip next to the other things people try.
