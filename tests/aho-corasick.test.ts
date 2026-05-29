import { describe, expect, it } from 'vitest';
import { buildAhoCorasick, matchAll } from '../src/core/detection/aho-corasick';

describe('aho-corasick', () => {
  it('returns an empty set for an empty automaton', () => {
    const ac = buildAhoCorasick([]);
    expect(ac.isEmpty).toBe(true);
    expect(matchAll(ac, 'anything at all')).toEqual(new Set());
  });

  it('skips empty patterns during construction', () => {
    const ac = buildAhoCorasick(['', 'ab']);
    expect(ac.isEmpty).toBe(false);
    expect(matchAll(ac, 'xaby')).toEqual(new Set(['ab']));
  });

  it('finds all overlapping patterns in one pass (classic he/she/his/hers)', () => {
    const ac = buildAhoCorasick(['he', 'she', 'his', 'hers']);
    expect(matchAll(ac, 'ushers')).toEqual(new Set(['she', 'he', 'hers']));
    expect(matchAll(ac, 'this is history')).toEqual(new Set(['his']));
  });

  it('exercises deep fail-link traversal', () => {
    const ac = buildAhoCorasick(['a', 'ab', 'bab', 'bc', 'bca', 'c', 'caa']);
    expect(matchAll(ac, 'abccab')).toEqual(new Set(['a', 'ab', 'bc', 'c']));
  });

  it('returns an empty set when nothing matches', () => {
    const ac = buildAhoCorasick(['redis', 'nginx']);
    expect(matchAll(ac, 'zzz qqq www')).toEqual(new Set());
  });

  it('matches at the very start and very end of the text', () => {
    const ac = buildAhoCorasick(['npm', 'err']);
    expect(matchAll(ac, 'npm install err')).toEqual(new Set(['npm', 'err']));
  });

  it('deduplicates repeated occurrences', () => {
    const ac = buildAhoCorasick(['ab']);
    expect(matchAll(ac, 'ababab')).toEqual(new Set(['ab']));
  });
});
