(function () {
  'use strict';

  document.documentElement.classList.add('js');

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  // ----- Hybrid browser-side parser (ports the real scoring engine) ----- //

  // --- Scoring constants (mirror src/core/bonsai-parser.ts) ---
  const CONTEXT_WINDOW_BEFORE = 3;
  const CONTEXT_WINDOW_AFTER = 2;
  const SCORE_KEEP_THRESHOLD = 40;
  const TFIDF_REPEAT_THRESHOLD = 3;
  const TFIDF_PENALTY = 8;
  const TFIDF_MAP_LIMIT = 50000;

  // --- Regex tables (mirror the real parser) ---
  const IGNORED_TAG =
    /\[(?:INFO|DEBUG|TRACE|VERBOSE)\]|"level"\s*:\s*"(?:info|debug|trace|verbose)"/i;
  const IMPORTANT_TAG = /\[(?:ERROR|WARN|FATAL|CRITICAL|FAIL)\]/i;
  const DIAGNOSTIC_KW =
    /\b(?:Error|Exception|AssertionError|TypeError|ReferenceError|SyntaxError|RangeError|NullPointerException|Unhandled|failed|failure|fatal|panic|refused|timeout|timed\s+out|unreachable|unavailable|disconnected|killed|aborted|crashed|terminated|unauthorized)\b/i;
  const JSON_SEVERITY =
    /"(?:level|severity)"\s*:\s*"(?:fatal|error|critical|warn|warning)"/i;
  const NPM_ERR = /\b(?:npm|pnpm)\s+ERR!/i;
  const YARN_ERR = /\byarn\s+error\b/i;
  const SCANNER_FINDING =
    /\b(?:CVE-\d{4}-\d{4,7}|GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}|vulnerabilit(?:y|ies)|severity:\s*(?:critical|high|medium)|(?:critical|high)\s+severity)\b/i;
  const CONTAINER_FAIL =
    /\b(?:CrashLoopBackOff|ImagePullBackOff|ErrImagePull|OOMKilled|Back[- ]off restarting failed container|failed to pull image|rpc error: code = Unknown desc = failed to resolve reference)\b/i;
  const STACK_FRAME = /^\s*at\s+.*(?:\(|\s).+:\d+:\d+\)?$/;
  const PYTHON_TRACEBACK = /^Traceback \(most recent call last\):$/;
  const GO_GOROUTINE = /^\s*goroutine\s+\d+\s+\[.+\]:$/i;
  const STACK_MORE = /^\s*\.\.\. \d+ more$/;
  const INTERNAL_STACK =
    /(?:node_modules[\\/]|node:internal|internal[\\/]modules|bootstrap_node|[\\/]usr[\\/]lib[\\/]|[\\/]usr[\\/]local[\\/]lib[\\/]|[\\/]usr[\\/]local[\\/]go[\\/]src[\\/]runtime[\\/]|site-packages[\\/]|dist-packages[\\/]|\.venv[\\/]|java\.base[\\/]|jdk\.internal|org\.springframework\.|[\\/]pkg[\\/]mod[\\/]|\.cargo[\\/]registry[\\/])/i;

  // --- Sanitization patterns (mirror the real parser) ---
  const UUID_PAT =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  const UTC_TIME_PAT =
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+(?:GMT|UTC)\b/gi;
  const COMMON_LOG_TIME_PAT =
    /\b\d{1,2}\/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\b/gi;
  const NGINX_TIME_PAT = /\b\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\b/g;
  const ISO_TIME_PAT =
    /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;
  const IPV4_PORT_PAT =
    /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}:(?:6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]?\d{1,4})\b/g;
  const IPV4_PAT =
    /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/g;
  const HEX_HASH_PAT = /\b(?=[a-f0-9]*\d)(?=[a-f0-9]*[a-f])[a-f0-9]{16,}\b/gi;
  const ALPHANUM_HASH_PAT =
    /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{24,}\b/g;
  const MAX_REPEAT_DELTA_VALUES = 3;

  // --- Simplified source signatures (top 30 ecosystems) ---
  const SOURCE_SIGS = [
    ['github-actions', ['github actions', '##[error]', '::error::']],
    ['gitlab-ci', ['gitlab-ci', 'running with gitlab-runner']],
    ['jenkins', ['jenkins', '[pipeline]']],
    ['docker', ['docker', 'dockerfile']],
    ['kubernetes', ['kubernetes', 'kubectl', 'k8s']],
    ['helm', ['helm']],
    ['terraform', ['terraform']],
    ['npm', ['npm err!', 'npm warn']],
    ['pnpm', ['pnpm err!', 'pnpm']],
    ['yarn', ['yarn error', 'yarn run']],
    ['vitest', ['vitest']],
    ['jest', ['jest']],
    ['pytest', ['pytest', 'assertionerror: assert']],
    ['maven', ['maven', 'mvn ']],
    ['gradle', ['gradle', 'task :', 'build failed']],
    ['go-test', ['go test', '--- fail:']],
    ['cargo', ['cargo build', 'cargo test']],
    ['webpack', ['webpack']],
    ['typescript', ['typescript', 'tsc', 'ts2322']],
    ['trivy', ['trivy', 'cve-']],
    ['snyk', ['snyk']],
    ['nginx', ['nginx']],
    ['postgresql', ['postgres', 'postgresql']],
    ['redis', ['redis']],
    ['kafka', ['kafka']],
    ['spring-boot', ['spring', 'springboot']],
    ['datadog', ['datadog']],
    ['sentry', ['sentry']],
    ['opentelemetry', ['opentelemetry', 'otel']],
    ['aws-lambda', ['aws lambda', 'lambda']],
  ];

  const INTERNAL_STACK_MARKER = '[... hidden internal stack frames ...]';

  function sanitizeLine(line) {
    return line
      .replace(UUID_PAT, '[ID]')
      .replace(UTC_TIME_PAT, '[TIME]')
      .replace(COMMON_LOG_TIME_PAT, '[TIME]')
      .replace(NGINX_TIME_PAT, '[TIME]')
      .replace(ISO_TIME_PAT, '[TIME]')
      .replace(IPV4_PORT_PAT, '[IP]:[PORT]')
      .replace(IPV4_PAT, '[IP]')
      .replace(HEX_HASH_PAT, '[HASH]')
      .replace(ALPHANUM_HASH_PAT, '[HASH]')
      .replace(/[ \t]+$/, '');
  }

  function createRepeatSignature(line) {
    return tokenizeRepeatLine(line)
      .map((token) => {
        const tokenValue = splitRepeatToken(token);
        return tokenValue === undefined ? token : `${tokenValue.prefix}[VALUE]`;
      })
      .join(' ');
  }

  function tokenizeRepeatLine(line) {
    return line.trim().split(/\s+/);
  }

  function splitRepeatToken(token) {
    const separator = token.indexOf('=');
    if (separator <= 0 || separator === token.length - 1) return undefined;
    return {
      prefix: token.slice(0, separator + 1),
      value: token.slice(separator + 1),
    };
  }

  function createRepeatGroup(line) {
    return {
      firstLine: line,
      firstTokens: tokenizeRepeatLine(line),
      signature: createRepeatSignature(line),
      deltas: new Map(),
      count: 1,
    };
  }

  function addRepeatGroupLine(group, line) {
    const tokens = tokenizeRepeatLine(line);
    group.firstTokens.forEach((firstToken, index) => {
      const firstValue = splitRepeatToken(firstToken);
      const nextValue = splitRepeatToken(tokens[index] || '');
      if (
        firstValue === undefined ||
        nextValue === undefined ||
        firstValue.prefix !== nextValue.prefix ||
        firstValue.value === nextValue.value
      ) {
        return;
      }
      const delta = group.deltas.get(index) || {
        prefix: firstValue.prefix,
        values: [firstValue.value],
        hasMoreValues: false,
      };
      if (!group.deltas.has(index)) group.deltas.set(index, delta);
      if (delta.values.includes(nextValue.value)) return;
      if (delta.values.length < MAX_REPEAT_DELTA_VALUES) {
        delta.values.push(nextValue.value);
      } else {
        delta.hasMoreValues = true;
      }
    });
    group.count += 1;
  }

  function renderRepeatGroup(group) {
    if (group.deltas.size === 0) return group.firstLine;
    const tokens = [...group.firstTokens];
    for (const [index, delta] of group.deltas) {
      const values = delta.hasMoreValues ? [...delta.values, '…'] : delta.values;
      tokens[index] = `${delta.prefix}[${values.join(' | ')}]`;
    }
    return tokens.join(' ');
  }

  function isInternalStackLine(line) {
    return (
      (STACK_FRAME.test(line) ||
        PYTHON_TRACEBACK.test(line) ||
        GO_GOROUTINE.test(line) ||
        STACK_MORE.test(line) ||
        DIAGNOSTIC_KW.test(line)) &&
      INTERNAL_STACK.test(line)
    );
  }

  function scoreLine(line, seenCount) {
    if (line.trim().length === 0) return -Infinity;
    if (IGNORED_TAG.test(line)) return -Infinity;

    let score = 0;
    if (IMPORTANT_TAG.test(line)) score += 100;
    if (JSON_SEVERITY.test(line)) score += 80;
    if (SCANNER_FINDING.test(line)) score += 70;
    if (CONTAINER_FAIL.test(line)) score += 70;
    if (NPM_ERR.test(line) || YARN_ERR.test(line)) score += 60;
    if (DIAGNOSTIC_KW.test(line)) score += 50;
    if (
      STACK_FRAME.test(line) ||
      PYTHON_TRACEBACK.test(line) ||
      GO_GOROUTINE.test(line) ||
      STACK_MORE.test(line)
    ) {
      score += 40;
    }

    if (seenCount >= TFIDF_REPEAT_THRESHOLD) {
      score -= TFIDF_PENALTY * (seenCount - TFIDF_REPEAT_THRESHOLD + 1);
    }

    return score;
  }

  function detectSources(lines, limit) {
    const hits = new Map();
    for (const line of lines) {
      const low = line.toLowerCase();
      for (const [src, markers] of SOURCE_SIGS) {
        for (const m of markers) {
          if (low.includes(m)) {
            hits.set(src, (hits.get(src) ?? 0) + 1);
            break;
          }
        }
      }
    }
    return [...hits.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit || 5)
      .map(([s]) => s);
  }

  function estimateTokens(wordCount) {
    return Math.ceil(wordCount * 1.3);
  }

  function countWords(line) {
    return line.trim().match(/\S+/g)?.length ?? 0;
  }

  function compress(raw) {
    const lines = raw.split(/\r?\n/);
    const out = [];
    let dropped = 0;
    let duplicates = 0;
    let hidden = 0;

    // Source detection
    const sources = detectSources(lines, 5);

    // TF-IDF frequency map (bounded)
    const seenLines = new Map();

    // Context window
    const contextBefore = [];
    let afterContextRemaining = 0;

    // Deduplication state
    let previousGroup;
    let hidingInternalStack = false;

    // Stats accumulators
    let inputWords = 0;
    let outputWords = 0;

    function emit(line) {
      const signature = createRepeatSignature(line);
      if (previousGroup?.signature === signature) {
        addRepeatGroupLine(previousGroup, line);
        return;
      }
      flushPrev();
      previousGroup = createRepeatGroup(line);
    }

    function flushPrev() {
      if (previousGroup === undefined) return;
      const rendered =
        previousGroup.count > 1
          ? `[x${previousGroup.count}] ${renderRepeatGroup(previousGroup)}`
          : previousGroup.firstLine;
      if (previousGroup.count > 1) duplicates += previousGroup.count - 1;
      out.push(rendered);
      outputWords += countWords(rendered);
      previousGroup = undefined;
    }

    function flushContextBefore() {
      for (const b of contextBefore) emit(b);
      contextBefore.length = 0;
    }

    for (const original of lines) {
      inputWords += countWords(original);

      if (original.trim().length === 0) {
        dropped += 1;
        continue;
      }

      // Noise tags silently dropped (don't disturb afterContext)
      if (IGNORED_TAG.test(original)) {
        dropped += 1;
        hidingInternalStack = false;
        continue;
      }

      const sanitized = sanitizeLine(original);

      // Internal stack collapsing
      if (isInternalStackLine(sanitized)) {
        hidden += 1;
        if (!hidingInternalStack) {
          flushContextBefore();
          emit(INTERNAL_STACK_MARKER);
          hidingInternalStack = true;
          afterContextRemaining = 0;
        }
        continue;
      }

      hidingInternalStack = false;

      // TF-IDF tracking
      let seenCount = (seenLines.get(sanitized) ?? 0) + 1;
      if (seenCount === 1 && seenLines.size >= TFIDF_MAP_LIMIT) {
        seenLines.clear();
        seenCount = 1;
      }
      seenLines.set(sanitized, seenCount);

      const score = scoreLine(sanitized, seenCount);

      if (score >= SCORE_KEEP_THRESHOLD) {
        flushContextBefore();
        emit(sanitized);
        afterContextRemaining = CONTEXT_WINDOW_AFTER;
      } else if (afterContextRemaining > 0) {
        emit(sanitized);
        afterContextRemaining -= 1;
      } else if (score >= 0) {
        if (contextBefore.length >= CONTEXT_WINDOW_BEFORE) {
          contextBefore.shift();
          dropped += 1;
        }
        contextBefore.push(sanitized);
      } else {
        dropped += 1;
        afterContextRemaining = 0;
      }
    }

    // Unpromoted context lines are discarded
    dropped += contextBefore.length;
    flushPrev();

    const inputTokens = estimateTokens(inputWords);
    const outputTokens = estimateTokens(outputWords);
    const savedTokens = Math.max(0, inputTokens - outputTokens);
    const savingsPercent =
      inputTokens === 0
        ? 0
        : Math.round((savedTokens / inputTokens) * 10000) / 100;

    return {
      output: out.join('\n'),
      inputTokens,
      outputTokens,
      savedTokens,
      savingsPercent,
      droppedLines: dropped,
      duplicateLines: duplicates,
      hiddenInternalStackLines: hidden,
      detectedSources: sources,
    };
  }

  function setupPlayground() {
    const root = document.querySelector('[data-bonsai-playground]');
    if (!root) return;
    const input = root.querySelector('[data-bonsai-input]');
    const output = root.querySelector('[data-bonsai-output]');
    const stats = root.querySelector('[data-bonsai-stats]');
    const runBtn = root.querySelector('[data-bonsai-run]');
    const resetBtn = root.querySelector('[data-bonsai-reset]');
    const demoBtn = root.querySelector('[data-bonsai-demo-btn]');
    if (!input || !output || !stats) return;

    const initial = input.value;

    function fmt(n) {
      return n.toLocaleString('en-US');
    }

    function setStat(key, value) {
      const el = stats.querySelector(`[data-stat="${key}"]`);
      if (el) el.textContent = value;
    }

    function run() {
      const result = compress(input.value);
      const sourceTag =
        result.detectedSources && result.detectedSources.length
          ? `detected: ${result.detectedSources.join(' · ')}\n\n`
          : '';
      output.textContent = sourceTag + result.output;
      setStat('input-tokens', fmt(result.inputTokens));
      setStat('output-tokens', fmt(result.outputTokens));
      setStat('savings', `${result.savingsPercent}%`);
      setStat('dropped', fmt(result.droppedLines));
      setStat('duplicates', fmt(result.duplicateLines));
      setStat('hidden', fmt(result.hiddenInternalStackLines));
    }

    if (runBtn) runBtn.addEventListener('click', run);
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        input.value = initial;
        run();
      });
    }
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        input.value = DEMO_LOG;
        run();
      });
    }

    run();
  }

  function setupCompareDemo() {
    document.querySelectorAll('[data-bonsai-compare]').forEach((root) => {
      if (root.dataset.bonsaiCompareReady === 'true') return;
      root.dataset.bonsaiCompareReady = 'true';

      const rawLines = [
        '[INFO] 2026-05-15T08:01:12.001Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 12ms',
        '[INFO] 2026-05-15T08:01:12.018Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/products 200 10.0.1.15:443 → 10.42.7.18:8080 8ms',
        '[DEBUG] 2026-05-15T08:01:12.034Z spring-boot [Actuator] health UP diskSpace 42.3GB/100GB',
        '[INFO] 2026-05-15T08:01:12.051Z i-0a1b2c3d4e5f6g7h8 [nginx] POST /api/v1/orders 201 10.0.1.15:443 → 10.42.7.18:8080 23ms',
        '[DEBUG] 2026-05-15T08:01:12.067Z spring-boot [HikariPool-1] Pool stats: active=3 idle=7 wait=0',
        '[INFO] 2026-05-15T08:01:12.084Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users/018f23ab-7c1d-7f44-8bfe-0acddaf33456 200 5ms',
        '[INFO] 2026-05-15T08:01:12.101Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /static/app.js 304 2ms',
        '[INFO] 2026-05-15T08:01:12.118Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /static/vendor.js 304 2ms',
        '[DEBUG] 2026-05-15T08:01:12.134Z spring-boot [Tomcat] thread pool: current=12 max=200',
        '[INFO] 2026-05-15T08:01:12.151Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/cart 200 10.0.1.15:443 → 10.42.7.18:8080 7ms',
        '[INFO] 2026-05-15T08:01:12.168Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /favicon.ico 200 1ms',
        '[INFO] 2026-05-15T08:01:12.185Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/recommendations 200 10.0.1.15:443 → 10.42.7.18:8080 45ms',
        '[DEBUG] 2026-05-15T08:01:12.201Z spring-boot [Redis] GET cache:session:018f23ab-7c1d-7f44-8bfe-0acddaf33499 hit TTL=1800',
        '[INFO] 2026-05-15T08:01:12.218Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 11ms',
        '[INFO] 2026-05-15T08:01:12.235Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/products?page=2 200 10.0.1.15:443 → 10.42.7.18:8080 9ms',
        '[INFO] 2026-05-15T08:01:12.251Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 13ms',
        '[DEBUG] 2026-05-15T08:01:12.268Z spring-boot [Kafka] consumer orders-group offset=184741 lag=0',
        '[INFO] 2026-05-15T08:01:12.285Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 10ms',
        '[INFO] 2026-05-15T08:01:12.302Z i-0a1b2c3d4e5f6g7h8 [nginx] PUT /api/v1/users/018f23ab-7c1d-7f44-8bfe-0acddaf33456 200 18ms',
        '[INFO] 2026-05-15T08:01:12.318Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/notifications 200 10.0.1.15:443 → 10.42.7.18:8080 6ms',
        '[DEBUG] 2026-05-15T08:01:12.335Z spring-boot [Actuator] prometheus scrape 42 metrics exported',
        '[INFO] 2026-05-15T08:01:12.352Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 14ms',
        '[INFO] 2026-05-15T08:01:12.369Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/products 200 10.0.1.15:443 → 10.42.7.18:8080 7ms',
        '[INFO] 2026-05-15T08:01:12.385Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 11ms',
        '[DEBUG] 2026-05-15T08:01:12.402Z spring-boot [HikariPool-1] getConnection 3ms total=10',
        '[INFO] 2026-05-15T08:01:12.419Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 9ms',
        '[ERROR] 2026-05-15T08:01:12.436Z spring-boot [payments] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33456 amount=99.99',
        '[ERROR] 2026-05-15T08:01:12.436Z spring-boot [payments] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33457 amount=49.50',
        '[ERROR] 2026-05-15T08:01:12.436Z spring-boot [payments] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33458 amount=12.00',
        'java.lang.NullPointerException: Cannot read "userId" of null',
        '    at com.shop.payments.ChargeService.process(ChargeService.java:42)',
        '    at com.shop.payments.ChargeController.post(ChargeController.java:88)',
        '    at javax.servlet.http.HttpServlet.service(HttpServlet.java:623)',
        '    at org.apache.catalina.core.ApplicationFilterChain.internalDoFilter(ApplicationFilterChain.java:227)',
        '    at org.springframework.web.filter.OncePerRequestFilter.doFilter(OncePerRequestFilter.java:117)',
        '    at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)',
        '[INFO] 2026-05-15T08:01:12.502Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 8ms',
        '[WARN] 2026-05-15T08:01:12.519Z spring-boot [circuit-breaker] payments-service OPEN failures=3/5',
        '[INFO] 2026-05-15T08:01:12.536Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/products 200 10.0.1.15:443 → 10.42.7.18:8080 6ms',
        'CRITICAL CVE-2026-12345 openssl 3.0.13-r0 fixed=3.0.15-r2',
        'HIGH GHSA-ab12-cd34-ef56 axios 1.7.0 fixed=1.8.2',
        '[INFO] 2026-05-15T08:01:12.586Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 10ms',
        '[INFO] 2026-05-15T08:01:12.603Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/cart 200 10.0.1.15:443 → 10.42.7.18:8080 5ms',
        'Warning BackOff restarting failed container checkout-api in pod checkout-api-84b7c46f8b-r9x2n',
        'Warning Failed Error: ErrImagePull image=registry.example.com/checkout@sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        '[INFO] 2026-05-15T08:01:12.653Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 12ms',
        'panic: runtime error: invalid memory address or nil pointer dereference',
        '    at main (main.go:88:13)',
        '[INFO] 2026-05-15T08:01:12.703Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 11ms',
        '[INFO] 2026-05-15T08:01:12.720Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/products 200 10.0.1.15:443 → 10.42.7.18:8080 8ms',
        '[INFO] 2026-05-15T08:01:12.736Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 9ms',
        '[INFO] 2026-05-15T08:01:12.753Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /health 200 1ms',
        '[INFO] 2026-05-15T08:01:12.770Z i-0a1b2c3d4e5f6g7h8 [nginx] GET /api/v1/users 200 10.0.1.15:443 → 10.42.7.18:8080 7ms',
      ];

      const rawLog = rawLines.join('\n');
      const compressed = compress(rawLog);
      const srcTag = compressed.detectedSources && compressed.detectedSources.length
        ? `✓ detected: ${compressed.detectedSources.join(' · ')}\n`
        : '';
      const cleanLog = srcTag + compressed.output;
      const agentSummary = [
        ['likely root cause', 'payments charge failed across 3 requests'],
        ['differing values', 'amount 99.99, 49.50, 12.00'],
        ['app frame', 'ChargeService.process:42'],
        ['noise removed', `${compressed.droppedLines} low-value lines · ${compressed.hiddenInternalStackLines} framework frames`],
      ];

      root.innerHTML = `
        <div class="bonsai-demo__bar">
          <span class="bonsai-demo__dot"></span>
          <span class="bonsai-demo__dot"></span>
          <span class="bonsai-demo__dot"></span>
          <span class="bonsai-demo__title">grove-agent · context run</span>
        </div>
        <div class="bonsai-demo__toggle" data-bonsai-toggle>
          <span class="bonsai-toggle__hint" data-bonsai-hint>try me <span class="bonsai-toggle__arrow">↓</span></span>
          <div class="bonsai-toggle__row">
            <button class="bonsai-toggle__side bonsai-toggle__side--raw is-active" data-bonsai-raw-btn type="button">raw.log</button>
            <button class="bonsai-toggle__pill" data-bonsai-pill type="button" aria-label="Switch between raw and Bonsai output">
              <span class="bonsai-toggle__knob"></span>
            </button>
            <button class="bonsai-toggle__side bonsai-toggle__side--clean" data-bonsai-clean-btn type="button"><img class="bonsai-toggle__icon bonsai-toggle__icon--logo" src="assets/images/logo2-256.webp" alt="" width="235" height="256">bonsai</button>
          </div>
        </div>
        <div class="bonsai-demo__screen" data-bonsai-screen>
          <pre class="bonsai-demo__pre bonsai-demo__pre--raw" data-bonsai-raw-pre></pre>
          <pre class="bonsai-demo__pre bonsai-demo__pre--loading" data-bonsai-loading-pre>
<span style="color: rgba(164, 255, 175, 0.8);">❯ context-bonsai raw.log --stats</span>
<span style="color: rgba(247, 244, 234, 0.5); display: inline-block; margin-top: 0.5rem; animation: bonsai-loading-pulse 1.2s infinite ease-in-out;">analyzing noise patterns and compressing context...</span>
          </pre>
          <pre class="bonsai-demo__pre bonsai-demo__pre--clean" data-bonsai-clean-pre></pre>
          <div class="bonsai-demo__agent-card" aria-label="Agent-ready summary">
            <span class="bonsai-demo__agent-kicker">what the agent sees</span>
            ${agentSummary.map(([label, value]) => `<div class="bonsai-demo__agent-row"><b>${esc(label)}</b><span>${esc(value)}</span></div>`).join('')}
          </div>
        </div>
        <div class="bonsai-demo__metrics" data-bonsai-metrics>
          <span><strong data-bonsai-m-savings>${compressed.savingsPercent}%</strong> token savings</span>
          <span><strong data-bonsai-m-dropped>${compressed.droppedLines}</strong> lines dropped</span>
          <span><strong data-bonsai-m-dupes>${compressed.duplicateLines}</strong> duplicates folded</span>
          <span><strong data-bonsai-m-hidden>${compressed.hiddenInternalStackLines}</strong> internal frames hidden</span>
        </div>`;

      const rawBtn = root.querySelector('[data-bonsai-raw-btn]');
      const cleanBtn = root.querySelector('[data-bonsai-clean-btn]');
      const pill = root.querySelector('[data-bonsai-pill]');
      const hint = root.querySelector('[data-bonsai-hint]');
      const screen = root.querySelector('[data-bonsai-screen]');
      const metrics = root.querySelector('[data-bonsai-metrics]');
      const rawPre = root.querySelector('[data-bonsai-raw-pre]');
      const cleanPre = root.querySelector('[data-bonsai-clean-pre]');

      if (!rawBtn || !cleanBtn || !pill || !screen || !rawPre || !cleanPre) return;

      rawPre.textContent = rawLog;

      // Syntax-highlight the clean log
      const cleanLines = cleanLog.split('\n');
      cleanPre.innerHTML = cleanLines.map((l) => {
        if (/^\[x\d+\]/.test(l)) return `<span class="x">${esc(l).replace(/^(\[x\d+\])/, '<span class="dup">$1</span>')}</span>`;
        if (/\[(?:ERROR|FATAL|CRITICAL)\]/i.test(l)) return `<span class="err">${esc(l)}</span>`;
        if (/\[(?:WARN)\]/i.test(l)) return `<span class="warn">${esc(l)}</span>`;
        if (/^\s*at\s/.test(l)) return `<span class="mark">${esc(l)}</span>`;
        if (/\[ID\]|\[HASH\]|\[IP\]|\[TIME\]|\[[^\]]+\s\|\s[^\]]+\]/.test(l)) return `<span class="san">${esc(l)}</span>`;
        if (/hidden internal stack frames/i.test(l)) return `<span class="stk">${esc(l)}</span>`;
        if (/^✓ detected:/i.test(l)) return `<span class="det">${esc(l)}</span>`;
        if (/CVE-|GHSA-|CRITICAL|HIGH\s/i.test(l)) return `<span class="scan">${esc(l)}</span>`;
        if (/panic|BackOff|ErrImagePull/i.test(l)) return `<span class="err">${esc(l)}</span>`;
        return esc(l);
      }).join('\n');

      function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      let mode = 'raw';
      let transitionTimeout = null;

      function setMode(m) {
        clearTimeout(transitionTimeout);
        if (m === 'clean' && mode === 'raw') {
          mode = 'loading';
          screen.dataset.bonsaiMode = 'loading';
          rawBtn.classList.remove('is-active');
          cleanBtn.classList.add('is-active');
          pill.classList.add('is-clean');
          if (hint) hint.classList.add('is-hidden');
          if (metrics) metrics.classList.remove('is-visible');
          
          transitionTimeout = setTimeout(() => {
            mode = 'clean';
            screen.dataset.bonsaiMode = 'clean';
            if (metrics) metrics.classList.add('is-visible');
          }, 2200);
        } else {
          mode = m;
          screen.dataset.bonsaiMode = m;
          rawBtn.classList.toggle('is-active', m === 'raw');
          cleanBtn.classList.toggle('is-active', m === 'clean');
          pill.classList.toggle('is-clean', m === 'clean');
          if (hint) hint.classList.toggle('is-hidden', m === 'clean');
          if (metrics) metrics.classList.toggle('is-visible', m === 'clean');
        }
      }

      rawBtn.addEventListener('click', () => setMode('raw'));
      cleanBtn.addEventListener('click', () => setMode('clean'));
      pill.addEventListener('click', () => setMode(mode === 'raw' ? 'clean' : 'raw'));

      setMode('raw');

      // Auto-pulse the pill to invite interaction
      let pulseCount = 0;
      const pulseInterval = setInterval(() => {
        pulseCount++;
        if (pulseCount > 6 || mode !== 'raw') {
          clearInterval(pulseInterval);
          return;
        }
        pill.classList.add('is-pulsing');
        setTimeout(() => pill.classList.remove('is-pulsing'), 600);
      }, 2400);
    });
  }

  const DEMO_LOG = [
    '[INFO] Starting build pipeline',
    '[DEBUG] Loading config from /home/runner/work/project/repo/config.json',
    '[INFO] Installing dependencies',
    '[INFO] npm install completed in 23.4s',
    '2026-05-14T11:22:33.512Z [ERROR] Request 018f23ab-7c1d-7f44-8bfe-0acddaf33456 failed: ECONNREFUSED 10.0.0.42:5432',
    '2026-05-14T11:22:33.514Z [ERROR] Request 018f23ab-7c1d-7f44-8bfe-0acddaf33457 failed: ECONNREFUSED 10.0.0.42:5432',
    '2026-05-14T11:22:33.516Z [ERROR] Request 018f23ab-7c1d-7f44-8bfe-0acddaf33458 failed: ECONNREFUSED 10.0.0.42:5432',
    'TypeError: Cannot read properties of undefined (reading "userId")',
    '    at processUser (/srv/app/src/services/user.ts:42:18)',
    '    at /srv/app/node_modules/express/lib/router/route.js:144:13',
    '    at next (/srv/app/node_modules/express/lib/router/route.js:140:14)',
    '    at Layer.handle (node:internal/handler.js:33:7)',
    '    at processTicksAndRejections (node:internal/process/task_queues.js:95:5)',
    '[INFO] Retrying request a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6 (attempt 2/3)',
    '[ERROR] Sha256 mismatch: expected 5d41402abc4b2a76b9719d911017c592 got 7d793037a0760186574b0282f2f435e7',
    '[INFO] Build finished with errors',
  ].join('\n');

  function bootstrap() {
    setupCompareDemo();
  }

  if (
    typeof window.document$ !== 'undefined' &&
    typeof window.document$.subscribe === 'function'
  ) {
    window.document$.subscribe(bootstrap);
  }

  ready(bootstrap);
})();
