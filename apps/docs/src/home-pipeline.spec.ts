import { describe, expect, it } from 'vitest';
import { PIPELINE_STAGES, pipelineHtml, pipelineSvg } from './home-pipeline';

const SAMPLE = { inputLines: 47, outputLines: 8 };

describe('PIPELINE_STAGES', () => {
  it('runs classify, sanitize, score, dedupe, budget, with text short enough for the box', () => {
    expect(PIPELINE_STAGES.map((stage) => stage.name)).toEqual([
      'classify',
      'sanitize',
      'score',
      'dedupe',
      'budget',
    ]);
    for (const stage of PIPELINE_STAGES) {
      for (const line of stage.lines) expect(line.length).toBeLessThanOrEqual(21);
      expect(stage.mark.length).toBeLessThanOrEqual(18);
    }
  });
});

describe('pipelineSvg', () => {
  it.each([false, true])('draws every stage, the two ends and the arrows (vertical: %s)', (vertical) => {
    const svg = pipelineSvg(SAMPLE, vertical);

    for (const stage of PIPELINE_STAGES) expect(svg).toContain(`>${stage.name}</text>`);
    expect(svg).toContain('47 lines');
    expect(svg).toContain('8 lines');
    expect(svg.match(/class="hp-svg__arrow"/g)).toHaveLength(PIPELINE_STAGES.length + 1);
    expect(svg.match(/class="hp-svg__box"/g)).toHaveLength(PIPELINE_STAGES.length);
  });

  it('is labelled for screen readers with a title and a description', () => {
    const svg = pipelineSvg(SAMPLE, false);

    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="hp-pipe-wide-title hp-pipe-wide-desc"');
    expect(svg).toContain('A raw log of 47 lines passes through 5 stages');
  });

  it('keeps the ids of the two layouts apart', () => {
    expect(pipelineSvg(SAMPLE, true)).toContain('id="hp-pipe-tall-head"');
    expect(pipelineSvg(SAMPLE, false)).toContain('id="hp-pipe-wide-head"');
  });

  it('lays the stages out in a row, or in a column on phones', () => {
    const xs = (svg: string): string[] => [...svg.matchAll(/class="hp-svg__box" x="([\d.]+)" y="([\d.]+)"/g)].map((m) => m[1]);
    const ys = (svg: string): string[] => [...svg.matchAll(/class="hp-svg__box" x="([\d.]+)" y="([\d.]+)"/g)].map((m) => m[2]);

    expect(new Set(ys(pipelineSvg(SAMPLE, false))).size).toBe(1);
    expect(new Set(xs(pipelineSvg(SAMPLE, true))).size).toBe(1);
  });

  it('escapes stage text', () => {
    const svg = pipelineSvg(SAMPLE, false, [{ name: '<x>', lines: ['a & b', 'c'], mark: '"m"' }]);

    expect(svg).toContain('&lt;x&gt;');
    expect(svg).toContain('a &amp; b');
  });
});

describe('pipelineHtml', () => {
  it('holds both layouts', () => {
    const html = pipelineHtml(SAMPLE);

    expect(html).toContain('hp-svg--wide');
    expect(html).toContain('hp-svg--tall');
  });
});
