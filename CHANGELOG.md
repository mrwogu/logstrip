# Changelog

## [1.5.0](https://github.com/mrwogu/logstrip/compare/v1.4.0...v1.5.0) (2026-05-21)


### Features

* add 'auto' aggressiveness to CLI and action, update tests and snapshots ([0ce8265](https://github.com/mrwogu/logstrip/commit/0ce8265309cb463bc00ae8e2abb6810a0a775335))
* add brand assets, agent logos, and stat badges ([186fad0](https://github.com/mrwogu/logstrip/commit/186fad0d3847b59bc7ce0d27406001513e79fe42))
* add CI noise filters for progress bars, timestamp-only, K8s Normal, rate-limited ([16dc859](https://github.com/mrwogu/logstrip/commit/16dc8592ae06b536720b84f4c77d9aced9ad04ba))
* add CLI flags --include, --exclude, --sample, --max-line-length, --timeout, --progress ([5d24036](https://github.com/mrwogu/logstrip/commit/5d2403663eeeff17b3f4169b33e276e54ea6f46f))
* add Copilot marketplace plugin and fix agent descriptions in README ([7a85535](https://github.com/mrwogu/logstrip/commit/7a85535c50524768e3254efedb40ce04655f351c))
* add enhanced secret masking for GitHub, JWT, Slack, connection strings ([754af87](https://github.com/mrwogu/logstrip/commit/754af8731a2a2bc0bfc18eee6b074c544c371d54))
* add local telemetry tracking for cumulative token savings ([7d658ba](https://github.com/mrwogu/logstrip/commit/7d658ba4b3aa6cda7a21c8bc7bfea2a6fe69f88c))
* add log format detection and HTTP status code grouping ([d26b7e6](https://github.com/mrwogu/logstrip/commit/d26b7e638baf8778860d8901ccaba7b14f371e5d))
* add multiline log handling (-m flag) ([078922f](https://github.com/mrwogu/logstrip/commit/078922f6e7dc3904595077d5fc72fc2b07b7da79))
* add PreToolUse/UserPromptSubmit hooks for auto-activating LogStrip on log content ([16b8c7c](https://github.com/mrwogu/logstrip/commit/16b8c7c5d1b22affbe8b32dee87d90b4996d309a))
* add severity filtering (--severity flag) ([f1da1ad](https://github.com/mrwogu/logstrip/commit/f1da1adf14ecebfcb350db0a90ee49084d005ee2))
* add streaming log parser, CLI, GitHub Action, and custom config engine ([9c42150](https://github.com/mrwogu/logstrip/commit/9c42150f3796619a1a056765e6b996a50a552649))
* change default aggressiveness from 'high' to 'auto' across all surfaces ([08654f4](https://github.com/mrwogu/logstrip/commit/08654f481dc88e980533de64a028a55ba781dc67))
* wire telemetry into CLI, add --telemetry flag, export from library, add docs ([4eabc64](https://github.com/mrwogu/logstrip/commit/4eabc64c0307c15e340eeff609c6249cd8c3418f))


### Bug Fixes

* add .js extension to dynamic import in cli test for node16 moduleResolution ([c01cd46](https://github.com/mrwogu/logstrip/commit/c01cd468af3168c8a8e7a0284ea01526c51378fa))
* add logstrip wrapper to PATH in hook tests for CI ([3682625](https://github.com/mrwogu/logstrip/commit/368262597eca809f1b61c5c5e456ae2caa4998ee))
* add NODE_AUTH_TOKEN to publish step for npm authentication ([e6fecb8](https://github.com/mrwogu/logstrip/commit/e6fecb834f239ff488aa99706ea5c8c5e176bbd7))
* correct secret masking test inputs and regex patterns for CI ([d0b71a5](https://github.com/mrwogu/logstrip/commit/d0b71a57aedc8c43d729aea4f37c3f78e5760d08))
* force forward slashes in architecture test for Windows CI ([172838b](https://github.com/mrwogu/logstrip/commit/172838ba8a708fffa68c5c8f9e73033578e6adb5))
* harden regexes against ReDoS with bounded quantifiers and unicode flags ([e0d3fdc](https://github.com/mrwogu/logstrip/commit/e0d3fdc58db9a4bd6f5d32a62bac855b8732d555))
* normalize path separators in architecture test for Windows CI ([e80f260](https://github.com/mrwogu/logstrip/commit/e80f2604e7d25c15530ef8ad9859d0060e033ac4))
* remove broken npm self-upgrade step from release workflow ([c51cd18](https://github.com/mrwogu/logstrip/commit/c51cd18494558deb6244a248a767c6cf3f2c706d))
* remove broken npm self-upgrade step from release workflow ([e17536b](https://github.com/mrwogu/logstrip/commit/e17536b0858f36354a29b3efeea141ef5819f9b2))
* reset 1.2.0 for final OIDC attempt with corrected npmjs trusted publisher config ([57d3f79](https://github.com/mrwogu/logstrip/commit/57d3f79e76d98759d8cb62abd44cc052ea818fd9))
* reset 1.2.0 for third OIDC attempt, use Node 24 (npm 11) instead of broken npm upgrade ([f8ffff4](https://github.com/mrwogu/logstrip/commit/f8ffff40d20d3d43667c3a8f9694d678a09a5cd4))
* reset 1.2.0 release for OIDC, fix repo URL for trusted publishing, add npm upgrade step ([2d4e4fe](https://github.com/mrwogu/logstrip/commit/2d4e4fe473792a12095ec0c64003d3b02d11f257))
* revert release 1.0.0 + add NPM_TOKEN auth for publish ([a12da74](https://github.com/mrwogu/logstrip/commit/a12da74f6c463e7994b5773ba452857e49c10492))
* use POSIX ERE [0-9] instead of \d in hook grep patterns, skip hook tests on Windows ([56e538d](https://github.com/mrwogu/logstrip/commit/56e538d2c80d2eb11c623d8478ad486c85024960))
* use vi.hoisted for telemetry env var in CLI tests ([d09f482](https://github.com/mrwogu/logstrip/commit/d09f4827f26cc5d6c74094dcd56c139cda008e70))


### Reverts

* reset release-please manifest to 0.0.0 ([993b3e4](https://github.com/mrwogu/logstrip/commit/993b3e4e999f9d422217c66589933d08f7819642))

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
