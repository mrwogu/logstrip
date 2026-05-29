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
export type BlockDedupeOp =
  | { kind: 'line'; index: number }
  | { kind: 'marker'; count: number };

export interface BlockDedupePlan {
  ops: BlockDedupeOp[];
  removedLines: number;
}

function blocksEqual(
  lines: readonly string[],
  a: number,
  b: number,
  len: number,
): boolean {
  for (let j = 0; j < len; j += 1) {
    if (lines[a + j] !== lines[b + j]) {
      return false;
    }
  }
  return true;
}

export function planBlockDedupe(
  lines: readonly string[],
  maxBlockLines: number,
): BlockDedupePlan {
  const limit = Math.max(2, Math.floor(maxBlockLines));
  const ops: BlockDedupeOp[] = [];
  const n = lines.length;
  let removedLines = 0;
  let i = 0;

  while (i < n) {
    const maxLen = Math.min(limit, Math.floor((n - i) / 2));
    let matched = false;

    for (let len = maxLen; len >= 2; len -= 1) {
      let reps = 1;
      while (i + reps * len + len <= n && blocksEqual(lines, i, i + reps * len, len)) {
        reps += 1;
      }

      if (reps >= 2) {
        for (let k = 0; k < len; k += 1) {
          ops.push({ kind: 'line', index: i + k });
        }
        ops.push({ kind: 'marker', count: reps });
        removedLines += len * (reps - 1);
        i += len * reps;
        matched = true;
        break;
      }
    }

    if (!matched) {
      ops.push({ kind: 'line', index: i });
      i += 1;
    }
  }

  return { ops, removedLines };
}
