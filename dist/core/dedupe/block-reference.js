"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockReferenceCollapser = void 0;
exports.formatBlockReference = formatBlockReference;
const constants_js_1 = require("../constants.js");
function formatBlockReference(lineCount) {
    return `[... ${lineCount} lines repeated from above ...]`;
}
function countWords(text) {
    return text.match(/\S+/gu)?.length ?? 0;
}
function countPhysicalLines(text) {
    return text.split('\n').length;
}
class BlockReferenceCollapser {
    history = new Map();
    positions = new Map();
    nextSeq = 0;
    held = [];
    // For each earlier occurrence still matching the held run: the position of
    // the earlier line the next incoming line must equal.
    candidates = [];
    runStart = 0;
    pendingElided = 0;
    // The block a pending marker stands for, so that back-to-back copies of the
    // same block (the last one possibly cut short) share one marker while a
    // different block gets its own.
    pendingBlock = '';
    // Once a cut-short copy joined the marker no further copy can follow it.
    pendingSealed = false;
    push(text, score) {
        const out = [];
        this.feedAll([{ text, score }], out);
        return out;
    }
    /** Release everything still held back; call once at end of stream. */
    flush() {
        const out = [];
        const queue = [];
        while (this.held.length > 0 || queue.length > 0) {
            if (queue.length > 0) {
                this.feedAll(queue, out);
            }
            else {
                this.closeRun(out, queue);
            }
        }
        this.flushMarker(out);
        return out;
    }
    feedAll(queue, out) {
        while (queue.length > 0) {
            const line = queue.shift();
            if (this.held.length === 0) {
                this.startOrEmit(line, out, queue);
            }
            else {
                this.extendOrClose(line, out, queue);
            }
        }
    }
    startOrEmit(line, out, queue) {
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
    extendOrClose(line, out, queue) {
        const matched = [];
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
    closeIfFinished(out, queue) {
        const exhausted = this.candidates.every((candidate) => candidate >= this.runStart);
        if (exhausted || this.held.length >= constants_js_1.BLOCK_REFERENCE_MAX_RUN_LINES) {
            this.closeRun(out, queue);
        }
    }
    // Turn the held run into a marker when it is long enough to pay for it;
    // otherwise emit its first line and hand the rest back to be re-examined,
    // since a repeat may start later in the run.
    closeRun(out, queue) {
        const run = this.held;
        this.held = [];
        this.candidates = [];
        const words = run.reduce((total, held) => total + countWords(held.text), 0);
        if (run.length >= constants_js_1.BLOCK_REFERENCE_MIN_LINES && words >= constants_js_1.BLOCK_REFERENCE_MIN_WORDS) {
            const block = run.map((held) => held.text).join('\n');
            const cutShort = this.pendingBlock.startsWith(`${block}\n`);
            const continuesPending = !this.pendingSealed && (block === this.pendingBlock || cutShort);
            if (!continuesPending) {
                this.flushMarker(out);
                this.pendingBlock = block;
            }
            else if (cutShort) {
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
    emitPlain(line, out) {
        this.flushMarker(out);
        out.push({ text: line.text, score: line.score });
        this.remember(line.text);
    }
    // The marker scores 0 so a token budget drops it before the block it points
    // back to, never the other way round.
    flushMarker(out) {
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
    findStarts(text) {
        const seen = this.positions.get(text);
        if (seen === undefined) {
            return [];
        }
        return seen.slice(-constants_js_1.BLOCK_REFERENCE_MAX_CANDIDATES);
    }
    remember(text) {
        const seq = this.nextSeq;
        this.nextSeq += 1;
        // Over-long lines are stored as a unique placeholder so that runs can
        // never match across them, but they are not indexed.
        const matchable = text.length <= constants_js_1.BLOCK_REFERENCE_MAX_LINE_CHARS;
        this.history.set(seq, matchable ? text : `\u0000${seq}`);
        if (matchable) {
            const list = this.positions.get(text);
            if (list === undefined) {
                this.positions.set(text, [seq]);
            }
            else {
                list.push(seq);
            }
        }
        const expired = seq - constants_js_1.BLOCK_REFERENCE_WINDOW_LINES;
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
exports.BlockReferenceCollapser = BlockReferenceCollapser;
