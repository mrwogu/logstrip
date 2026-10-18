## Description

What does this change and why?

## Related Issue

Fixes #(issue number)

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (CLI flags, exit codes, `action.yml` inputs or outputs, or the library API)
- [ ] Documentation, tooling or CI only

## Checklist

- [ ] The PR title follows Conventional Commits, for example `fix(core): stop secret mask at quotes`
- [ ] `npm run typecheck` passes
- [ ] `npm run test:coverage` passes and the 100% coverage thresholds are unchanged
- [ ] `npm run build`, `npm run smoke:cli` and `npm run smoke:hooks` pass
- [ ] `dist/` is not part of this PR (it is ignored on main and built on release tags)
- [ ] New or changed fixtures have realistic `minSavingsPercent` and `mustContain` / `mustNotContain` assertions, and snapshot diffs were regenerated with `vitest -u` and reviewed
- [ ] CLI flag changes are reflected in `docs/reference/cli.md` and `README.md` (`npm run docs:check` passes)
- [ ] No new runtime dependencies in `src/cli` or `src/core`
- [ ] Logs, fixtures and screenshots in this PR contain no real secrets, tokens or personal data

## Additional Notes
