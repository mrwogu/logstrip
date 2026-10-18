"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessBucketPush = accessBucketPush;
exports.flushAccessBucket = flushAccessBucket;
const access_log_classifier_js_1 = require("./access-log-classifier.js");
/**
 * Collapses repeated 2xx/3xx access-log lines in the context-before buffer.
 * Returns a rendered string with the exemplar line and a count marker.
 *
 * For example, three lines like:
 *   GET /api/status HTTP/1.1" 200 42
 *   GET /api/status HTTP/1.1" 200 42
 *   GET /api/status HTTP/1.1" 200 43
 * become:
 *   [x3 access-log 2xx] GET /api/status HTTP/1.1" 200 42
 */
function accessBucketPush(bucket, line) {
    const matched = (0, access_log_classifier_js_1.matchAccessLogLine)(line);
    // Not an access log line, or is an error (>=400) → flush the bucket and
    // pass through the current line separately.
    if (matched === null || matched.status >= 400) {
        const flushed = flushAccessBucket(bucket);
        return { bucket: null, ejected: flushed, passThrough: line };
    }
    // 2xx/3xx access log: check if same path as current bucket.
    if (bucket !== null && bucket.exemplarPath === matched.path) {
        bucket.count += 1;
        return { bucket, ejected: null, passThrough: null };
    }
    // Different path or first bucket: flush old, start new.
    const flushed = flushAccessBucket(bucket);
    const newBucket = {
        exemplarLine: line,
        exemplarPath: matched.path,
        count: 1,
    };
    return { bucket: newBucket, ejected: flushed, passThrough: null };
}
function flushAccessBucket(bucket) {
    if (bucket === null)
        return null;
    const rendered = bucket.count > 1
        ? `[x${bucket.count} access-log 2xx] ${bucket.exemplarLine}`
        : bucket.exemplarLine;
    return rendered;
}
