# Changelog

## [1.1.0](https://github.com/mrwogu/logstrip/compare/v1.0.0...v1.1.0) (2026-05-19)


### Features

* add PreToolUse/UserPromptSubmit hooks for auto-activating LogStrip on log content ([16b8c7c](https://github.com/mrwogu/logstrip/commit/16b8c7c5d1b22affbe8b32dee87d90b4996d309a))


### Bug Fixes

* add logstrip wrapper to PATH in hook tests for CI ([3682625](https://github.com/mrwogu/logstrip/commit/368262597eca809f1b61c5c5e456ae2caa4998ee))
* use POSIX ERE [0-9] instead of \d in hook grep patterns, skip hook tests on Windows ([56e538d](https://github.com/mrwogu/logstrip/commit/56e538d2c80d2eb11c623d8478ad486c85024960))

## 1.0.0 (2026-05-19)


### Features

* add brand assets, agent logos, and stat badges ([186fad0](https://github.com/mrwogu/logstrip/commit/186fad0d3847b59bc7ce0d27406001513e79fe42))
* add streaming log parser, CLI, GitHub Action, and custom config engine ([9c42150](https://github.com/mrwogu/logstrip/commit/9c42150f3796619a1a056765e6b996a50a552649))


### Bug Fixes

* add NODE_AUTH_TOKEN to publish step for npm authentication ([e6fecb8](https://github.com/mrwogu/logstrip/commit/e6fecb834f239ff488aa99706ea5c8c5e176bbd7))
* remove broken npm self-upgrade step from release workflow ([c51cd18](https://github.com/mrwogu/logstrip/commit/c51cd18494558deb6244a248a767c6cf3f2c706d))
* remove broken npm self-upgrade step from release workflow ([e17536b](https://github.com/mrwogu/logstrip/commit/e17536b0858f36354a29b3efeea141ef5819f9b2))
* revert release 1.0.0 + add NPM_TOKEN auth for publish ([a12da74](https://github.com/mrwogu/logstrip/commit/a12da74f6c463e7994b5773ba452857e49c10492))


### Reverts

* reset release-please manifest to 0.0.0 ([993b3e4](https://github.com/mrwogu/logstrip/commit/993b3e4e999f9d422217c66589933d08f7819642))
