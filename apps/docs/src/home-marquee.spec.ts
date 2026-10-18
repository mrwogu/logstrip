import { describe, expect, it } from 'vitest';
import { ECOSYSTEM_PILLS, marqueeHtml, marqueeRows } from './home-marquee';

describe('marqueeRows', () => {
  it('splits the pills into three rows in order, the middle one reversed', () => {
    const rows = marqueeRows(['a', 'b', 'c', 'd', 'e', 'f', 'g']);

    expect(rows.map((row) => row.pills)).toEqual([['a', 'b', 'c'], ['d', 'e', 'f'], ['g']]);
    expect(rows.map((row) => row.reverse)).toEqual([false, true, false]);
  });

  it('drops rows that would be empty', () => {
    expect(marqueeRows(['a'])).toHaveLength(1);
    expect(marqueeRows([])).toEqual([]);
  });

  it('keeps every ecosystem pill', () => {
    expect(marqueeRows(ECOSYSTEM_PILLS).flatMap((row) => row.pills)).toEqual(ECOSYSTEM_PILLS);
  });
});

describe('marqueeHtml', () => {
  it('repeats each row twice for a seamless loop and escapes names', () => {
    const html = marqueeHtml(['A&B']);

    expect(html.match(/hp-pill(?: hp-pill--copy)?">A&amp;B</g)).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('--reverse');
  });

  it('marks only the second copy, so reduced motion can hide it', () => {
    const html = marqueeHtml(['a', 'b']);

    expect(html.match(/hp-pill hp-pill--copy"/g)).toHaveLength(2);
    expect(html.match(/<span class="hp-pill">/g)).toHaveLength(2);
  });
});
