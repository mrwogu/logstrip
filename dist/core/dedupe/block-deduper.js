"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planBlockDedupe = planBlockDedupe;
function blocksEqual(lines, a, b, len) {
    for (let j = 0; j < len; j += 1) {
        if (lines[a + j] !== lines[b + j]) {
            return false;
        }
    }
    return true;
}
function planBlockDedupe(lines, maxBlockLines) {
    const limit = Math.max(2, Math.floor(maxBlockLines));
    const ops = [];
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
