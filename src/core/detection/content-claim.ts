import { replayLines } from '../formats/json-report.js';
import {
  DEFAULT_CONTENT_SAMPLE_LIMITS,
  ContentSampler,
  type ContentClassification,
  type ContentSampleLimits,
} from './content-kind.js';

export interface TextContentClaim {
  classification: ContentClassification;
  /** Re-yields every line consumed for the sample, then the rest of the stream. */
  replay: AsyncIterable<string>;
}

/**
 * Read the head of a line stream, classify it as log or plain text, and hand
 * back a `replay` iterable that yields the whole input again from line one.
 *
 * At most one sample is buffered: reading stops once the sample holds
 * `limits.maxLines` non-blank lines or `limits.maxBytes` bytes, whichever
 * comes first. Everything after that stays in the source stream. A stream
 * that already reads like a log stops sooner, after as few as
 * CONTENT_EARLY_LOG_MIN_LINES lines, so only text (and a log with little
 * structure) waits for the full sample. A line that itself contains newlines
 * (multiline grouping) counts as its physical lines.
 */
export async function claimTextContent(
  lines: AsyncIterable<string>,
  limits: ContentSampleLimits = DEFAULT_CONTENT_SAMPLE_LIMITS,
): Promise<TextContentClaim> {
  const iterator = lines[Symbol.asyncIterator]();
  const buffered: string[] = [];
  const sampler = new ContentSampler(limits);

  while (!sampler.isFull() && !sampler.isLogDecided()) {
    const next = await iterator.next();
    if (next.done === true) {
      break;
    }
    buffered.push(next.value);
    for (const physical of next.value.split('\n')) {
      sampler.add(physical);
    }
  }

  return {
    classification: sampler.result(),
    replay: replayLines(buffered, iterator),
  };
}
