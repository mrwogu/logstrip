"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimTextContent = claimTextContent;
const json_report_js_1 = require("../formats/json-report.js");
const content_kind_js_1 = require("./content-kind.js");
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
async function claimTextContent(lines, limits = content_kind_js_1.DEFAULT_CONTENT_SAMPLE_LIMITS) {
    const iterator = lines[Symbol.asyncIterator]();
    const buffered = [];
    const sampler = new content_kind_js_1.ContentSampler(limits);
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
        replay: (0, json_report_js_1.replayLines)(buffered, iterator),
    };
}
