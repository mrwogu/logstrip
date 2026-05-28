import { describe, expect, it } from 'vitest';
import {
  createContinuationContext,
  isContinuationLine,
  type ContinuationContext,
  type MultilineMode,
} from '../src/core/multiline/multiline-buffer';
import {
  effectiveMultilineMode,
  resolveAutoMultiline,
} from '../src/core/multiline/auto-multiline-resolver';

describe('createContinuationContext', () => {
  it('creates a context with the given mode and zeroed counters', () => {
    const ctx = createContinuationContext('python');
    expect(ctx.mode).toBe('python');
    expect(ctx.groupLineCount).toBe(0);
    expect(ctx.groupByteCount).toBe(0);
    expect(ctx.previousLine).toBe('');
  });
});

describe('isContinuationLine', () => {
  it('returns false for off mode', () => {
    const ctx = createContinuationContext('off');
    expect(isContinuationLine('    indented', ctx)).toBe(false);
  });

  it('returns false when group line limit is reached', () => {
    const ctx = createContinuationContext('python');
    ctx.groupLineCount = 200;
    expect(isContinuationLine('    continuation', ctx)).toBe(false);
  });

  it('returns false when group byte limit is reached', () => {
    const ctx = createContinuationContext('python');
    ctx.groupByteCount = 200_000;
    expect(isContinuationLine('    continuation', ctx)).toBe(false);
  });

  it('returns false for unknown mode via default case', () => {
    const ctx = createContinuationContext('off');
    // Cast to bypass TypeScript to cover the default case
    expect(isContinuationLine('    indented', { ...ctx, mode: 'unknown' as MultilineMode })).toBe(false);
  });

  describe('python mode', () => {
    const mode: MultilineMode = 'python';

    it('detects indented continuation lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('    def foo():', ctx)).toBe(true);
      expect(isContinuationLine('      pass', ctx)).toBe(true);
    });

    it('rejects blank lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('', ctx)).toBe(false);
      expect(isContinuationLine('   ', ctx)).toBe(false);
    });

    it('rejects non-indented lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('def foo():', ctx)).toBe(false);
    });

    it('rejects lines starting with "    ["', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('    [ERROR] fail', ctx)).toBe(false);
    });
  });

  describe('node mode', () => {
    const mode: MultilineMode = 'node';

    it('detects indented continuation lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('    at app (/src/app.ts:10:5)', ctx)).toBe(true);
    });

    it('rejects blank lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('', ctx)).toBe(false);
    });

    it('rejects non-indented lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('[ERROR] fail', ctx)).toBe(false);
    });

    it('rejects lines starting with "    ["', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('    [INFO] skip', ctx)).toBe(false);
    });
  });

  describe('java mode', () => {
    const mode: MultilineMode = 'java';

    it('detects indented continuation lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('    at com.example.App.run(App.java:42)', ctx)).toBe(true);
    });

    it('detects "Caused by:" lines regardless of indentation', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('Caused by: java.lang.NullPointerException', ctx)).toBe(true);
      expect(isContinuationLine('  Caused by: something', ctx)).toBe(true);
    });

    it('rejects blank lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('', ctx)).toBe(false);
    });

    it('rejects non-indented non-Caused-by lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('[ERROR] fail', ctx)).toBe(false);
    });

    it('rejects lines starting with "    ["', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('    [Pipeline] stage', ctx)).toBe(false);
    });
  });

  describe('go mode', () => {
    const mode: MultilineMode = 'go';

    it('detects tab-indented lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('\tmain.run()', ctx)).toBe(true);
    });

    it('detects goroutine frames', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('goroutine 42 [running]:', ctx)).toBe(true);
    });

    it('detects "created by" lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('created by main.spawn', ctx)).toBe(true);
    });

    it('rejects blank lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('', ctx)).toBe(false);
    });

    it('rejects non-tab-indented non-goroutine lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('[ERROR] fail', ctx)).toBe(false);
    });

    it('rejects space-indented lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('    not-go', ctx)).toBe(false);
    });
  });

  describe('rust mode', () => {
    const mode: MultilineMode = 'rust';

    it('detects indented continuation lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('   at src/main.rs:42', ctx)).toBe(true);
    });

    it('rejects blank lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('', ctx)).toBe(false);
    });

    it('rejects lines starting with "    ["', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('    [INFO] skip', ctx)).toBe(false);
    });
  });

  describe('auto mode', () => {
    const mode: MultilineMode = 'auto';

    it('detects indented continuation lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('    continuation', ctx)).toBe(true);
    });

    it('detects "Caused by:" lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('Caused by: java.lang.Exception', ctx)).toBe(true);
    });

    it('detects goroutine frames', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('goroutine 1 [chan receive]:', ctx)).toBe(true);
    });

    it('rejects blank lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('', ctx)).toBe(false);
    });

    it('rejects non-indented non-special lines', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('[ERROR] fail', ctx)).toBe(false);
    });

    it('rejects lines starting with "    ["', () => {
      const ctx = createContinuationContext(mode);
      expect(isContinuationLine('    [WARN] skip', ctx)).toBe(false);
    });
  });
});

describe('auto-source multiline', () => {
  it('falls back to auto mode when no effective mode is set', () => {
    const ctx = createContinuationContext('auto-source');
    expect(isContinuationLine('    indented', ctx)).toBe(true);
    expect(isContinuationLine('not indented', ctx)).toBe(false);
  });

  it('uses python-like cont when effectiveMode is python', () => {
    const ctx = createContinuationContext('auto-source');
    ctx.effectiveMode = 'python';
    expect(isContinuationLine('    File "/repo/tests/test_orders.py", line 42', ctx)).toBe(true);
    expect(isContinuationLine('non-indented message', ctx)).toBe(false);
  });

  it('uses java-like cont when effectiveMode is java', () => {
    const ctx = createContinuationContext('auto-source');
    ctx.effectiveMode = 'java';
    expect(isContinuationLine('Caused by: java.lang.RuntimeException', ctx)).toBe(true);
    expect(isContinuationLine('    at com.example.Service.handle(Service.java:42)', ctx)).toBe(true);
    expect(isContinuationLine('non-indented', ctx)).toBe(false);
  });

  it('uses go-like cont when effectiveMode is go', () => {
    const ctx = createContinuationContext('auto-source');
    ctx.effectiveMode = 'go';
    expect(isContinuationLine('\t/path/to/pkg/client.go:123 +0x45', ctx)).toBe(true);
    expect(isContinuationLine('non-tabbed', ctx)).toBe(false);
  });

  it('uses node-like cont when effectiveMode is node', () => {
    const ctx = createContinuationContext('auto-source');
    ctx.effectiveMode = 'node';
    expect(isContinuationLine('    at /repo/src/payments.ts:42:18', ctx)).toBe(true);
    expect(isContinuationLine('not indented', ctx)).toBe(false);
  });

  it('uses rust-like cont when effectiveMode is rust', () => {
    const ctx = createContinuationContext('auto-source');
    ctx.effectiveMode = 'rust';
    expect(isContinuationLine('    indented', ctx)).toBe(true);
    expect(isContinuationLine('not indented', ctx)).toBe(false);
  });

  it('drops continuation lines when effectiveMode is off', () => {
    const ctx = createContinuationContext('auto-source');
    ctx.effectiveMode = 'off';
    expect(isContinuationLine('    indented', ctx)).toBe(false);
    expect(isContinuationLine('Caused by: something', ctx)).toBe(false);
  });

  it('does not treat logging level prefix lines as continuation', () => {
    const ctx = createContinuationContext('auto-source');
    ctx.effectiveMode = 'python';
    expect(isContinuationLine('    [ERROR] something', ctx)).toBe(false);
  });

  it('returns false for empty lines in auto-source mode', () => {
    const ctx = createContinuationContext('auto-source');
    expect(isContinuationLine('   ', ctx)).toBe(false);
    expect(isContinuationLine('', ctx)).toBe(false);
  });
});

describe('resolveAutoMultiline', () => {
  it('resolves python sources correctly', () => {
    expect(resolveAutoMultiline(['pytest'])).toBe('python');
    expect(resolveAutoMultiline(['django'])).toBe('python');
    expect(resolveAutoMultiline(['mypy'])).toBe('python');
    expect(resolveAutoMultiline(['ruff'])).toBe('python');
  });

  it('resolves node sources correctly', () => {
    expect(resolveAutoMultiline(['jest'])).toBe('node');
    expect(resolveAutoMultiline(['vitest'])).toBe('node');
    expect(resolveAutoMultiline(['express'])).toBe('node');
    expect(resolveAutoMultiline(['pino'])).toBe('node');
  });

  it('resolves java sources correctly', () => {
    expect(resolveAutoMultiline(['maven'])).toBe('java');
    expect(resolveAutoMultiline(['spring-boot'])).toBe('java');
    expect(resolveAutoMultiline(['log4j'])).toBe('java');
  });

  it('resolves go sources correctly', () => {
    expect(resolveAutoMultiline(['go-test'])).toBe('go');
    expect(resolveAutoMultiline(['go-build'])).toBe('go');
  });

  it('resolves rust sources correctly', () => {
    expect(resolveAutoMultiline(['cargo'])).toBe('rust');
    expect(resolveAutoMultiline(['rustc'])).toBe('rust');
  });

  it('returns off for unrecognized sources', () => {
    expect(resolveAutoMultiline(['unknown'])).toBe('off');
    expect(resolveAutoMultiline([])).toBe('off');
  });

  it('picks first matching source', () => {
    expect(resolveAutoMultiline(['trivy', 'pytest', 'jest'])).toBe('python');
    expect(resolveAutoMultiline(['kubernetes', 'maven', 'pytest'])).toBe('java');
  });
});

describe('resolveAutoMultiline coverage', () => {
  it('handles mixed known and unknown sources', () => {
    expect(resolveAutoMultiline(['trivy', 'pytest'])).toBe('python');
    expect(resolveAutoMultiline(['kubernetes', 'jest'])).toBe('node');
    expect(resolveAutoMultiline(['docker', 'spring-boot'])).toBe('java');
  });

  it('handles all python-like sources', () => {
    const sources = ['pytest', 'django', 'flask', 'celery', 'aiohttp', 'sanic', 'tornado',
      'structlog', 'loguru', 'ruff', 'mypy', 'pyright', 'pylint', 'sphinx'];
    for (const src of sources) {
      expect(resolveAutoMultiline([src])).toBe('python');
    }
  });

  it('handles all node-like sources', () => {
    const sources = ['jest', 'vitest', 'mocha', 'cypress', 'express', 'fastify',
      'nestjs', 'nextjs', 'pino', 'winston', 'bunyan'];
    for (const src of sources) {
      expect(resolveAutoMultiline([src])).toBe('node');
    }
  });

  it('handles all java-like sources', () => {
    const sources = ['maven', 'gradle', 'spring-boot', 'junit', 'logback', 'log4j', 'tomcat', 'jetty'];
    for (const src of sources) {
      expect(resolveAutoMultiline([src])).toBe('java');
    }
  });
});

describe('effectiveMultilineMode', () => {
  it('passes through non-auto-source modes', () => {
    expect(effectiveMultilineMode('python', [])).toBe('python');
    expect(effectiveMultilineMode('node', [])).toBe('node');
    expect(effectiveMultilineMode('auto', [])).toBe('auto');
    expect(effectiveMultilineMode('off', [])).toBe('off');
  });

  it('resolves auto-source to detected source mode', () => {
    expect(effectiveMultilineMode('auto-source', ['pytest'])).toBe('python');
    expect(effectiveMultilineMode('auto-source', ['maven'])).toBe('java');
    expect(effectiveMultilineMode('auto-source', ['jest'])).toBe('node');
    expect(effectiveMultilineMode('auto-source', ['go-test'])).toBe('go');
    expect(effectiveMultilineMode('auto-source', ['cargo'])).toBe('rust');
  });

  it('falls back to off when no source detected', () => {
    expect(effectiveMultilineMode('auto-source', [])).toBe('off');
    expect(effectiveMultilineMode('auto-source', ['unknown'])).toBe('off');
  });
});
