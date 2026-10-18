# Release notes

## 2.4.0

This release makes the importer faster and fixes several problems that were
reported by teams running it in continuous integration.

### Highlights

- The importer now streams large archives instead of loading them into memory.
- Failed uploads are retried three times with an increasing delay.
- A new `--dry-run` flag prints what would change without touching the server.

### Fixes

- Fixed a crash when the archive contained a file name with a trailing dot.
- Fixed a timeout error that appeared when the server answered slowly.
- The progress bar no longer flickers in terminals that do not support colors.

### Upgrading

Run the migration once before the first start:

```bash
npm install --save-dev @example/importer@2.4.0
npx importer migrate --config importer.config.json
```

If the migration reports `ERROR: schema mismatch`, restore the backup and
open an issue. See [the troubleshooting guide](https://example.com/troubleshooting)
for the details.

| Version | Node.js | Notes                         |
| ------- | ------- | ----------------------------- |
| 2.4.x   | >= 20   | Streaming importer            |
| 2.3.x   | >= 18   | Last release with the old API |

> The 2.3 branch only receives security fixes from now on.
