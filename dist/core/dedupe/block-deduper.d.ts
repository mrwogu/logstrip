/**
 * Consecutive multiline-block deduplication (opt-in --collapse-blocks).
 *
 * Single-line repeats are already collapsed into `[xN]` upstream, so this pass
 * targets the multiline analog: a block of >= 2 distinct lines printed several
 * times back-to-back (retry loops, repeated stack windows without --multiline).
 *
 * The planner is pure and index-based: it returns a list of operations
 * (emit original line N, or insert a `[block xN]` marker) plus the number of
 * removed lines, so the caller can rebuild output while preserving per-line
 * metadata (scores, token counts).
 */
export type BlockDedupeOp = {
    kind: 'line';
    index: number;
} | {
    kind: 'marker';
    count: number;
};
export interface BlockDedupePlan {
    ops: BlockDedupeOp[];
    removedLines: number;
}
export declare function planBlockDedupe(lines: readonly string[], maxBlockLines: number): BlockDedupePlan;
