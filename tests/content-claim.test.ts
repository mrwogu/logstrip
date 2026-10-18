import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTENT_EARLY_LOG_MIN_LINES,
  CONTENT_EARLY_LOG_MIN_RATIO,
  DEFAULT_CONTENT_SAMPLE_BYTES,
  DEFAULT_CONTENT_SAMPLE_LINES,
  claimTextContent,
} from '../src/core/logstrip-parser';

async function* toLines(lines: readonly string[]): AsyncIterable<string> {
  yield* lines;
}

async function collect(lines: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const line of lines) {
    out.push(line);
  }
  return out;
}

describe('claimTextContent', () => {
  function countingSource(
    total: number,
    make: (index: number) => string,
  ): { lines: AsyncIterable<string>; pulled: () => number } {
    let pulled = 0;
    async function* generate(): AsyncIterable<string> {
      for (let index = 0; index < total; index += 1) {
        pulled += 1;
        yield make(index);
      }
    }
    return { lines: generate(), pulled: () => pulled };
  }

  it('classifies an empty stream as log and replays nothing', async () => {
    const claim = await claimTextContent(toLines([]));

    expect(claim.classification.kind).toBe('log');
    expect(claim.classification.sampledLines).toBe(0);
    expect(await collect(claim.replay)).toEqual([]);
  });

  it('replays a short stream completely and in order', async () => {
    const input = ['# Title', '', '## Subtitle', 'body'];
    const claim = await claimTextContent(toLines(input));

    expect(claim.classification.kind).toBe('text');
    expect(await collect(claim.replay)).toEqual(input);
  });

  it('never pulls more than the line sample from the source', async () => {
    const source = countingSource(10_000, (index) => `## Heading ${index}`);

    const claim = await claimTextContent(source.lines);

    expect(source.pulled()).toBe(DEFAULT_CONTENT_SAMPLE_LINES);
    expect(claim.classification.sampledLines).toBe(DEFAULT_CONTENT_SAMPLE_LINES);
    expect(claim.classification.kind).toBe('text');

    const replayed = await collect(claim.replay);
    expect(replayed).toHaveLength(10_000);
    expect(replayed[0]).toBe('## Heading 0');
    expect(replayed[9999]).toBe('## Heading 9999');
  });

  it('never pulls more than the byte sample from the source', async () => {
    const lineBytes = 20_001;
    const source = countingSource(1000, () => 'x'.repeat(20_000));

    const claim = await claimTextContent(source.lines);

    const expected = Math.ceil(DEFAULT_CONTENT_SAMPLE_BYTES / lineBytes);
    expect(source.pulled()).toBe(expected);
    expect(expected).toBeLessThan(DEFAULT_CONTENT_SAMPLE_LINES);
    expect(claim.classification.sampledLines).toBe(expected);
    expect(await collect(claim.replay)).toHaveLength(1000);
  });

  it('stops pulling blank lines at the byte cap', async () => {
    const source = countingSource(DEFAULT_CONTENT_SAMPLE_BYTES * 2, () => '');

    const claim = await claimTextContent(source.lines);

    expect(source.pulled()).toBe(DEFAULT_CONTENT_SAMPLE_BYTES);
    expect(claim.classification.sampledLines).toBe(0);
  });

  it('honours custom limits', async () => {
    const source = countingSource(100, (index) => `## Heading ${index}`);

    const claim = await claimTextContent(source.lines, { maxLines: 7, maxBytes: 1_000_000 });

    expect(source.pulled()).toBe(7);
    expect(claim.classification.kind).toBe('text');
  });

  it('counts the physical lines of a grouped multiline entry', async () => {
    const grouped = ['# one\n## two\n### three', '#### four'];
    const claim = await claimTextContent(toLines(grouped), { maxLines: 100, maxBytes: 1_000_000 });

    expect(claim.classification.sampledLines).toBe(4);
    expect(claim.classification.textLines).toBe(4);
    expect(await collect(claim.replay)).toEqual(grouped);
  });

  it('stops pulling once grouped entries fill the line sample', async () => {
    const source = countingSource(50, () => '# a\n## b\n### c');

    await claimTextContent(source.lines, { maxLines: 6, maxBytes: 1_000_000 });

    expect(source.pulled()).toBe(2);
  });

  it('keeps blank lines in the replay', async () => {
    const input = ['', '[ERROR] boom', '', '', 'tail'];
    const claim = await claimTextContent(toLines(input));

    expect(await collect(claim.replay)).toEqual(input);
  });
  describe('early log verdict', () => {
    const logLine = (index: number): string => `[INFO] event ${index}`;
    const textLine = (index: number): string => `## Heading ${index}`;
    const WEAK_LINE = 'OutOfMemoryError happened';

    it('decides log after the minimum number of lines when the sample is all log', async () => {
      const source = countingSource(10_000, logLine);

      const claim = await claimTextContent(source.lines);

      expect(CONTENT_EARLY_LOG_MIN_LINES).toBe(8);
      expect(source.pulled()).toBe(CONTENT_EARLY_LOG_MIN_LINES);
      expect(claim.classification).toMatchObject({
        kind: 'log',
        sampledLines: CONTENT_EARLY_LOG_MIN_LINES,
        logLines: CONTENT_EARLY_LOG_MIN_LINES,
      });
    });

    it('still replays the whole stream after an early verdict', async () => {
      const source = countingSource(10_000, logLine);

      const claim = await claimTextContent(source.lines);
      const replayed = await collect(claim.replay);

      expect(replayed).toHaveLength(10_000);
      expect(replayed[0]).toBe('[INFO] event 0');
      expect(replayed[9999]).toBe('[INFO] event 9999');
    });

    it('decides log when the log share reaches 60 percent', async () => {
      expect(CONTENT_EARLY_LOG_MIN_RATIO).toBe(0.6);
      // 5 of 8 lines are log (0.625), then only text follows.
      const lines = [
        ...Array.from({ length: 5 }, (_, index) => logLine(index)),
        ...Array.from({ length: 95 }, (_, index) => textLine(index)),
      ];
      const source = countingSource(lines.length, (index) => lines[index]);

      const claim = await claimTextContent(source.lines);

      expect(source.pulled()).toBe(8);
      expect(claim.classification.kind).toBe('log');
    });

    it('keeps reading when the log share stays under 60 percent', async () => {
      // 4 of 8 lines are log (0.5), so the whole sample is read and the
      // text that follows wins.
      const lines = [
        ...Array.from({ length: 4 }, (_, index) => logLine(index)),
        ...Array.from({ length: 96 }, (_, index) => textLine(index)),
      ];
      const source = countingSource(lines.length, (index) => lines[index]);

      const claim = await claimTextContent(source.lines);

      expect(source.pulled()).toBe(DEFAULT_CONTENT_SAMPLE_LINES);
      expect(claim.classification.kind).toBe('text');
    });

    it('decides log once the log count rules out text, whatever the share', async () => {
      // One log line in three: never 60 percent, but 16 weighted log lines
      // exceed 0.15 x 100 and text can no longer pass.
      const source = countingSource(1000, (index) =>
        index % 3 === 0 ? logLine(index) : textLine(index),
      );

      const claim = await claimTextContent(source.lines);

      // The 16th log line is the 46th line (index 45).
      expect(source.pulled()).toBe(46);
      expect(claim.classification.kind).toBe('log');
      expect(claim.classification.logLines).toBe(16);
    });

    it('does not decide at exactly the ceiling', async () => {
      // 15 log lines in 45 weigh exactly 0.15 x 100.
      const source = countingSource(45, (index) =>
        index % 3 === 0 ? logLine(index) : textLine(index),
      );

      const claim = await claimTextContent(source.lines);

      expect(source.pulled()).toBe(45);
      expect(claim.classification.logLines).toBe(15);
    });

    it('counts weak log lines at half weight', async () => {
      // A weak line is worth 0.5, so 31 of them are needed to exceed 15.
      const source = countingSource(1000, () => WEAK_LINE);

      const claim = await claimTextContent(source.lines);

      expect(source.pulled()).toBe(31);
      expect(claim.classification.kind).toBe('log');
    });

    it('scales the log ceiling with a custom sample size', async () => {
      const source = countingSource(1000, (index) =>
        index % 3 === 0 ? logLine(index) : textLine(index),
      );

      const claim = await claimTextContent(source.lines, {
        maxLines: 20,
        maxBytes: 1_000_000,
      });

      // 0.15 x 20 = 3, so the 4th log line (index 9) decides.
      expect(source.pulled()).toBe(10);
      expect(claim.classification.kind).toBe('log');
    });

    it('decides log once more than half of the sample is not text', async () => {
      // Lines without any signal: text would need half of 100 lines, which
      // is out of reach after 51 of them.
      const source = countingSource(1000, () => 'alpha');

      const claim = await claimTextContent(source.lines);

      expect(source.pulled()).toBe(51);
      expect(claim.classification).toMatchObject({
        kind: 'log',
        textLines: 0,
        sampledLines: 51,
      });
    });

    it('lets text through the same exit while it can still reach half of the sample', async () => {
      // 50 neutral lines, then text: 50 of 100 lines can still be text.
      const source = countingSource(1000, (index) =>
        index < 50 ? 'alpha' : textLine(index),
      );

      const claim = await claimTextContent(source.lines);

      expect(source.pulled()).toBe(DEFAULT_CONTENT_SAMPLE_LINES);
      expect(claim.classification.kind).toBe('text');
    });

    it('does not count lines inside an open fence as lost to text', async () => {
      const source = countingSource(1000, (index) =>
        index === 0 ? '```' : 'alpha',
      );

      const claim = await claimTextContent(source.lines);

      expect(source.pulled()).toBe(DEFAULT_CONTENT_SAMPLE_LINES);
      expect(claim.classification.kind).toBe('log');
    });

    it('decides within the minimum on a grouped multiline entry', async () => {
      const grouped = '[ERROR] boom\n[ERROR] bang\n[ERROR] crash\n[ERROR] more';
      const source = countingSource(50, () => grouped);

      const claim = await claimTextContent(source.lines);

      // Two entries hold 8 log lines.
      expect(source.pulled()).toBe(2);
      expect(claim.classification.sampledLines).toBe(8);
    });
  });

  describe('corpus', () => {
    const FIXTURES_DIR = join(__dirname, 'fixtures');
    const logFiles = [
      ...readdirSync(FIXTURES_DIR)
        .filter((name) => name.endsWith('.log'))
        .map((name) => join(FIXTURES_DIR, name)),
      ...readdirSync(join(FIXTURES_DIR, 'sources'))
        .filter((name) => name.endsWith('.log'))
        .map((name) => join(FIXTURES_DIR, 'sources', name)),
    ];
    const textFiles = [
      join(__dirname, '..', 'README.md'),
      join(__dirname, '..', '.github', 'workflows', 'ci.yml'),
      join(__dirname, '..', 'src', 'core', 'types.ts'),
      ...readdirSync(join(FIXTURES_DIR, 'text')).map((name) =>
        join(FIXTURES_DIR, 'text', name),
      ),
    ];

    async function claimFile(file: string): Promise<{ kind: string; pulled: number }> {
      const fileLines = readFileSync(file, 'utf8').split(/\r?\n/u);
      const source = countingSource(fileLines.length, (index) => fileLines[index]);
      const claim = await claimTextContent(source.lines);
      return { kind: claim.classification.kind, pulled: source.pulled() };
    }

    it('classifies every log fixture as log, most of them after eight lines', async () => {
      let early = 0;
      for (const file of logFiles) {
        const result = await claimFile(file);
        expect(result.kind, file).toBe('log');
        if (result.pulled <= CONTENT_EARLY_LOG_MIN_LINES) {
          early += 1;
        }
      }

      expect(early / logFiles.length).toBeGreaterThan(0.95);
    });

    it('still classifies text files as text from the full sample', async () => {
      for (const file of textFiles) {
        expect((await claimFile(file)).kind, file).toBe('text');
      }
    });
  });
});
