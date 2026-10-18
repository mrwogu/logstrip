import { describe, expect, it } from 'vitest';
import scenarios from './hero-scenarios.json';
import { formatTally, highlightLine, nextScenario, splitMetric, sweepDelay, tallyOf } from './home-demo';

describe('highlightLine', () => {
  it('colors errors, repeats, markers and sanitized values', () => {
    expect(highlightLine('[ERROR] boom')).toBe('<span class="err">[ERROR] boom</span>');
    expect(highlightLine('[x3] [WARN] slow')).toBe(
      '<span class="x"><span class="dup">[x3]</span> [WARN] slow</span>'
    );
    expect(highlightLine('[... hidden internal stack frames ...]')).toContain('class="stk"');
    expect(highlightLine('id=[ID]')).toBe('<span class="san">id=[ID]</span>');
    expect(highlightLine('  at app (file.ts:1:2)')).toContain('class="mark"');
  });

  it('colors a folded value list without scanning the whole line twice', () => {
    expect(highlightLine('amount=[99.99 | 49.50 | 12.00]')).toContain('class="san"');
    expect(highlightLine('a | b without brackets')).toBe('a | b without brackets');
    // Many opening brackets and no closing one: answered in one pass, not quadratic time.
    expect(highlightLine(`${'['.repeat(5000)} | ${'x'.repeat(5000)}`)).not.toContain('<span');
  });

  it('colors line-start failures and severities, but not the same words mid-line', () => {
    expect(highlightLine('FAIL tests/a.test.ts')).toContain('class="err"');
    expect(highlightLine('HIGH axios 1.7.0')).toContain('class="scan"');
    expect(highlightLine('CRITICAL openssl 3.0.13')).toContain('class="scan"');
    expect(highlightLine('a test could FAIL here')).toBe('a test could FAIL here');
    expect(highlightLine('rated HIGH today')).toBe('rated HIGH today');
  });

  it('colors the command and detected-source header lines', () => {
    expect(highlightLine('❯ logstrip raw.log --stats')).toContain('class="det"');
    expect(highlightLine('✓ detected: nginx')).toContain('class="det"');
  });

  it('escapes markup and leaves plain lines unwrapped', () => {
    expect(highlightLine('a <b> & c')).toBe('a &lt;b&gt; &amp; c');
  });
});

describe('splitMetric', () => {
  it('splits the number out of a metric value', () => {
    expect(splitMetric('80.48%')).toEqual({ prefix: '', value: 80.48, decimals: 2, suffix: '%' });
    expect(splitMetric('-3 lines')).toEqual({
      prefix: '',
      value: -3,
      decimals: 0,
      suffix: ' lines',
    });
  });

  it('returns null when there is no number to animate', () => {
    expect(splitMetric('n/a')).toBeNull();
  });
});

describe('tallyOf', () => {
  it('counts dropped, folded and kept lines', () => {
    expect(tallyOf([['d'], ['g', 0], ['k', 2], ['k', 3], ['d']])).toEqual({
      dropped: 2,
      folded: 1,
      kept: 2,
    });
    expect(formatTally({ dropped: 2, folded: 1, kept: 2 })).toBe('dropped 2 · folded 1 · kept 2');
  });

  it('adds up to the raw line count of every scenario', () => {
    for (const scenario of scenarios) {
      const { dropped, folded, kept } = tallyOf(scenario.fates);
      expect(dropped + folded + kept).toBe(scenario.raw.length);
      expect(kept).toBeLessThanOrEqual(scenario.clean.length);
    }
  });
});

describe('sweepDelay', () => {
  it('fires a line when the scan line reaches it', () => {
    expect(sweepDelay(0, 320, 1500)).toBe(0);
    expect(sweepDelay(160, 320, 1500)).toBe(750);
    expect(sweepDelay(320, 320, 1500)).toBe(1500);
  });

  it('clamps lines scrolled above the screen and lines below it', () => {
    expect(sweepDelay(-40, 320, 1500)).toBe(0);
    expect(sweepDelay(9000, 320, 1500)).toBe(1500);
    expect(sweepDelay(10, 0, 1500)).toBe(0);
  });
});

describe('nextScenario', () => {
  it('walks the list and wraps around', () => {
    expect(nextScenario(['a', 'b', 'c'], 'a')).toBe('b');
    expect(nextScenario(['a', 'b', 'c'], 'c')).toBe('a');
  });
});

describe('hero scenarios', () => {
  it('starts every clean output with the command and the detected sources', () => {
    for (const scenario of scenarios) {
      expect(scenario.clean[0]).toBe(`❯ ${scenario.cmd}`);
      expect(scenario.clean[1]).toMatch(/^✓ detected: /);
    }
  });

  it('has one fate per raw line and only points at existing clean lines', () => {
    for (const scenario of scenarios) {
      expect(scenario.fates).toHaveLength(scenario.raw.length);
      for (const [kind, index] of scenario.fates) {
        if (kind === 'k') expect(scenario.clean[index as number]).toBeDefined();
        if (kind === 'g') expect(scenario.raw[index as number]).toBeDefined();
      }
    }
  });
});
