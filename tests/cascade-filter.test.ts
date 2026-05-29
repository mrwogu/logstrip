import { describe, expect, it } from 'vitest';
import { isCascadeNoiseLine } from '../src/core/scoring/cascade-filter';

describe('isCascadeNoiseLine', () => {
  it('matches compiler cascade restatements', () => {
    expect(isCascadeNoiseLine('error: aborting due to 2 previous errors')).toBe(true);
    expect(
      isCascadeNoiseLine('error: could not compile `app` due to previous error'),
    ).toBe(true);
    expect(isCascadeNoiseLine('cc1plus: due to 5 previous errors')).toBe(true);
    expect(isCascadeNoiseLine('cc1: compilation terminated.')).toBe(true);
  });

  it('matches dependency / upstream cascade phrasings', () => {
    expect(
      isCascadeNoiseLine('Skipping deploy because the previous build was cancelled'),
    ).toBe(true);
    expect(
      isCascadeNoiseLine('Stage deploy halted because dependent job failed'),
    ).toBe(true);
    expect(
      isCascadeNoiseLine('skipped lint because upstream dependency failed'),
    ).toBe(true);
  });

  it('keeps genuine first-occurrence errors', () => {
    expect(isCascadeNoiseLine('[ERROR] payment failed because timeout')).toBe(false);
    expect(isCascadeNoiseLine('make: *** [build] Error 1')).toBe(false);
    expect(isCascadeNoiseLine('[ERROR] connection refused')).toBe(false);
  });
});
