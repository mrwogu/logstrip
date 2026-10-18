export interface AccessBucket {
    exemplarLine: string;
    exemplarPath: string;
    count: number;
}
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
export declare function accessBucketPush(bucket: AccessBucket | null, line: string): {
    bucket: AccessBucket | null;
    ejected: string | null;
    passThrough: string | null;
};
export declare function flushAccessBucket(bucket: AccessBucket | null): string | null;
