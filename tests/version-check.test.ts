import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkForUpdates,
  fetchLatestVersion,
  formatUpdateNotification,
  getCacheDir,
  getCachePath,
  isNewerVersion,
} from '../src/cli/version-check';

let cacheDir: string;
const ORIGINAL_FETCH = globalThis.fetch;

function mockResponse(init: {
  ok?: boolean;
  status?: number;
  body?: unknown;
  throws?: Error;
}): typeof globalThis.fetch {
  return vi.fn(async () => {
    if (init.throws) throw init.throws;
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => init.body,
    } as unknown as Response;
  }) as unknown as typeof globalThis.fetch;
}

beforeAll(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'logstrip-version-'));
  process.env.LOGSTRIP_CACHE_DIR = cacheDir;
});

afterAll(async () => {
  await rm(cacheDir, { force: true, recursive: true });
  delete process.env.LOGSTRIP_CACHE_DIR;
  globalThis.fetch = ORIGINAL_FETCH;
});

beforeEach(async () => {
  delete process.env.LOGSTRIP_NO_UPDATE_CHECK;
  // Fresh cache dir each test
  await rm(cacheDir, { force: true, recursive: true });
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('isNewerVersion', () => {
  it('detects greater major/minor/patch', () => {
    expect(isNewerVersion('1.0.0', '2.0.0')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.1.0')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false);
  });

  it('returns false for older latest', () => {
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(false);
    expect(isNewerVersion('1.2.3', '1.2.0')).toBe(false);
  });

  it('ignores v prefix', () => {
    expect(isNewerVersion('v1.0.0', 'v1.0.1')).toBe(true);
  });

  it('treats stable as newer than prerelease of the same base', () => {
    expect(isNewerVersion('1.0.0-alpha.1', '1.0.0')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0-rc.1')).toBe(false);
  });

  it('returns false when both versions share the same prerelease', () => {
    expect(isNewerVersion('1.0.0-rc.1', '1.0.0-rc.1')).toBe(false);
  });

  it('handles current longer than latest', () => {
    expect(isNewerVersion('1.0.1', '1')).toBe(false);
  });

  it('handles missing parts by treating them as zero', () => {
    expect(isNewerVersion('1', '1.0.1')).toBe(true);
    expect(isNewerVersion('1.2', '1.2.0')).toBe(false);
  });

  it('handles non-numeric segments as zero', () => {
    expect(isNewerVersion('1.x.0', '1.0.1')).toBe(true);
  });
});

describe('getCacheDir / getCachePath', () => {
  it('honors LOGSTRIP_CACHE_DIR env override', () => {
    expect(getCacheDir()).toBe(cacheDir);
    expect(getCachePath()).toBe(join(cacheDir, 'version.json'));
  });

  it('falls back to ~/.logstrip/.cache when env var is unset', () => {
    const prev = process.env.LOGSTRIP_CACHE_DIR;
    delete process.env.LOGSTRIP_CACHE_DIR;
    try {
      expect(getCacheDir()).toContain('.logstrip');
      expect(getCachePath()).toContain('version.json');
    } finally {
      process.env.LOGSTRIP_CACHE_DIR = prev;
    }
  });
});

describe('fetchLatestVersion', () => {
  it('returns version string on 200 OK', async () => {
    globalThis.fetch = mockResponse({ body: { version: '9.9.9' } });
    expect(await fetchLatestVersion()).toBe('9.9.9');
  });

  it('returns null on non-OK HTTP', async () => {
    globalThis.fetch = mockResponse({ ok: false, status: 503 });
    expect(await fetchLatestVersion()).toBeNull();
  });

  it('returns null when response lacks a version field', async () => {
    globalThis.fetch = mockResponse({ body: {} });
    expect(await fetchLatestVersion()).toBeNull();
  });

  it('returns null on network error / timeout', async () => {
    globalThis.fetch = mockResponse({ throws: new Error('network down') });
    expect(await fetchLatestVersion()).toBeNull();
  });
});

describe('checkForUpdates', () => {
  it('returns null when LOGSTRIP_NO_UPDATE_CHECK is set', async () => {
    process.env.LOGSTRIP_NO_UPDATE_CHECK = '1';
    globalThis.fetch = mockResponse({ body: { version: '9.9.9' } });
    expect(await checkForUpdates('1.0.0')).toBeNull();
  });

  it('returns UpdateInfo when registry advertises a newer version', async () => {
    globalThis.fetch = mockResponse({ body: { version: '2.0.0' } });
    const info = await checkForUpdates('1.0.0');
    expect(info).toEqual({
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      updateAvailable: true,
    });
    // cache file was written
    const cached = JSON.parse(
      await readFile(getCachePath(), 'utf-8'),
    ) as { latestVersion: string };
    expect(cached.latestVersion).toBe('2.0.0');
  });

  it('returns null when registry version matches current', async () => {
    globalThis.fetch = mockResponse({ body: { version: '1.0.0' } });
    expect(await checkForUpdates('1.0.0')).toBeNull();
  });

  it('returns null when registry fetch fails', async () => {
    globalThis.fetch = mockResponse({ ok: false, status: 500 });
    expect(await checkForUpdates('1.0.0')).toBeNull();
  });

  it('serves a fresh cache without hitting the network', async () => {
    // Warm the cache via a fetch.
    globalThis.fetch = mockResponse({ body: { version: '2.0.0' } });
    expect((await checkForUpdates('1.0.0'))?.latestVersion).toBe('2.0.0');

    // Subsequent call must NOT call fetch.
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof globalThis.fetch;
    const info = await checkForUpdates('1.0.0');
    expect(info?.latestVersion).toBe('2.0.0');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns null from cache when cached latest is not newer', async () => {
    globalThis.fetch = mockResponse({ body: { version: '1.0.0' } });
    await checkForUpdates('1.0.0');
    // Now call again - cached, equal version -> null
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof globalThis.fetch;
    expect(await checkForUpdates('1.0.0')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores stale cache and refetches', async () => {
    // Seed cache directly with an old timestamp.
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      getCachePath(),
      JSON.stringify({
        lastCheck: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        latestVersion: '1.0.0',
        currentVersion: '1.0.0',
      }),
      'utf-8',
    );
    globalThis.fetch = mockResponse({ body: { version: '3.0.0' } });
    const info = await checkForUpdates('1.0.0');
    expect(info?.latestVersion).toBe('3.0.0');
  });

  it('ignores cache when currentVersion does not match', async () => {
    globalThis.fetch = mockResponse({ body: { version: '2.0.0' } });
    await checkForUpdates('1.0.0');
    // Now call with a different currentVersion -> cache mismatch, refetch
    globalThis.fetch = mockResponse({ body: { version: '3.0.0' } });
    const info = await checkForUpdates('2.5.0');
    expect(info?.latestVersion).toBe('3.0.0');
  });

  it('ignores cache with corrupt lastCheck timestamp', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      getCachePath(),
      JSON.stringify({
        lastCheck: 'not-a-date',
        latestVersion: '1.0.0',
        currentVersion: '1.0.0',
      }),
      'utf-8',
    );
    globalThis.fetch = mockResponse({ body: { version: '2.0.0' } });
    const info = await checkForUpdates('1.0.0');
    expect(info?.latestVersion).toBe('2.0.0');
  });

  it('silently ignores cache write failures', async () => {
    const prev = process.env.LOGSTRIP_CACHE_DIR;
    process.env.LOGSTRIP_CACHE_DIR = '/dev/null/impossible';
    try {
      globalThis.fetch = mockResponse({ body: { version: '2.0.0' } });
      const info = await checkForUpdates('1.0.0');
      expect(info?.latestVersion).toBe('2.0.0');
    } finally {
      process.env.LOGSTRIP_CACHE_DIR = prev;
    }
  });
});

describe('formatUpdateNotification', () => {
  it('renders a single-line stderr message', () => {
    const out = formatUpdateNotification({
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      updateAvailable: true,
    });
    expect(out).toBe(
      'logstrip: update available 1.0.0 \u2192 2.0.0 (npm i -g logstrip)\n',
    );
  });
});
