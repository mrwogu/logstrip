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
export declare function formatBlockReference(lineCount: number): string;
export declare class BlockReferenceCollapser {
    private readonly history;
    private readonly positions;
    private nextSeq;
    private held;
    private candidates;
    private runStart;
    private pendingElided;
    private pendingBlock;
    private pendingSealed;
    push(text: string, score: number): BlockReferenceItem[];
    /** Release everything still held back; call once at end of stream. */
    flush(): BlockReferenceItem[];
    private feedAll;
    private startOrEmit;
    private extendOrClose;
    private closeIfFinished;
    private closeRun;
    private emitPlain;
    private flushMarker;
    private findStarts;
    private remember;
}
