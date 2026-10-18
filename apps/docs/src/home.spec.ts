import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import doc from './data/benchmarks.json';
import type { BenchmarkDocument } from './benchmarks';
import { homeValues, renderHome } from './home';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const TEMPLATE = read('./components/home.html');
const DOC = doc as BenchmarkDocument;
const BLOCKS = { marquee: '<i>m</i>', proof: '<i>p</i>', pipeline: '<i>s</i>', faq: '<i>f</i>' };

describe('renderHome', () => {
  it('fills the base path, the values and the blocks of a small template', () => {
    const html = renderHome('<a href="{{base}}/x/">{{n}}</a><!-- b -->', {
      base: '/logstrip',
      values: { n: '7' },
      blocks: { b: '$&' },
    });

    expect(html).toBe('<a href="/logstrip/x/">7</a>$&');
  });

  it('fails when a block has no placeholder or a value is left over', () => {
    expect(() => renderHome('x', { base: '', values: {}, blocks: { b: 'y' } })).toThrow(/<!-- b -->/);
    expect(() => renderHome('{{nope}}', { base: '', values: {}, blocks: {} })).toThrow(/\{\{nope\}\}/);
  });

  it('renders the real template completely, with every internal link under the base', () => {
    const html = renderHome(TEMPLATE, { base: '/logstrip', values: homeValues(DOC), blocks: BLOCKS });

    expect(html).not.toMatch(/\{\{|<!-- (marquee|proof|pipeline|faq) -->/);
    const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThan(10);
    expect(hrefs.every((href) => href.startsWith('/logstrip/'))).toBe(true);
  });
});

describe('homeValues', () => {
  it('quotes the jest fixture from the benchmark data', () => {
    const jest = DOC.fixtures.find((row) => row.id === 'jest-noisy');
    const values = homeValues(DOC);

    expect(values['jest-lines-in']).toBe(String(jest?.inputLines));
    expect(values['jest-tokens-out']).toBe(String(jest?.outputTokens));
    expect(values.fixtures).toBe(String(DOC.totals.fixtures));
  });

  it('fails when the fixture is missing', () => {
    expect(() => homeValues({ ...DOC, fixtures: [] })).toThrow(/jest-noisy/);
  });
});

describe('the problem excerpt', () => {
  const fixture = read('../../../tests/fixtures/jest-noisy.log').split('\n');
  const lines = [
    ...TEMPLATE.matchAll(
      /<span class="hp-ln(?: hp-ln--lit)?"><span class="hp-ln__no">(\d+)<\/span><span class="hp-ln__text">([^<]*(?:&lt;[^<]*)*)<\/span>/g
    ),
  ].map((match) => ({
    no: Number(match[1]),
    text: match[2].replaceAll('&lt;', '<').replaceAll('&gt;', '>'),
  }));

  it('shows lines copied word for word from the fixture, at their real line numbers', () => {
    expect(lines).toHaveLength(12);
    for (const { no, text } of lines) expect(fixture[no - 1]).toBe(text);
  });

  it('lights the error and its two application frames, and says how many lines follow', () => {
    const lit = [...TEMPLATE.matchAll(/hp-ln hp-ln--lit"><span class="hp-ln__no">(\d+)/g)].map((m) => m[1]);

    expect(lit).toEqual(['9', '10', '11']);
    expect(homeValues(DOC)['jest-more-lines']).toBe(String(fixture.filter(Boolean).length - 12));
  });
});

describe('the template copy', () => {
  it('uses hyphens only and states Node.js 22+', () => {
    expect(TEMPLATE).not.toMatch(/[–—]/);
    expect(TEMPLATE).toContain('Node.js 22+');
    expect(TEMPLATE).not.toMatch(/Node(\.js)? 20/);
  });
});
