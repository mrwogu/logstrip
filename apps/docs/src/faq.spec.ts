import { describe, expect, it } from 'vitest';
import doc from './data/benchmarks.json';
import type { BenchmarkDocument } from './benchmarks';
import { faqHtml, homeFaq } from './faq';

const TOTALS = (doc as BenchmarkDocument).totals;

describe('homeFaq', () => {
  const items = homeFaq(TOTALS);

  it('has no duplicate questions and no empty answers', () => {
    const questions = items.map((item) => item.question);

    expect(items.length).toBeGreaterThan(0);
    expect(new Set(questions).size).toBe(questions.length);
    expect(items.every((item) => item.answer.length > 20)).toBe(true);
  });

  it('quotes the measured numbers from the benchmark data', () => {
    const answer = items.find((item) => item.question.includes('tokens'))?.answer ?? '';

    expect(answer).toContain(`${TOTALS.fixtures} test fixtures`);
    expect(answer).toContain(`${TOTALS.minSavingsPercent.toFixed(1)}%`);
    expect(answer).toContain(`${TOTALS.maxSavingsPercent.toFixed(1)}%`);
    expect(answer).toContain(`median of ${TOTALS.medianSavingsPercent.toFixed(1)}%`);
  });

  it('states the Node.js requirement as 22 or newer and never as 20', () => {
    const text = items.map((item) => item.answer).join(' ');

    expect(text).toContain('Node.js 22');
    expect(text).not.toMatch(/Node(\.js)? 20/);
  });

  it('uses no em or en dashes', () => {
    expect(JSON.stringify(items)).not.toMatch(/[–—]/);
  });
});

describe('faqHtml', () => {
  it('renders one details element per item and escapes markup', () => {
    const html = faqHtml([{ question: 'A <b>?', answer: 'x & y' }]);

    expect(html).toBe(
      '<details class="hp-faq__item"><summary>A &lt;b&gt;?</summary><p>x &amp; y</p></details>'
    );
  });
});
