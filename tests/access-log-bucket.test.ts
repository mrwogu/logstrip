import { describe, expect, it } from 'vitest';
import {
  accessBucketPush,
  flushAccessBucket,
  type AccessBucket,
} from '../src/core/formats/access-log-bucket.js';

describe('access log bucket', () => {
  const get200 =
    '192.168.1.1 - - [15/May/2026:10:00:00 +0000] "GET /api/status HTTP/1.1" 200 42 "-" "curl/7.88.1"';
  const get200b =
    '192.168.1.2 - - [15/May/2026:10:00:01 +0000] "GET /api/status HTTP/1.1" 200 43 "-" "curl/7.88.1"';
  const get404 =
    '10.0.0.1 - - [15/May/2026:10:00:02 +0000] "GET /api/missing HTTP/1.1" 404 0 "-" "python-requests"';
  const get200other =
    '172.16.0.1 - - [15/May/2026:10:00:00 +0000] "GET /api/other HTTP/1.1" 200 120 "-" "node-fetch"';

  it('starts a new bucket on the first 2xx access log', () => {
    const { bucket, ejected, passThrough } = accessBucketPush(null, get200);
    expect(ejected).toBeNull();
    expect(passThrough).toBeNull();
    expect(bucket).not.toBeNull();
    expect(bucket!.count).toBe(1);
    expect(bucket!.exemplarPath).toBe('/api/status');
  });

  it('grows bucket count for same-path 2xx lines', () => {
    const { bucket: b1 } = accessBucketPush(null, get200);
    const { bucket, ejected, passThrough } = accessBucketPush(b1, get200b);
    expect(ejected).toBeNull();
    expect(passThrough).toBeNull();
    expect(bucket!.count).toBe(2);
  });

  it('flushes and starts new bucket on different path', () => {
    const { bucket: b1 } = accessBucketPush(null, get200);
    const { bucket: b2 } = accessBucketPush(b1, get200); // same path, count=2
    const { bucket, ejected, passThrough } = accessBucketPush(b2, get200other);

    expect(ejected).toBe('[x2 access-log 2xx] ' + get200);
    expect(passThrough).toBeNull();
    expect(bucket).not.toBeNull();
    expect(bucket!.count).toBe(1);
    expect(bucket!.exemplarPath).toBe('/api/other');
  });

  it('flushes bucket and passes through 4xx error line', () => {
    const { bucket: b1 } = accessBucketPush(null, get200);
    const { bucket: b2 } = accessBucketPush(b1, get200); // count=2
    const { bucket, ejected, passThrough } = accessBucketPush(b2, get404);

    expect(ejected).toBe('[x2 access-log 2xx] ' + get200);
    expect(passThrough).toBe(get404);
    expect(bucket).toBeNull();
  });

  it('passes through 4xx line when no bucket exists', () => {
    const { bucket, ejected, passThrough } = accessBucketPush(null, get404);
    expect(ejected).toBeNull();
    expect(passThrough).toBe(get404);
    expect(bucket).toBeNull();
  });

  it('flushes bucket and passes through 4xx line', () => {
    const { bucket: b1 } = accessBucketPush(null, get200);
    const { bucket: b2 } = accessBucketPush(b1, get200); // count=2
    const { bucket, ejected, passThrough } = accessBucketPush(b2, get404);

    expect(ejected).toBe('[x2 access-log 2xx] ' + get200);
    expect(passThrough).toBe(get404);
    expect(bucket).toBeNull();
  });

  it('passes through non-access-log line immediately', () => {
    const line = '[ERROR] something broke';
    const { bucket, ejected, passThrough } = accessBucketPush(null, line);
    expect(ejected).toBeNull();
    expect(passThrough).toBe(line);
    expect(bucket).toBeNull();
  });

  it('flushes bucket and passes through non-access-log line', () => {
    const { bucket: b1 } = accessBucketPush(null, get200);
    const { bucket, ejected, passThrough } = accessBucketPush(b1, '[INFO] something');

    expect(ejected).toBe(get200); // single line, no xN prefix
    expect(passThrough).toBe('[INFO] something');
    expect(bucket).toBeNull();
  });

  it('flushAccessBucket returns null for null bucket', () => {
    expect(flushAccessBucket(null)).toBeNull();
  });

  it('flushAccessBucket returns the line as-is for single entry', () => {
    const { bucket } = accessBucketPush(null, get200);
    const rendered = flushAccessBucket(bucket);
    expect(rendered).toBe(get200); // single line, no prefix
  });

  it('flushAccessBucket prefixes count for multiple entries', () => {
    const { bucket: b1 } = accessBucketPush(null, get200);
    const { bucket } = accessBucketPush(b1, get200);
    expect(flushAccessBucket(bucket)).toBe('[x2 access-log 2xx] ' + get200);
  });
});
