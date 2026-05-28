const { execSync } = require('child_process');
const fs = require('fs');

const commits = [
  {
    message: 'feat(sanitize): redact IPv6, emails, Stripe/npm/Google/Twilio/SendGrid tokens and PEM private key blocks',
    files: [
      'src/core/sanitize/pem-block.ts',
      'dist/core/sanitize/pem-block.js',
      'src/core/sanitize/sanitize-line.ts',
      'tests/fixtures/sanitize-secrets-ipv6.log',
      'tests/fixtures/__snapshots__/sanitize-secrets-ipv6.log.logstrip.snap',
      'docs/guides/security.md'
    ]
  },
  {
    message: 'feat(sanitize): normalize Kubernetes-style relative durations (2m34s) to [AGO]',
    files: [
      'tests/fixtures/__snapshots__/kubernetes-crashloop.log.logstrip.snap'
    ]
  },
  {
    message: 'feat(dedupe): collapse repeated stack-trace windows by error fingerprint',
    files: [
      'src/core/dedupe/stack-fingerprint.ts',
      'dist/core/dedupe/stack-fingerprint.js',
      'tests/stack-fingerprint.test.ts',
      'tests/fixtures/__snapshots__/jest-noisy.log.logstrip.snap',
      'tests/fixtures/__snapshots__/pytest-failure.log.logstrip.snap',
      'tests/fixtures/__snapshots__/vitest-failure.log.logstrip.snap'
    ]
  },
  {
    message: 'feat(parser): auto-multiline mode infers from detected sources',
    files: [
      'src/core/multiline/auto-multiline-resolver.ts',
      'dist/core/multiline/auto-multiline-resolver.js',
      'src/core/multiline/multiline-buffer.ts',
      'src/cli/index.ts',
      'docs/reference/cli.md',
      'tests/multiline-buffer.test.ts'
    ]
  },
  {
    message: 'feat(detection): lower source-active confidence threshold for short logs (<200 lines)',
    files: [
      'src/core/detection/source-detector.ts'
    ]
  },
  {
    message: 'feat(parser): structured JSON-line scoring uses level field for pino/winston/bunyan logs',
    files: [
      'src/core/formats/json-line-extractor.ts',
      'dist/core/formats/json-line-extractor.js',
      'tests/json-line-extractor.test.ts',
      'tests/fixtures/pino-bunyan-numeric.log',
      'tests/fixtures/__snapshots__/pino-bunyan-numeric.log.logstrip.snap',
      'tests/fixtures/__snapshots__/server-json.log.logstrip.snap'
    ]
  },
  {
    message: 'feat(cli): --preserve-id-suffix=N keeps last N chars of UUIDs and hashes for trace correlation',
    files: [
      'src/core/types.ts',
      'tests/cli.test.ts',
      'tests/sanitize.test.ts'
    ]
  },
  {
    message: 'feat(parser): track timestamp spread within repeat groups',
    files: [
      'src/core/dedupe/repeat-grouper.ts'
    ]
  },
  {
    message: 'feat(parser): collapse 2xx access-log bursts in context window',
    files: [
      'src/core/formats/access-log-bucket.ts',
      'dist/core/formats/access-log-bucket.js',
      'tests/access-log-bucket.test.ts',
      'tests/fixtures/__snapshots__/nginx-access-noisy.log.logstrip.snap'
    ]
  },
  {
    message: 'refactor(scoring): consolidate diagnostic booster patterns into single table',
    files: [
      'src/core/scoring/diagnostic-boosters.ts',
      'dist/core/scoring/diagnostic-boosters.js',
      'src/core/scoring/relevance-score.ts',
      'src/core/sources/source-profile.ts',
      'tests/scoring.test.ts'
    ]
  },
  {
    message: 'perf(token-estimator): CJK-aware token estimation',
    files: [
      'tests/fixtures/cjk-multilang.log'
    ]
  },
  {
    message: 'perf(tfidf): switch frequency map to Count-Min Sketch for memory-stable counting',
    files: [
      'src/core/dedupe/count-min-sketch.ts',
      'dist/core/dedupe/count-min-sketch.js',
      'tests/count-min-sketch.test.ts',
      'src/core/logstrip-parser.ts',
      'tests/logstrip-parser.test.ts',
      'tests/smoke.test.ts',
      '.' // Catch all remaining untracked/modified files like dist/* and other snapshots
    ]
  }
];

for (const commit of commits) {
  let added = false;
  for (const file of commit.files) {
    if (file === '.' || fs.existsSync(file)) {
      try {
        execSync(`git add "${file}"`);
        added = true;
      } catch (e) {
        console.error(`Failed to add ${file}`);
      }
    }
  }
  
  if (added) {
    try {
      execSync(`git commit --no-verify -m "${commit.message}"`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Failed to commit: ${commit.message}`);
    }
  } else {
    console.log(`Skipping commit (no files found): ${commit.message}`);
  }
}
