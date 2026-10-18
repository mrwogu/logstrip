import {
  BLOCK_REFERENCE_MAX_CANDIDATES,
  BLOCK_REFERENCE_MAX_LINE_CHARS,
  BLOCK_REFERENCE_MAX_RUN_LINES,
  BLOCK_REFERENCE_MIN_LINES,
  BLOCK_REFERENCE_MIN_WORDS,
  BLOCK_REFERENCE_WINDOW_LINES,
} from '../constants.js';

/**
 * Streaming back-references for repeated multi-line blocks.
 *
 * Single-line repeats fold into `[xN]` and adjacent identical blocks into
 * `[block xN]` (opt-in), but the same stack trace printed again later, with a
 * different header line or other output in between, was emitted in full each
 * time. This collapser sees the lines about to be written and replaces a run
 * that repeats an earlier run from the recent window with one marker.
 *
 * Lines that cannot start a repeat are passed through immediately; only lines
 * that match an earlier run so far are held back, until the run ends. Memory
 * is bounded by the window and run limits in constants.ts.
 */

export interface BlockReferenceItem {
  text: string;
  score: number;
  /** Set on a reference marker: how many physical lines it stands for. */
  elidedLines?: number;
}

interface HeldLine {
  text: string;
  score: number;
}

export function formatBlockReference(lineCount: number): string {
  return `[... ${lineCount} lines repeated from above ...]`;
}

function countWords(text: string): number {
  return text.match(/\S+/gu)?.length ?? 0;
}

function countPhysicalLines(text: string): number {
  return text.split('\n').length;
}

export class BlockReferenceCollapser {
  private readonly history = new Map<number, string>();
  private readonly positions = new Map<string, number[]>();
  private nextSeq = 0;
  private held: HeldLine[] = [];
  // For each earlier occurrence still matching the held run: the position of
  // the earlier line the next incoming line must equal.
  private candidates: number[] = [];
  private runStart = 0;
  private pendingElided = 0;
  // The block a pending marker stands for, so that back-to-back copies of the
  // same block (the last one possibly cut short) share one marker while a
  // different block gets its own.
  private pendingBlock = '';
  // Once a cut-short copy joined the marker no further copy can follow it.
  private pendingSealed = false;

  push(text: string, score: number): BlockReferenceItem[] {
    const out: BlockReferenceItem[] = [];
    this.feedAll([{ text, score }], out);
    return out;
  }

  /** Release everything still held back; call once at end of stream. */
  flush(): BlockReferenceItem[] {
    const out: BlockReferenceItem[] = [];
    const queue: HeldLine[] = [];
    while (this.held.length > 0 || queue.length > 0) {
      if (queue.length > 0) {
        this.feedAll(queue, out);
      } else {
        this.closeRun(out, queue);
      }
    }
    this.flushMarker(out);
    return out;
  }

  private feedAll(queue: HeldLine[], out: BlockReferenceItem[]): void {
    while (queue.length > 0) {
      const line = queue.shift() as HeldLine;
      if (this.held.length === 0) {
        this.startOrEmit(line, out, queue);
      } else {
        this.extendOrClose(line, out, queue);
      }
    }
  }

  private startOrEmit(line: HeldLine, out: BlockReferenceItem[], queue: HeldLine[]): void {
    const starts = this.findStarts(line.text);
    if (starts.length === 0) {
      this.emitPlain(line, out);
      return;
    }
    this.runStart = this.nextSeq;
    this.held = [line];
    this.candidates = starts.map((start) => start + 1);
    this.closeIfFinished(out, queue);
  }

  private extendOrClose(line: HeldLine, out: BlockReferenceItem[], queue: HeldLine[]): void {
    const matched: number[] = [];
    for (const candidate of this.candidates) {
      if (candidate < this.runStart && this.history.get(candidate) === line.text) {
        matched.push(candidate + 1);
      }
    }

    if (matched.length === 0) {
      // The run ended before this line: settle it, then look at the line again
      // (after any lines settling hands back, which come first in order).
      queue.unshift(line);
      this.closeRun(out, queue);
      return;
    }

    this.held.push(line);
    this.candidates = matched;
    this.closeIfFinished(out, queue);
  }

  // A run is finished once no earlier occurrence can match another line (the
  // earlier occurrence ran into the start of this run) or it hit the cap.
  private closeIfFinished(out: BlockReferenceItem[], queue: HeldLine[]): void {
    const exhausted = this.candidates.every((candidate) => candidate >= this.runStart);
    if (exhausted || this.held.length >= BLOCK_REFERENCE_MAX_RUN_LINES) {
      this.closeRun(out, queue);
    }
  }

  // Turn the held run into a marker when it is long enough to pay for it;
  // otherwise emit its first line and hand the rest back to be re-examined,
  // since a repeat may start later in the run.
  private closeRun(out: BlockReferenceItem[], queue: HeldLine[]): void {
    const run = this.held;
    this.held = [];
    this.candidates = [];

    const words = run.reduce((total, held) => total + countWords(held.text), 0);
    if (run.length >= BLOCK_REFERENCE_MIN_LINES && words >= BLOCK_REFERENCE_MIN_WORDS) {
      const block = run.map((held) => held.text).join('\n');
      const cutShort = this.pendingBlock.startsWith(`${block}\n`);
      const continuesPending = !this.pendingSealed && (block === this.pendingBlock || cutShort);
      if (!continuesPending) {
        this.flushMarker(out);
        this.pendingBlock = block;
      } else if (cutShort) {
        this.pendingSealed = true;
      }
      for (const held of run) {
        this.pendingElided += countPhysicalLines(held.text);
        this.remember(held.text);
      }
      return;
    }

    this.emitPlain(run[0], out);
    queue.unshift(...run.slice(1));
  }

  private emitPlain(line: HeldLine, out: BlockReferenceItem[]): void {
    this.flushMarker(out);
    out.push({ text: line.text, score: line.score });
    this.remember(line.text);
  }

  // The marker scores 0 so a token budget drops it before the block it points
  // back to, never the other way round.
  private flushMarker(out: BlockReferenceItem[]): void {
    if (this.pendingElided === 0) {
      return;
    }
    out.push({
      text: formatBlockReference(this.pendingElided),
      score: 0,
      elidedLines: this.pendingElided,
    });
    this.pendingElided = 0;
    this.pendingBlock = '';
    this.pendingSealed = false;
  }

  private findStarts(text: string): number[] {
    const seen = this.positions.get(text);
    if (seen === undefined) {
      return [];
    }
    return seen.slice(-BLOCK_REFERENCE_MAX_CANDIDATES);
  }

  private remember(text: string): void {
    const seq = this.nextSeq;
    this.nextSeq += 1;

    // Over-long lines are stored as a unique placeholder so that runs can
    // never match across them, but they are not indexed.
    const matchable = text.length <= BLOCK_REFERENCE_MAX_LINE_CHARS;
    this.history.set(seq, matchable ? text : `\u0000${seq}`);
    if (matchable) {
      const list = this.positions.get(text);
      if (list === undefined) {
        this.positions.set(text, [seq]);
      } else {
        list.push(seq);
      }
    }

    const expired = seq - BLOCK_REFERENCE_WINDOW_LINES;
    const expiredText = this.history.get(expired);
    if (expiredText !== undefined) {
      this.history.delete(expired);
      const list = this.positions.get(expiredText);
      if (list !== undefined) {
        list.shift();
        if (list.length === 0) {
          this.positions.delete(expiredText);
        }
      }
    }
  }
}
