import { describe, expect, it } from 'vitest';
import { processLogString } from '../src/core/logstrip-parser';
import {
  BLOCK_REFERENCE_MAX_RUN_LINES,
  BLOCK_REFERENCE_WINDOW_LINES,
} from '../src/core/constants';
import {
  BlockReferenceCollapser,
  formatBlockReference,
  type BlockReferenceItem,
} from '../src/core/dedupe/block-reference';

function run(lines: readonly string[]): BlockReferenceItem[] {
  const collapser = new BlockReferenceCollapser();
  const out: BlockReferenceItem[] = [];
  for (const line of lines) {
    out.push(...collapser.push(line, 7));
  }
  out.push(...collapser.flush());
  return out;
}

function texts(items: readonly BlockReferenceItem[]): string[] {
  return items.map((item) => item.text);
}

const TRACE = [
  'Traceback (most recent call last):',
  '  File "/repo/app/worker.py", line [NN], in run_task',
  '    result = self.handler(task)',
  '  File "/repo/app/handlers/charge.py", line [NN], in handle',
  'requests.exceptions.ConnectionError: connection aborted by the peer',
];

describe('BlockReferenceCollapser', () => {
  it('passes unique lines straight through with their scores', () => {
    const collapser = new BlockReferenceCollapser();
    expect(collapser.push('alpha one two', 5)).toEqual([{ text: 'alpha one two', score: 5 }]);
    expect(collapser.push('beta three four', 9)).toEqual([{ text: 'beta three four', score: 9 }]);
    expect(collapser.flush()).toEqual([]);
  });

  it('replaces a repeated block with one marker', () => {
    const lines = ['[ERROR] first failure', ...TRACE, '[WARN] retrying later', '[ERROR] second failure', ...TRACE, '[INFO] done'];
    const out = run(lines);

    expect(texts(out)).toEqual([
      '[ERROR] first failure',
      ...TRACE,
      '[WARN] retrying later',
      '[ERROR] second failure',
      formatBlockReference(5),
      '[INFO] done',
    ]);
  });

  it('gives the marker score 0 and reports the elided line count', () => {
    const out = run([...TRACE, 'separator line here', ...TRACE]);
    const marker = out.find((item) => item.elidedLines !== undefined);

    expect(marker).toEqual({ text: formatBlockReference(5), score: 0, elidedLines: 5 });
    expect(out.filter((item) => item.elidedLines === undefined).every((item) => item.score === 7)).toBe(true);
  });

  it('leaves short repeats alone', () => {
    const twoLines = ['first long enough line here', 'second long enough line here'];
    expect(texts(run([...twoLines, 'x y z', ...twoLines]))).toEqual([
      ...twoLines,
      'x y z',
      ...twoLines,
    ]);
  });

  it('leaves runs that are too cheap to be worth a marker', () => {
    const tiny = ['a', 'b', 'c', 'd'];
    expect(texts(run([...tiny, 'separator', ...tiny]))).toEqual([...tiny, 'separator', ...tiny]);
  });

  it('merges back-to-back copies into a single marker', () => {
    const out = run([...TRACE, ...TRACE, ...TRACE, 'after the repeats']);

    expect(texts(out)).toEqual([...TRACE, formatBlockReference(10), 'after the repeats']);
    expect(out[TRACE.length].elidedLines).toBe(10);
  });

  it('folds a cut-short last copy into the marker of the full copies', () => {
    const out = run([...TRACE, 'separator line here', ...TRACE, ...TRACE.slice(0, 3), 'after the repeats here']);

    expect(texts(out).slice(-2)).toEqual([formatBlockReference(8), 'after the repeats here']);
  });

  it('does not let a full copy follow a cut-short one inside the same marker', () => {
    const out = run([
      ...TRACE,
      'separator line here',
      ...TRACE,
      ...TRACE.slice(0, 3),
      ...TRACE,
    ]);

    expect(texts(out).slice(-2)).toEqual([formatBlockReference(8), formatBlockReference(5)]);
  });

  it('gives two different repeated blocks their own markers', () => {
    const other = [
      'other block first line here',
      'other block second line here',
      'other block third line here',
      'other block fourth line here',
    ];
    const out = run([...TRACE, 'filler one here', ...other, 'separator line here', ...other, ...TRACE]);

    expect(texts(out).slice(-2)).toEqual([formatBlockReference(4), formatBlockReference(5)]);
  });

  it('keeps the differing tail of a partially repeated block', () => {
    const changed = [...TRACE.slice(0, 4), 'requests.exceptions.Timeout: read timed out after the limit'];
    const out = run([...TRACE, 'separator line here', ...changed]);

    expect(texts(out)).toEqual([
      ...TRACE,
      'separator line here',
      formatBlockReference(4),
      'requests.exceptions.Timeout: read timed out after the limit',
    ]);
  });

  it('finds a repeat that starts after a false start', () => {
    const lines = [
      'shared opening line here',
      ...TRACE,
      'unrelated middle line here',
      'shared opening line here',
      'something different now',
      ...TRACE,
    ];
    const out = run(lines);

    expect(texts(out)).toEqual([
      'shared opening line here',
      ...TRACE,
      'unrelated middle line here',
      'shared opening line here',
      'something different now',
      formatBlockReference(5),
    ]);
  });

  it('does not match across an over-long line', () => {
    const long = 'x'.repeat(5000);
    const before = ['one two three four', 'five six seven eight'];
    const after = ['nine ten eleven twelve', 'thirteen fourteen fifteen'];
    const lines = [...before, long, ...after, 'break line here', ...before, ...after];

    expect(texts(run(lines))).toEqual(lines);
  });

  it('counts the physical lines of multi-line entries', () => {
    const block = ['first entry\n  continuation one two', 'second entry\n  continuation three four', 'third entry five six seven'];
    const out = run([...block, 'separator', ...block]);

    expect(out[out.length - 1]).toEqual({ text: formatBlockReference(5), score: 0, elidedLines: 5 });
  });

  it('splits very long repeats at the run cap into one marker per chunk', () => {
    const count = BLOCK_REFERENCE_MAX_RUN_LINES + 6;
    const block = Array.from({ length: count }, (_, i) => `block line number ${i} with some words`);
    const out = run([...block, 'separator', ...block]);

    expect(texts(out).slice(-2)).toEqual([
      formatBlockReference(BLOCK_REFERENCE_MAX_RUN_LINES),
      formatBlockReference(6),
    ]);
  });

  it('only remembers the recent window', () => {
    const filler = Array.from(
      { length: BLOCK_REFERENCE_WINDOW_LINES + 10 },
      (_, i) => `filler line ${i} with enough words`,
    );
    const lines = [...TRACE, ...filler, ...TRACE];

    expect(texts(run(lines))).toEqual(lines);
  });

  it('forgets an over-long line and an old duplicate when they leave the window', () => {
    const long = 'x'.repeat(5000);
    const filler = Array.from(
      { length: BLOCK_REFERENCE_WINDOW_LINES + 5 },
      (_, i) => `filler line ${i} with enough words`,
    );
    const lines = [long, 'duplicate line with words', ...filler.slice(0, 50), 'duplicate line with words', ...filler.slice(50), 'duplicate line with words'];

    expect(texts(run(lines))).toEqual(lines);
  });

  it('treats a blank entry as a zero-word line', () => {
    const lines = ['', '   ', '', '   ', 'after the blanks'];

    expect(texts(run(lines))).toEqual(lines);
  });

  it('follows only the most recent occurrences of a frequent first line', () => {
    const noisy = Array.from({ length: 30 }, (_, i) => ['common first line here', `variant ${i} of the second line`]).flat();
    const out = run([...noisy, ...TRACE, 'separator', ...TRACE]);

    expect(texts(out).slice(-1)).toEqual([formatBlockReference(5)]);
  });

  it('releases a held run at end of stream', () => {
    const collapser = new BlockReferenceCollapser();
    const emitted: BlockReferenceItem[] = [];
    for (const line of [...TRACE, 'separator line here', ...TRACE.slice(0, 2)]) {
      emitted.push(...collapser.push(line, 1));
    }
    emitted.push(...collapser.flush());

    expect(texts(emitted)).toEqual([...TRACE, 'separator line here', ...TRACE.slice(0, 2)]);
  });

  it('never claims a repeat that is not in the input', () => {
    // Random sequences over a small alphabet: whatever the collapser does,
    // each marker must stand for lines that occurred earlier, verbatim.
    let state = 12345;
    const random = (): number => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };

    for (let round = 0; round < 60; round += 1) {
      const alphabet = Array.from({ length: 2 + (round % 6) }, (_, i) => `symbol ${i} has several words in it`);
      const input = Array.from({ length: 80 }, () => alphabet[Math.floor(random() * alphabet.length)]);
      const out = run(input);

      let cursor = 0;
      for (const item of out) {
        if (item.elidedLines === undefined) {
          expect(item.text).toBe(input[cursor]);
          cursor += 1;
          continue;
        }
        const elided = input.slice(cursor, cursor + item.elidedLines);
        expect(elided).toHaveLength(item.elidedLines);
        // A marker stands for one block, or back-to-back copies of one block
        // (the last possibly cut short), and that block must have occurred
        // earlier verbatim.
        const earlier = input.slice(0, cursor).join('\n');
        const repeats = Array.from({ length: elided.length }, (_, i) => i + 1).some(
          (period) =>
            elided.every((line, i) => line === elided[i % period]) &&
            earlier.includes(elided.slice(0, period).join('\n')),
        );
        expect(repeats).toBe(true);
        cursor += item.elidedLines;
      }
      expect(cursor).toBe(input.length);
    }
  });
});

describe('repeated blocks in the stream pipeline', () => {
  const trace = [
    'Traceback (most recent call last):',
    '  File "/repo/app/worker.py", line [NN], in run_task',
    '    result = self.handler(task)',
    'requests.exceptions.ConnectionError: connection aborted by the peer',
  ];
  const input = (): string =>
    ['[ERROR] first failure', ...trace, '[ERROR] second failure', ...trace, ''].join('\n');

  it('references a repeated stack trace and counts the folded lines', async () => {
    const result = await processLogString(input());

    expect(result.output).toBe(
      ['[ERROR] first failure', ...trace, '[ERROR] second failure', '[... 4 lines repeated from above ...]', ''].join('\n'),
    );
    expect(result.stats.duplicateLines).toBe(4);
    expect(result.stats.outputLines).toBe(7);
  });

  it('keeps every line when collapseRepeatedBlocks is false', async () => {
    const result = await processLogString(input(), { collapseRepeatedBlocks: false });

    expect(result.output).toBe(input());
    expect(result.stats.duplicateLines).toBe(0);
  });

  it('keeps every line when deduplication is off', async () => {
    const result = await processLogString(input(), { dedupe: false });

    expect(result.output).toBe(input());
  });

  it('counts a reference marker against the sample limit once', async () => {
    const result = await processLogString(input(), { sampleSize: 6 });

    expect(result.output.trimEnd().split('\n')).toHaveLength(6);
    expect(result.output).not.toContain('repeated from above');
  });

  it('lets a token budget drop the marker before the block it refers to', async () => {
    const result = await processLogString(input(), { maxTokens: 40 });

    expect(result.output).not.toContain('repeated from above');
    expect(result.output).toContain('Traceback (most recent call last):');
  });

  it('flushes a held run at end of stream', async () => {
    const result = await processLogString(
      ['[ERROR] first failure', ...trace, '[ERROR] second failure', ...trace.slice(0, 2), ''].join('\n'),
    );

    expect(result.output).toContain('[ERROR] second failure');
    expect(result.output.match(/Traceback/gu)).toHaveLength(2);
  });
});
