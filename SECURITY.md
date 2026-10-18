# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

Security fixes are released on the latest 1.x line. Upgrade to the newest
release before reporting, in case the problem is already fixed.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub private vulnerability reporting to send a private report:
[Report a vulnerability](https://github.com/mrwogu/logstrip/security/advisories/new).

Please include:

- The LogStrip version (`logstrip --version`) and Node.js version
- The command line, or the action inputs, that trigger the problem
- A minimal log excerpt that reproduces it, with real secrets removed
- The impact you expect and a suggested fix, if you have one

Reports are handled on a best-effort basis. You will get a reply in the
advisory thread, and a fix is released together with a published advisory.

## Scope

In scope:

- The `logstrip` npm package: the CLI, the library and the plugin hook
- The GitHub Action defined by `action.yml`
- The release and CI workflows in this repository

Examples of issues worth reporting:

- A secret, token or personal-data pattern that the sanitizer fails to mask
- Crafted input that causes catastrophic regex backtracking or unbounded
  memory use in a streaming run
- Writes outside the requested output path
- A weakness in the release pipeline, such as a way to publish or retag
  without authorization

Out of scope:

- Vulnerabilities in third-party dependencies with no impact on LogStrip
  (report those upstream)
- The content of the logs you process

## Security Updates

Fixes are announced through:

- [GitHub Security Advisories](https://github.com/mrwogu/logstrip/security/advisories)
- The release notes in [CHANGELOG.md](CHANGELOG.md)
