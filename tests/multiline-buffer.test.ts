import { describe, expect, it } from 'vitest';
import {
  createContinuationContext,
  isContinuationLine,
  type MultilineMode,
} from '../src/core/multiline/multiline-buffer';

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
