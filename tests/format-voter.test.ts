import { describe, expect, it } from 'vitest';
import {
  createFormatVoter,
  decideFormat,
  voteFormat,
} from '../src/core/formats/format-voter';

describe('format-voter', () => {
  it('returns the majority format after the sample size is reached', () => {
    const voter = createFormatVoter(3);
    expect(voteFormat(voter, '{"a":1}')).toBeUndefined();
    expect(voteFormat(voter, '{"b":2}')).toBeUndefined();
    expect(voteFormat(voter, 'level=info msg=hi')).toBe('json');
  });

  it('breaks ties by first appearance', () => {
    const voter = createFormatVoter(2);
    expect(voteFormat(voter, '{"a":1}')).toBeUndefined();
    expect(voteFormat(voter, '<13> service up')).toBe('json');
  });

  it('ignores unknown lines and decides undefined when no format wins', () => {
    const voter = createFormatVoter(2);
    expect(voteFormat(voter, 'plain narrative text')).toBeUndefined();
    expect(voteFormat(voter, 'more plain narrative')).toBeUndefined();
    // Already decided (undefined): further votes short-circuit.
    expect(voteFormat(voter, '{"a":1}')).toBeUndefined();
  });

  it('forces a decision on a short stream via decideFormat', () => {
    const voter = createFormatVoter(5);
    expect(voteFormat(voter, '{"a":1}')).toBeUndefined();
    expect(decideFormat(voter)).toBe('json');
    // Calling again returns the cached decision.
    expect(decideFormat(voter)).toBe('json');
  });

  it('clamps the sample size to a minimum of 2', () => {
    const voter = createFormatVoter(1);
    expect(voter.sampleSize).toBe(2);
  });
});
