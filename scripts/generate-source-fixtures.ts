#!/usr/bin/env node
/**
 * Generates per-source fixture files under tests/fixtures/sources/.
 * Each file contains realistic log lines that exercise the source's
 * primary marker plus noise that should be filtered.
 *
 * Usage: node scripts/generate-source-fixtures.ts
 *        (or: npx tsx scripts/generate-source-fixtures.ts)
 *
 * The output is deterministic — running the script again produces
 * identical fixtures. Commit the results and regenerate only when
 * adding new sources to LOG_SOURCE_SIGNATURES.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOG_SOURCE_SIGNATURES,
  type Aggressiveness,
} from '../src/core/bonsai-parser';

const FIXTURES_DIR = join(
  import.meta.dirname ?? __dirname,
  '..',
  'tests',
  'fixtures',
  'sources',
);

// Templates per category hint. Each template produces 3-8 realistic
// lines that include INFO/DEBUG noise (to be filtered) and ERROR/FATAL
// diagnostic lines (to be kept).
const TEMPLATES: Record<
  string,
  (source: string, markers: readonly string[]) => string[]
> = {
  // ── Generic fallback ────────────────────────────────────────────
  _default(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} initialized successfully`,
      `[DEBUG] ${m} configuration loaded`,
      `[DEBUG] ${m} processing event on worker-1`,
      `[ERROR] ${m} Error: operation failed for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 from 10.42.7.18:54321`,
      `[ERROR] ${m} Error: operation failed for request 018f23ab-7c1d-7f44-8bfe-0acddaf33457 from 10.42.7.18:54322`,
      `[FATAL] ${m} FATAL: unrecoverable error - aborting commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Web frameworks ──────────────────────────────────────────────
  web(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} server listening on port 3000`,
      `[DEBUG] ${m} middleware registered: cors, auth, logging`,
      `[DEBUG] ${m} route GET /api/health responded 200 in 12ms`,
      `[ERROR] ${m} Error: Cannot find module '@company/auth'`,
      `    at internalRequire (/srv/node_modules/${source}/lib/router/index.js:42:15)`,
      `    at Module._compile (node:internal/modules/cjs/loader:1105:14)`,
      `[ERROR] ${m} Error: request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 failed on POST /api/checkout from 10.42.7.18:54321`,
      `[ERROR] ${m} Error: request 018f23ab-7c1d-7f44-8bfe-0acddaf33457 failed on POST /api/checkout from 10.42.7.18:54322`,
      `[FATAL] ${m} worker crashed with signal SIGABRT after uncaught exception commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Logging libraries ────────────────────────────────────────────
  logging(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} logger initialized with level=info`,
      `[DEBUG] ${m} transport configured: file, console`,
      `[ERROR] ${m} FATAL: Cannot write to log file /var/log/app/server.log`,
      `[ERROR] ${m} transport error: connection refused to 10.90.12.41:514`,
      `[ERROR] ${m} buffer overflow: 42000 messages dropped for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} out of memory during log rotation commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Testing ─────────────────────────────────────────────────────
  testing(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} test suite started: 42 tests`,
      `[DEBUG] ${m} test file: tests/integration/checkout.test.ts`,
      `[DEBUG] ${m} test file: tests/unit/payments.test.ts`,
      `[ERROR] ${m} FAILED tests/test_orders.py::test_create_order`,
      `    AssertionError: assert 500 == 204`,
      `    File "/repo/tests/test_orders.py", line 42, in test_create_order`,
      `    File "/repo/.venv/lib/python3.12/site-packages/${source}/_client.py", line 814, in request`,
      `[ERROR] ${m} TypeError: Cannot read properties of undefined (reading 'amount')`,
      `    at /repo/src/payments.ts:42:18`,
      `    at /repo/node_modules/${source}/lib/runner.js:88:11`,
      `[FATAL] ${m} worker crashed with exit code 1`,
    ];
  },

  // ── Java ecosystem ─────────────────────────────────────────────
  java(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} application starting on port 8080`,
      `[DEBUG] ${m} configuration loaded from application.yml`,
      `[DEBUG] ${m} datasource url=jdbc:postgresql://10.90.12.43:5432/app`,
      `[ERROR] ${m} HTTP Status 500 - Internal Server Error`,
      `    at org.apache.catalina.core.StandardWrapperValve.invoke(StandardWrapperValve.java:118)`,
      `    at org.apache.tomcat.util.threads.TaskThread$WrappingRunnable.run(TaskThread.java:55)`,
      `[ERROR] ${m} ServletException processing request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 on /api/checkout from 10.42.7.18:54321`,
      `[ERROR] ${m} ServletException processing request 018f23ab-7c1d-7f44-8bfe-0acddaf33457 on /api/checkout from 10.42.7.18:54322`,
      `[FATAL] ${m} OutOfMemoryError: Java heap space commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Database ────────────────────────────────────────────────────
  database(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} server started on port 5432`,
      `[DEBUG] ${m} connection pool: 42 active connections`,
      `[DEBUG] ${m} checkpoint completed in 12ms`,
      `[ERROR] ${m} FATAL: password authentication failed for user "admin" from 10.42.7.18:54321`,
      `[ERROR] ${m} connection refused to 10.90.12.43:5432`,
      `[ERROR] ${m} deadlock detected for transaction 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} out of disk space - cannot extend relation commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Container / K8s ─────────────────────────────────────────────
  container(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} container started: image checkout-api:latest`,
      `[DEBUG] ${m} health check passed on port 8080`,
      `[DEBUG] ${m} Normal Pulled container checkout-api in pod checkout-api-7b8759d7b9-mk2dq`,
      `[ERROR] ${m} CrashLoopBackOff: back-off restarting failed container checkout-api in pod checkout-api-7b8759d7b9-mk2dq`,
      `[ERROR] ${m} ImagePullBackOff: failed to pull image checkout-api:latest - rpc error: code = Unknown desc = failed to resolve reference`,
      `[ERROR] ${m} OOMKilled: container checkout-api exceeded memory limit for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} container runtime error: runc create failed commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── CI/CD ───────────────────────────────────────────────────────
  ci(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} pipeline started: build-and-deploy`,
      `[DEBUG] ${m} stage: checkout completed in 2.1s`,
      `[DEBUG] ${m} stage: build completed in 42.3s`,
      `[ERROR] ${m} step failed: exit code 1 in stage "test"`,
      `[ERROR] ${m} deployment failed after rollback exhausted`,
      `::error file=.github/workflows/deploy.yml,line=88::deployment failed for service checkout-api request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} pipeline aborted: timeout after 60 minutes commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Security / Scanner ──────────────────────────────────────────
  security(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} scan started: 42 files`,
      `[DEBUG] ${m} scanning directory /repo/src`,
      `[DEBUG] ${m} scanning directory /repo/tests`,
      `[ERROR] ${m} CVE-2026-12345 found in openssl: CRITICAL severity`,
      `[ERROR] ${m} GHSA-ab12-cd34-ef56 found in lodash: HIGH severity`,
      `[ERROR] ${m} High severity vulnerability found in package request-018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} 12 critical vulnerabilities detected - policy violation commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── AI / ML ─────────────────────────────────────────────────────
  ai(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} model loaded successfully`,
      `[DEBUG] ${m} inference: 42 tokens/s on GPU 0`,
      `[DEBUG] ${m} batch processing: 8 requests`,
      `[ERROR] ${m} Error: CUDA out of memory - tried to allocate 2.00 GiB`,
      `[ERROR] ${m} rate limit exceeded for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[ERROR] ${m} model file corrupted - header checksum mismatch`,
      `[FATAL] ${m} NCCL timeout - all GPUs unreachable commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Messaging ───────────────────────────────────────────────────
  messaging(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} broker started on port 9092`,
      `[DEBUG] ${m} topic orders: 42 partitions active`,
      `[DEBUG] ${m} consumer group checkout-api: lag=0`,
      `[ERROR] ${m} connection refused to broker 10.90.12.43:9092`,
      `[ERROR] ${m} message delivery failed for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} cluster unreachable - quorum lost commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Auth / Secrets ──────────────────────────────────────────────
  auth(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} service started`,
      `[DEBUG] ${m} session cache initialized`,
      `[ERROR] ${m} authentication failed for user admin from 10.42.7.18:54321`,
      `[ERROR] ${m} invalid session token for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} key rotation failed - cannot connect to API commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── IoT / Game ──────────────────────────────────────────────────
  iot(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} device connected on /dev/ttyUSB0`,
      `[DEBUG] ${m} sensor reading: temperature=22.5`,
      `[ERROR] ${m} connection timeout after 30s to 10.90.12.41:1883`,
      `[ERROR] ${m} runtime error: null reference for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} firmware update failed - device bricked commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Networking ──────────────────────────────────────────────────
  network(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} tunnel established`,
      `[DEBUG] ${m} connection active: latency 12ms`,
      `[ERROR] ${m} handshake timeout with peer 10.90.12.41:51820`,
      `[ERROR] ${m} connection refused for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 from 10.42.7.18:54321`,
      `[FATAL] ${m} tunnel disconnected - auth expired commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Email ───────────────────────────────────────────────────────
  email(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} 420 emails sent today`,
      `[DEBUG] ${m} template rendered: order-confirmation`,
      `[ERROR] ${m} delivery failed: bounce detected for user@example.com`,
      `[ERROR] ${m} quota exceeded for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 from 10.42.7.18:54321`,
      `[FATAL] ${m} SMTP server unreachable commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Analytics ───────────────────────────────────────────────────
  analytics(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} dashboard ready`,
      `[DEBUG] ${m} 4200 events tracked today`,
      `[ERROR] ${m} buffer overflow: 12000 events dropped for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} database connection refused commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Observability ───────────────────────────────────────────────
  observability(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} agent connected to backend`,
      `[DEBUG] ${m} 4200 spans/second ingested`,
      `[ERROR] ${m} connection lost to backend at 10.90.12.41:4317`,
      `[ERROR] ${m} span dropped for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} buffer exhausted - data loss commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── ORM / DB tools ──────────────────────────────────────────────
  orm(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} migration completed: 12 applied`,
      `[DEBUG] ${m} schema validation passed`,
      `[ERROR] ${m} Error: migration failed - column "total" cannot be null`,
      `[ERROR] ${m} connection refused to 10.90.12.43:5432 for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} schema lock deadlock - cannot proceed commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── IaC ─────────────────────────────────────────────────────────
  iac(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} plan completed: 42 resources`,
      `[DEBUG] ${m} refresh state: no changes detected`,
      `[ERROR] ${m} Error: UPGRADE FAILED: cannot patch deployment checkout-api`,
      `[ERROR] ${m} state locked by another process at 10.90.12.41 for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} plan failed: 3 resource creation errors commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Docs ────────────────────────────────────────────────────────
  docs(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} 42 pages generated`,
      `[DEBUG] ${m} sitemap.xml created`,
      `[ERROR] ${m} build error: cannot resolve module '@theme/classic'`,
      `[FATAL] ${m} build failed with exit code 1 commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Backup ──────────────────────────────────────────────────────
  backup(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} backup started: 42 volumes`,
      `[DEBUG] ${m} snapshot completed for volume PVC-checkout-data`,
      `[ERROR] ${m} backup failed: timeout waiting for snapshot creation for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} repository corrupted - index missing commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Mobile / Desktop ───────────────────────────────────────────
  mobile(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} build started: release configuration`,
      `[DEBUG] ${m} packaging for platform: darwin-arm64`,
      `[ERROR] ${m} Error: Cannot find module 'react-native/Libraries/Core/InitializeCore'`,
      `[ERROR] ${m} build failed for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 from 10.42.7.18:54321`,
      `[FATAL] ${m} process killed by SIGTERM commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Search ──────────────────────────────────────────────────────
  search(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} index created: products (42000 documents)`,
      `[DEBUG] ${m} query latency: 12ms p99`,
      `[ERROR] ${m} connection refused to 10.90.12.44:7700`,
      `[ERROR] ${m} index corruption for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} out of memory during indexing commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Realtime / GraphQL ─────────────────────────────────────────
  realtime(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} server started on port 3000`,
      `[DEBUG] ${m} 42 clients connected`,
      `[ERROR] ${m} transport closed unexpectedly for client 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} schema validation failed commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Python lint ─────────────────────────────────────────────────
  pythonlint(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m}: 42 files checked`,
      `[DEBUG] ${m}: 0 errors, 3 warnings`,
      `[ERROR] ${m}: error: incompatible type "str"; expected "int" in /repo/src/checkout.py:42`,
      `[FATAL] ${m}: type checking failed with 12 errors commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Go/Rust/Ruby frameworks ────────────────────────────────────
  gorustruby(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} server started on :8080`,
      `[DEBUG] ${m} 8 routes registered`,
      `[ERROR] ${m} Error: context deadline exceeded on POST /api/checkout`,
      `    at ${source}/handler.go:42 in serve`,
      `    at ${source}/router.go:88 in resolve`,
      `[ERROR] ${m} request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 failed from 10.42.7.18:54321`,
      `[FATAL] ${m} server crash: aborting due to unrecoverable error commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── CMS / E-commerce ───────────────────────────────────────────
  cms(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} site health check passed`,
      `[DEBUG] ${m} cache rebuild completed`,
      `[ERROR] ${m} Error: Cannot find module '@company/theme' in /var/www/wp-content/plugins/checkout/processor.php:42`,
      `[ERROR] ${m} request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 failed from 10.42.7.18:54321`,
      `[FATAL] ${m} database connection refused commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Incident / On-Call ─────────────────────────────────────────
  incident(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} alert triggered: API5xxRate > 5%`,
      `[DEBUG] ${m} incident #42 created`,
      `[ERROR] ${m} escalation failed for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} API key expired - cannot acknowledge incidents commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Workflow / Integration ──────────────────────────────────────
  workflow(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} execution started: daily-etl`,
      `[DEBUG] ${m} task extract completed in 12s`,
      `[ERROR] ${m} execution failed at task "load" - connection refused for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} worker timeout after 120s commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── FinOps ──────────────────────────────────────────────────────
  finops(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} pricing data synced`,
      `[DEBUG] ${m} 42 cost allocations computed`,
      `[ERROR] ${m} cannot retrieve spot pricing for us-east-1 for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} API rate limit exceeded commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Service mesh ────────────────────────────────────────────────
  mesh(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} proxy configured`,
      `[DEBUG] ${m} sidecar injected for pod checkout-api`,
      `[ERROR] ${m} connection refused to control plane at 10.90.12.41:15010`,
      `[ERROR] ${m} mTLS handshake failed for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} envoy crash: out of memory commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Data engineering ────────────────────────────────────────────
  data(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} pipeline started: 42 sources`,
      `[DEBUG] ${m} transformation completed in 8.2s`,
      `[ERROR] ${m} pipeline failed: connection refused to 10.90.12.43:5432 for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} schema evolution error - incompatible types commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Policy / Governance ─────────────────────────────────────────
  policy(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} evaluation started`,
      `[DEBUG] ${m} 42 policies evaluated`,
      `[ERROR] ${m} policy violation: privileged container in deployment checkout-api for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} admission webhook denied commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Registry / Signing ──────────────────────────────────────────
  registry(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} image pushed successfully`,
      `[DEBUG] ${m} 42 layers uploaded`,
      `[ERROR] ${m} push failed: repository policy denies access for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} signature verification failed commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Git / Source control ─────────────────────────────────────────
  git(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} hook executed: pre-commit`,
      `[DEBUG] ${m} 42 files staged`,
      `[ERROR] ${m} merge conflict in src/checkout/api.ts for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456`,
      `[FATAL] ${m} push rejected: protected branch commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── Runtime / Language ──────────────────────────────────────────
  runtime(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} initialized successfully`,
      `[DEBUG] ${m} JIT compilation: 42 methods compiled`,
      `[ERROR] ${m} segmentation fault for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 at 10.42.7.18:54321`,
      `[FATAL] ${m} heap exhausted - out of memory commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },

  // ── DNS ─────────────────────────────────────────────────────────
  dns(source, markers) {
    const m = markers[0];
    return [
      `[INFO] ${m} zone loaded: example.com`,
      `[DEBUG] ${m} 42 records processed`,
      `[ERROR] ${m} AXFR transfer failed for request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 from 10.42.7.18:54321`,
      `[FATAL] ${m} zone file corrupted commit=abcdef1234567890abcdef1234567890abcdef12`,
    ];
  },
};

// Category assignment: maps source name prefixes/keywords to template keys.
function pickTemplate(
  source: string,
): (source: string, markers: readonly string[]) => string[] {
  const lower = source.toLowerCase();

  // Prefix-based mapping
  if (lower.startsWith('go-') || lower.startsWith('echo-') || lower === 'fiber' || lower === 'chi' || lower === 'buffalo' || lower === 'revel' || lower === 'go-kit' || lower === 'go-micro' || lower === 'rocket' || lower === 'axum' || lower === 'tide' || lower.startsWith('warp-') || lower === 'sinatra' || lower === 'hanami' || lower === 'puma' || lower.startsWith('unicorn') || lower === 'passenger') return TEMPLATES.gorustruby;
  if (lower.startsWith('pytest') || lower === 'python-unittest' || lower === 'tox' || lower === 'nox' || lower === 'behave' || lower === 'robot-framework') return TEMPLATES.testing;
  if (lower.startsWith('ruff') || lower === 'mypy' || lower === 'pyright' || lower === 'pylint' || lower === 'isort') return TEMPLATES.pythonlint;
  if (lower.startsWith('aiohttp') || lower === 'sanic' || lower.startsWith('tornado') || lower === 'twisted' || lower === 'scrapy') return TEMPLATES.web;
  if (lower === 'express' || lower === 'fastify' || lower === 'hapi' || lower === 'koa' || lower === 'nestjs' || lower === 'nextjs' || lower === 'nuxt' || lower === 'sveltekit' || lower === 'remix' || lower === 'astro' || lower === 'adonis' || lower === 'hono' || lower.startsWith('deno') || lower === 'elysia' || lower === 'feathers') return TEMPLATES.web;
  if (lower === 'pino' || lower === 'winston' || lower === 'bunyan' || lower === 'morgan' || lower === 'log4js' || lower === 'log4j' || lower === 'slf4j' || lower.startsWith('zap-') || lower === 'zerolog' || lower === 'structlog' || lower === 'loguru' || lower === 'spdlog' || lower === 'logback') return TEMPLATES.logging;
  if (lower.startsWith('react-native') || lower === 'flutter' || lower === 'expo' || lower === 'capacitor' || lower === 'ionic') return TEMPLATES.mobile;
  if (lower === 'electron' || lower === 'tauri' || lower === 'qt') return TEMPLATES.mobile;
  if (lower.startsWith('unity') || lower.startsWith('unreal') || lower === 'godot' || lower === 'bevy') return TEMPLATES.iot;
  if (lower === 'wordpress' || lower === 'drupal' || lower === 'strapi' || lower.startsWith('ghost') || lower === 'contentful' || lower === 'sanity' || lower === 'payload' || lower === 'directus' || lower === 'webflow') return TEMPLATES.cms;
  if (lower === 'shopify' || lower === 'magento' || lower === 'woocommerce' || lower === 'bigcommerce' || lower === 'medusa') return TEMPLATES.cms;
  if (lower.startsWith('meili') || lower === 'typesense' || lower === 'solr' || lower === 'algolia') return TEMPLATES.search;
  if (lower === 'tomcat' || lower === 'jetty' || lower === 'wildfly' || lower === 'glassfish' || lower === 'websphere' || lower === 'weblogic') return TEMPLATES.java;
  if (lower === 'micronaut' || lower === 'quarkus' || lower.startsWith('vertx') || lower === 'helidon' || lower.startsWith('jakarta') || lower === 'spring-boot') return TEMPLATES.java;
  if (lower.startsWith('openai') || lower === 'huggingface' || lower === 'ollama' || lower === 'vllm' || lower.startsWith('torch') || lower === 'comfyui' || lower.startsWith('stable') || lower === 'deepspeed' || lower.startsWith('llama') || lower === 'langchain' || lower === 'llamaindex' || lower === 'mlflow' || lower === 'langfuse' || lower === 'langsmith' || lower.startsWith('arize') || lower.startsWith('weights') || lower.startsWith('neptune') || lower === 'mlrun' || lower.startsWith('seldon') || lower === 'kserve' || lower === 'bentoml' || lower.startsWith('triton') || lower === 'feast' || lower === 'haystack') return TEMPLATES.ai;
  if (lower.startsWith('postgres') || lower === 'mysql' || lower === 'mariadb' || lower === 'mongodb' || lower === 'redis' || lower === 'valkey' || lower === 'keydb' || lower.startsWith('dragon') || lower === 'memcached' || lower === 'aerospike' || lower === 'dynamodb' || lower.startsWith('cockroach') || lower.startsWith('scylla') || lower.startsWith('yugabyte') || lower === 'tidb' || lower === 'influxdb' || lower.startsWith('timescale') || lower === 'questdb' || lower.startsWith('eventstore') || lower === 'pgbouncer' || lower === 'proxysql' || lower === 'vitess' || lower === 'cassandra' || lower === 'clickhouse' || lower.startsWith('opensearch') || lower.startsWith('elastic') || lower.startsWith('oracle') || lower === 'sqlserver' || lower === 'db2' || lower === 'neo4j' || lower === 'surrealdb' || lower.startsWith('planet') || lower.startsWith('neon') || lower.startsWith('d1-') || lower === 'tigerbeetle' || lower === 'foundationdb' || lower.startsWith('apache-geode') || lower === 'orientdb' || lower === 'arangodb' || lower === 'singlestore' || lower === 'starrocks' || lower === 'greenplum' || lower === 'teradata') return TEMPLATES.database;
  if (lower.startsWith('prisma') || lower.startsWith('drizzle') || lower.startsWith('typeorm') || lower === 'sequelize' || lower === 'knex' || lower === 'flyway' || lower === 'liquibase' || lower === 'alembic' || lower === 'sqlalchemy' || lower === 'mongoose' || lower.startsWith('mikro') || lower === 'objection') return TEMPLATES.orm;
  if (lower.startsWith('kafka') || lower.startsWith('aws-kinesis') || lower.startsWith('aws-msk') || lower === 'confluent' || lower.startsWith('schema-registry') || lower === 'rabbitmq' || lower === 'nats' || lower.startsWith('apache-pulsar') || lower === 'activemq' || lower.startsWith('debezium') || lower === 'streamsets' || lower === 'bytewax' || lower === 'materialize' || lower === 'risingwave' || lower === 'emqx' || lower === 'mosquitto' || lower.startsWith('aws-sq') || lower.startsWith('aws-sns') || lower.startsWith('gcp-pub') || lower === 'redpanda' || lower === 'zeromq' || lower.startsWith('ibm-mq') || lower.startsWith('bull')) return TEMPLATES.messaging;
  if (lower.startsWith('docker') || lower === 'buildkit' || lower === 'podman' || lower === 'containerd' || lower === 'runc' || lower.startsWith('kube') || lower === 'helm' || lower === 'kustomize' || lower === 'skaffold' || lower === 'tilt' || lower.startsWith('openshift') || lower === 'concourse' || lower === 'werf' || lower === 'nomad' || lower === 'minikube' || lower === 'kind' || lower.startsWith('k3') || lower === 'portainer' || lower === 'rancher' || lower === 'longhorn' || lower.startsWith('rook')) return TEMPLATES.container;
  if (lower.startsWith('istio') || lower === 'linkerd' || lower === 'cilium' || lower === 'calico' || lower.startsWith('consul-connect') || lower.startsWith('consul-service') || lower.startsWith('aws-app-mesh')) return TEMPLATES.mesh;
  if (lower.startsWith('github') || lower.startsWith('gitlab') || lower === 'jenkins' || lower.startsWith('jenkins-x') || lower === 'cloudbees' || lower.startsWith('argocd') || lower === 'argo-rollouts' || lower.startsWith('argo-workflows') || lower === 'fluxcd' || lower === 'renovate' || lower === 'circleci' || lower.startsWith('travis') || lower.startsWith('azure-pipeline') || lower === 'teamcity' || lower === 'buildkite' || lower === 'spinnaker' || lower === 'harness' || lower === 'armory' || lower === 'bamboo' || lower === 'appveyor' || lower === 'codefresh' || lower.startsWith('octopus') || lower.startsWith('drone') || lower === 'tekton' || lower === 'dagger' || lower.startsWith('woodpecker') || lower === 'agola' || lower === 'bitrise' || lower.startsWith('codemagic') || lower.startsWith('appcenter') || lower === 'fastlane') return TEMPLATES.ci;
  if (lower === 'trivy' || lower === 'snyk' || lower === 'grype' || lower === 'semgrep' || lower === 'gitleaks' || lower === 'dependabot' || lower.startsWith('npm-audit') || lower.startsWith('osv') || lower === 'checkov' || lower === 'bandit' || lower === 'sonarqube' || lower === 'falco' || lower.startsWith('aquasec') || lower === 'wiz' || lower === 'tenable' || lower.startsWith('prisma-cloud') || lower === 'qualys' || lower.startsWith('crowdstrike') || lower.startsWith('aws-guard') || lower.startsWith('aws-security') || lower.startsWith('aws-cloudtrail') || lower === 'vanta' || lower === 'drata' || lower === 'panther' || lower.startsWith('falcon') || lower.startsWith('owasp') || lower === 'cosign' || lower === 'syft' || lower.startsWith('scorecard')) return TEMPLATES.security;
  if (lower === 'nginx' || lower.startsWith('apache-http') || lower === 'caddy' || lower === 'varnish' || lower === 'traefik' || lower === 'haproxy' || lower === 'envoy') return TEMPLATES.container; // server-ish, reuse
  if (lower === 'clerk' || lower === 'authelia' || lower === 'lldap' || lower.startsWith('dex') || lower === 'zitadel' || lower.startsWith('firebase-auth') || lower.startsWith('supabase-auth') || lower.startsWith('aws-secrets') || lower.startsWith('aws-kms') || lower === 'doppler' || lower === 'infisical' || lower.startsWith('aws-ssm') || lower === 'vault' || lower.startsWith('boundary')) return TEMPLATES.auth;
  if (lower === 'wireguard' || lower === 'tailscale' || lower === 'ngrok' || lower.startsWith('cloudflare-tunnel') || lower === 'zerotier' || lower.startsWith('cloudflare-worker') || lower.startsWith('deno-deploy') || lower.startsWith('serverless') || lower === 'openwhisk' || lower === 'nuclio') return TEMPLATES.network;
  if (lower.startsWith('socket') || lower === 'pusher' || lower === 'ably' || lower === 'livekit' || lower === 'centrifugo') return TEMPLATES.realtime;
  if (lower.startsWith('apollo') || lower.startsWith('graphql') || lower === 'mercurius' || lower === 'dgraph') return TEMPLATES.realtime;
  if (lower === 'instana' || lower.startsWith('signal') || lower === 'lightstep' || lower === 'thanos' || lower === 'cortex' || lower.startsWith('victoria') || lower.startsWith('grafana-tempo') || lower === 'parca' || lower === 'pixie') return TEMPLATES.observability;
  if (lower === 'datadog' || lower === 'newrelic' || lower === 'sentry' || lower === 'sumologic' || lower.startsWith('logz') || lower === 'mezmo' || lower === 'bugsnag' || lower === 'rollbar' || lower === 'dynatrace' || lower === 'appdynamics' || lower === 'elastic-apm' || lower === 'honeycomb' || lower === 'jaeger' || lower === 'zipkin' || lower === 'opentelemetry' || lower === 'prometheus' || lower === 'grafana' || lower === 'loki' || lower === 'logstash' || lower.startsWith('fluent') || lower === 'graylog' || lower === 'splunk' || lower === 'kibana' || lower === 'zabbix' || lower === 'nagios') return TEMPLATES.observability;
  if (lower === 'posthog' || lower === 'amplitude' || lower === 'mixpanel' || lower.startsWith('heap') || lower === 'plausible' || lower === 'matomo' || lower === 'countly') return TEMPLATES.analytics;
  if (lower.startsWith('aws-ses') || lower === 'mailchimp' || lower === 'brevo' || lower === 'postmark' || lower === 'resend' || lower.startsWith('sparkpost') || lower === 'mailgun' || lower === 'sendgrid' || lower === 'twilio') return TEMPLATES.email;
  if (lower.startsWith('home-assistant') || lower === 'platformio' || lower === 'arduino' || lower === 'esphome' || lower === 'tasmota' || lower === 'openhab') return TEMPLATES.iot;
  if (lower.startsWith('pagerduty') || lower === 'opsgenie' || lower === 'victorops' || lower === 'statuspage' || lower.startsWith('incident') || lower === 'firehydrant' || lower === 'rootly' || lower === 'squadcast' || lower.startsWith('grafana-oncall')) return TEMPLATES.incident;
  if (lower === 'temporal' || lower === 'prefect' || lower === 'camunda' || lower === 'zeebe' || lower === 'n8n' || lower === 'mulesoft' || lower === 'boomi' || lower === 'kestra' || lower === 'windmill' || lower === 'inngest' || lower.startsWith('trigger') || lower.startsWith('eventbridge') || lower.startsWith('aws-step') || lower === 'dapr' || lower === 'eventarc' || lower === 'workato' || lower.startsWith('tray')) return TEMPLATES.workflow;
  if (lower.startsWith('opencost') || lower.startsWith('kubecost') || lower.startsWith('aws-cost')) return TEMPLATES.finops;
  if (lower.startsWith('opa') || lower.startsWith('kyverno') || lower.startsWith('sentinel')) return TEMPLATES.policy;
  if (lower.startsWith('ecr') || lower.startsWith('gcr') || lower.startsWith('acr') || lower === 'harbor' || lower.startsWith('sonatype') || lower.startsWith('jfrog')) return TEMPLATES.registry;
  if (lower === 'gitlab' || lower === 'bitbucket' || lower === 'pre-commit' || lower === 'husky') return TEMPLATES.git;
  if (lower === 'graalvm' || lower === 'jvm' || lower === 'v8' || lower === 'cpython') return TEMPLATES.runtime;
  if (lower === 'coredns' || lower === 'powerdns' || lower === 'bind9' || lower.startsWith('external-dns')) return TEMPLATES.dns;
  if (lower === 'velero' || lower === 'restic' || lower.startsWith('borg')) return TEMPLATES.backup;
  if (lower === 'docusaurus' || lower.startsWith('mkdocs') || lower === 'sphinx' || lower === 'mdbook') return TEMPLATES.docs;
  if (lower.startsWith('cloud') || lower.startsWith('aws-lambda') || lower.startsWith('aws-ecs') || lower.startsWith('aws-eks') || lower.startsWith('aws-fargate') || lower.startsWith('aws-cloudfront') || lower.startsWith('aws-alb') || lower.startsWith('aws-api') || lower.startsWith('azure-aks') || lower.startsWith('azure-app') || lower.startsWith('azure-monitor') || lower.startsWith('azure-blob') || lower.startsWith('azure-synapse') || lower.startsWith('azure-function') || lower.startsWith('gcp-gke') || lower.startsWith('gcp-cloud') || lower === 'cloudflare' || lower === 'fastly' || lower === 'vercel' || lower === 'netlify' || lower === 'heroku' || lower === 'railway' || lower.startsWith('fly')) return TEMPLATES.iac;
  if (lower === 'terraform' || lower.startsWith('terra') || lower === 'opentofu' || lower === 'atlantis' || lower === 'spacelift' || lower === 'ansible' || lower === 'pulumi' || lower === 'packer' || lower === 'chef' || lower === 'puppet' || lower === 'saltstack' || lower === 'cloudformation' || lower.startsWith('cloud-custodian') || lower === 'infracost' || lower.startsWith('aws-cdk') || lower.startsWith('cdktf')) return TEMPLATES.iac;
  if (lower === 'consul' || lower === 'etcd' || lower === 'zookeeper') return TEMPLATES.container;
  if (lower === 'kong' || lower.startsWith('apisix') || lower === 'apigee' || lower === 'gravitee' || lower.startsWith('kong-konnect')) return TEMPLATES.network;
  if (lower === 'keycloak' || lower === 'okta' || lower === 'auth0' || lower.startsWith('launchdarkly') || lower === 'unleash' || lower === 'splitio' || lower === 'flagsmith') return TEMPLATES.auth;
  if (lower.startsWith('vitest') || lower === 'jest' || lower === 'mocha' || lower === 'ava' || lower === 'tap' || lower.startsWith('node-test') || lower === 'cypress' || lower === 'playwright' || lower.startsWith('playwright-test') || lower === 'storybook' || lower === 'karma' || lower === 'phpunit' || lower === 'rspec' || lower === 'junit' || lower === 'xunit' || lower === 'nunit' || lower === 'selenium' || lower === 'cucumber' || lower === 'testcafe' || lower === 'nightwatch' || lower.startsWith('webdriverio') || lower === 'keploy' || lower === 'testkube') return TEMPLATES.testing;
  if (lower === 'webpack' || lower === 'vite' || lower === 'rollup' || lower === 'esbuild' || lower === 'babel' || lower === 'swc' || lower === 'typescript' || lower === 'eslint' || lower === 'prettier' || lower === 'rome' || lower === 'parcel' || lower.startsWith('turbopack')) return TEMPLATES.ci;
  if (lower === 'npm' || lower === 'pnpm' || lower === 'yarn' || lower === 'bun' || lower === 'nx' || lower.startsWith('turbo') || lower === 'lerna' || lower === 'pip' || lower === 'pipenv' || lower === 'poetry' || lower === 'uv' || lower === 'composer') return TEMPLATES.ci;
  if (lower === 'maven' || lower === 'gradle' || lower === 'bazel' || lower === 'cmake' || lower.startsWith('ninja') || lower.startsWith('sbt') || lower === 'ant') return TEMPLATES.java;
  if (lower === 'cargo' || lower === 'rustc' || lower === 'clippy' || lower === 'actix' || lower === 'tokio') return TEMPLATES.gorustruby;
  if (lower === 'django' || lower === 'flask' || lower === 'fastapi' || lower === 'gunicorn' || lower === 'uvicorn' || lower === 'celery' || lower === 'airflow') return TEMPLATES.web;
  if (lower === 'dotnet' || lower.startsWith('msbuild') || lower === 'nuget' || lower === 'serilog') return TEMPLATES.ci;
  if (lower === 'bundler' || lower === 'rails' || lower === 'sidekiq') return TEMPLATES.gorustruby;
  if (lower === 'syslog' || lower === 'journald') return TEMPLATES.logging;
  if (lower === 'hadoop' || lower === 'spark' || lower === 'flink' || lower === 'kubeflow' || lower === 'ray' || lower.startsWith('apache-beam') || lower.startsWith('apache-nifi')) return TEMPLATES.data;
  if (lower === 'dbt' || lower === 'dagster' || lower === 'airbyte' || lower === 'fivetran' || lower.startsWith('stitch') || lower.startsWith('kafka-connect') || lower === 'trino' || lower === 'presto' || lower.startsWith('apache-druid') || lower.startsWith('apache-pinot') || lower.startsWith('apache-hudi') || lower.startsWith('delta') || lower.startsWith('apache-iceberg') || lower === 'snowflake' || lower === 'bigquery' || lower === 'redshift' || lower.startsWith('databricks') || lower === 'dbt' || lower === 'meltano' || lower.startsWith('hevo') || lower === 'matillion' || lower === 'talend' || lower === 'informatica' || lower === 'dataform' || lower.startsWith('great') || lower.startsWith('monte') || lower.startsWith('soda')) return TEMPLATES.data;
  if (lower === 'tableau' || lower === 'powerbi' || lower === 'metabase' || lower.startsWith('superset') || lower === 'looker' || lower === 'qlik' || lower.startsWith('mode-analytics')) return TEMPLATES.analytics;
  if (lower === 'milvus' || lower === 'qdrant' || lower === 'weaviate' || lower === 'pinecone' || lower.startsWith('chromadb') || lower === 'vespa') return TEMPLATES.search;
  if (lower === 'salesforce' || lower === 'servicenow' || lower === 'jira' || lower === 'confluence' || lower === 'slack' || lower === 'workday' || lower === 'netsuite' || lower === 'sap' || lower === 'zendesk' || lower === 'freshdesk' || lower === 'hubspot' || lower === 'stripe' || lower === 'adyen' || lower === 'braintree' || lower === 'paypal' || lower === 'square' || lower === 'plaid' || lower === 'segment' || lower === 'rudderstack' || lower === 'backstage' || lower === 'gitpod') return TEMPLATES.ci;
  if (lower === 'k6' || lower === 'gatling' || lower === 'locust' || lower === 'jmeter' || lower === 'artillery' || lower === 'vegeta' || lower === 'fortio' || lower === 'hey' || lower.startsWith('wrk') || lower === 'chaosblade' || lower === 'gremlin' || lower.startsWith('litmus') || lower.startsWith('chaos-mesh') || lower === 'steadybit') return TEMPLATES.ci;
  if (lower.startsWith('openstack') || lower.startsWith('oracle-cloud') || lower.startsWith('alibaba') || lower.startsWith('tencent') || lower === 'digitalocean' || lower === 'linode' || lower === 'minio' || lower === 'ceph') return TEMPLATES.iac;
  if (lower === 'puppeteer') return TEMPLATES.testing;
  if (lower === 'cloudwatch') return TEMPLATES.observability;
  if (lower === 'lacework') return TEMPLATES.security;
  if (lower.startsWith('keda') || lower.startsWith('knative') || lower === 'openfaas' || lower.startsWith('cert-manager') || lower.startsWith('sealed') || lower.startsWith('crossplane') || lower === 'telepresence' || lower === 'k9s' || lower === 'stern' || lower.startsWith('kubescape') || lower === 'tracetest' || lower.startsWith('polaris') || lower.startsWith('kube-bench') || lower.startsWith('kube-hunter') || lower.startsWith('flagger')) return TEMPLATES.container;
  if (lower === 'supabase' || lower === 'firebase' || lower === 'hasura') return TEMPLATES.database;

  return TEMPLATES._default;
}

// ── Main ──────────────────────────────────────────────────────────
mkdirSync(FIXTURES_DIR, { recursive: true });

let generated = 0;
let skipped = 0;

for (const [source, markers] of LOG_SOURCE_SIGNATURES) {
  const filename = `${source}.log`;
  const filepath = join(FIXTURES_DIR, filename);

  // Skip if fixture already exists (manual edits preserved)
  if (existsSync(filepath)) {
    skipped++;
    continue;
  }

  const template = pickTemplate(source);
  const lines = template(source, markers);

  writeFileSync(filepath, lines.join('\n') + '\n', 'utf8');
  generated++;
}

console.log(`Generated ${generated} new fixtures, skipped ${skipped} existing.`);
console.log(`Total sources: ${LOG_SOURCE_SIGNATURES.length}`);
console.log(`Fixtures directory: ${FIXTURES_DIR}`);
