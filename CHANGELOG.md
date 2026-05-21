# Changelog

## [1.4.0](https://github.com/mrwogu/logstrip/compare/v1.3.0...v1.4.0) (2026-05-21)


### Features

* wire telemetry into CLI, add --telemetry flag, export from library, add docs ([4eabc64](https://github.com/mrwogu/logstrip/commit/4eabc64c0307c15e340eeff609c6249cd8c3418f))


### Bug Fixes

* add .js extension to dynamic import in cli test for node16 moduleResolution ([c01cd46](https://github.com/mrwogu/logstrip/commit/c01cd468af3168c8a8e7a0284ea01526c51378fa))
* use vi.hoisted for telemetry env var in CLI tests ([d09f482](https://github.com/mrwogu/logstrip/commit/d09f4827f26cc5d6c74094dcd56c139cda008e70))


### Documentation

* remove fictitious dual-binary alias, document single logstrip CLI entry point ([8f75068](https://github.com/mrwogu/logstrip/commit/8f75068292ac5cb9b38e9e4b4c2dc7bc0bca6a5a))
* replace all em/en dashes with hyphens across docs, plugins, fixtures, and tests ([cc2178b](https://github.com/mrwogu/logstrip/commit/cc2178bdedc9c7ad38f34e0b1f4aef2a7c9aab9f))
* update CLI, core API, and README for v1.3.0 features ([569f21b](https://github.com/mrwogu/logstrip/commit/569f21b2c6df2d3cc8e1c0c9c6b2e9d2f06e7eb4))

## [1.3.0](https://github.com/mrwogu/logstrip/compare/v1.2.0...v1.3.0) (2026-05-21)


### Features

* add CI noise filters for progress bars, timestamp-only, K8s Normal, rate-limited ([16dc859](https://github.com/mrwogu/logstrip/commit/16dc8592ae06b536720b84f4c77d9aced9ad04ba))
* add CLI flags --include, --exclude, --sample, --max-line-length, --timeout, --progress ([5d24036](https://github.com/mrwogu/logstrip/commit/5d2403663eeeff17b3f4169b33e276e54ea6f46f))
* add Copilot marketplace plugin and fix agent descriptions in README ([7a85535](https://github.com/mrwogu/logstrip/commit/7a85535c50524768e3254efedb40ce04655f351c))
* add enhanced secret masking for GitHub, JWT, Slack, connection strings ([754af87](https://github.com/mrwogu/logstrip/commit/754af8731a2a2bc0bfc18eee6b074c544c371d54))
* add local telemetry tracking for cumulative token savings ([7d658ba](https://github.com/mrwogu/logstrip/commit/7d658ba4b3aa6cda7a21c8bc7bfea2a6fe69f88c))
* add log format detection and HTTP status code grouping ([d26b7e6](https://github.com/mrwogu/logstrip/commit/d26b7e638baf8778860d8901ccaba7b14f371e5d))
* add multiline log handling (-m flag) ([078922f](https://github.com/mrwogu/logstrip/commit/078922f6e7dc3904595077d5fc72fc2b07b7da79))
* add severity filtering (--severity flag) ([f1da1ad](https://github.com/mrwogu/logstrip/commit/f1da1adf14ecebfcb350db0a90ee49084d005ee2))


### Bug Fixes

* correct secret masking test inputs and regex patterns for CI ([d0b71a5](https://github.com/mrwogu/logstrip/commit/d0b71a57aedc8c43d729aea4f37c3f78e5760d08))
* harden regexes against ReDoS with bounded quantifiers and unicode flags ([e0d3fdc](https://github.com/mrwogu/logstrip/commit/e0d3fdc58db9a4bd6f5d32a62bac855b8732d555))

## [1.2.0](https://github.com/mrwogu/logstrip/compare/v1.1.0...v1.2.0) (2026-05-20)


### Features

* add 'auto' aggressiveness to CLI and action, update tests and snapshots ([0ce8265](https://github.com/mrwogu/logstrip/commit/0ce8265309cb463bc00ae8e2abb6810a0a775335))
* change default aggressiveness from 'high' to 'auto' across all surfaces ([08654f4](https://github.com/mrwogu/logstrip/commit/08654f481dc88e980533de64a028a55ba781dc67))

## [1.1.0](https://github.com/mrwogu/logstrip/compare/v1.0.0...v1.1.0) (2026-05-19)


### Features

* add PreToolUse/UserPromptSubmit hooks for auto-activating LogStrip on log content ([16b8c7c](https://github.com/mrwogu/logstrip/commit/16b8c7c5d1b22affbe8b32dee87d90b4996d309a))

## 1.0.0 (2026-05-19)


### Features

* add brand assets, agent logos, and stat badges ([186fad0](https://github.com/mrwogu/logstrip/commit/186fad0d3847b59bc7ce0d27406001513e79fe42))
* add streaming log parser, CLI, GitHub Action, and custom config engine ([9c42150](https://github.com/mrwogu/logstrip/commit/9c42150f3796619a1a056765e6b996a50a552649))
