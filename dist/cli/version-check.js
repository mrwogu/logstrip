"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheDir = getCacheDir;
exports.getCachePath = getCachePath;
exports.fetchLatestVersion = fetchLatestVersion;
exports.isNewerVersion = isNewerVersion;
exports.checkForUpdates = checkForUpdates;
exports.formatUpdateNotification = formatUpdateNotification;
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const NPM_REGISTRY_URL = 'https://registry.npmjs.org/logstrip/latest';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;
function getCacheDir() {
    return (process.env.LOGSTRIP_CACHE_DIR ??
        (0, node_path_1.join)((0, node_os_1.homedir)(), '.logstrip', '.cache'));
}
function getCachePath() {
    return (0, node_path_1.join)(getCacheDir(), 'version.json');
}
async function readCache() {
    try {
        const content = await (0, promises_1.readFile)(getCachePath(), 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
async function writeCache(cache) {
    try {
        await (0, promises_1.mkdir)(getCacheDir(), { recursive: true });
        await (0, promises_1.writeFile)(getCachePath(), JSON.stringify(cache, null, 2), 'utf-8');
    }
    catch {
        /* silently ignore cache write errors */
    }
}
function isCacheValid(cache) {
    const last = new Date(cache.lastCheck).getTime();
    if (Number.isNaN(last)) {
        return false;
    }
    return Date.now() - last < CACHE_TTL_MS;
}
async function fetchLatestVersion() {
    try {
        const controller = new AbortController();
        /* v8 ignore next */
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let response;
        try {
            response = await fetch(NPM_REGISTRY_URL, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
        }
        finally {
            clearTimeout(timer);
        }
        if (!response.ok) {
            return null;
        }
        const data = (await response.json());
        return data.version ?? null;
    }
    catch {
        return null;
    }
}
function isNewerVersion(currentVersion, latestVersion) {
    const cleanCurrent = currentVersion.replace(/^v/u, '');
    const cleanLatest = latestVersion.replace(/^v/u, '');
    const dashCurrent = cleanCurrent.indexOf('-');
    const dashLatest = cleanLatest.indexOf('-');
    const currentBase = dashCurrent === -1 ? cleanCurrent : cleanCurrent.slice(0, dashCurrent);
    const latestBase = dashLatest === -1 ? cleanLatest : cleanLatest.slice(0, dashLatest);
    const currentPre = dashCurrent === -1 ? '' : cleanCurrent.slice(dashCurrent + 1);
    const latestPre = dashLatest === -1 ? '' : cleanLatest.slice(dashLatest + 1);
    const currentParts = currentBase.split('.').map((p) => parseInt(p, 10) || 0);
    const latestParts = latestBase.split('.').map((p) => parseInt(p, 10) || 0);
    const len = Math.max(currentParts.length, latestParts.length);
    for (let i = 0; i < len; i++) {
        const c = i < currentParts.length ? currentParts[i] : 0;
        const l = i < latestParts.length ? latestParts[i] : 0;
        if (l > c)
            return true;
        if (l < c)
            return false;
    }
    // Base versions are equal; a stable release is newer than a prerelease.
    if (currentPre && !latestPre)
        return true;
    return false;
}
/**
 * Check npm for a newer logstrip release. Respects a 24h on-disk cache
 * at ~/.logstrip/.cache/version.json (override via $LOGSTRIP_CACHE_DIR)
 * and is disabled when $LOGSTRIP_NO_UPDATE_CHECK is set. Returns null on
 * any failure - this is best-effort, never blocking.
 */
async function checkForUpdates(currentVersion) {
    if (process.env.LOGSTRIP_NO_UPDATE_CHECK) {
        return null;
    }
    const cache = await readCache();
    if (cache &&
        isCacheValid(cache) &&
        cache.currentVersion === currentVersion) {
        if (isNewerVersion(currentVersion, cache.latestVersion)) {
            return {
                currentVersion,
                latestVersion: cache.latestVersion,
                updateAvailable: true,
            };
        }
        return null;
    }
    const latestVersion = await fetchLatestVersion();
    if (!latestVersion) {
        return null;
    }
    await writeCache({
        lastCheck: new Date().toISOString(),
        latestVersion,
        currentVersion,
    });
    if (isNewerVersion(currentVersion, latestVersion)) {
        return { currentVersion, latestVersion, updateAvailable: true };
    }
    return null;
}
function formatUpdateNotification(info) {
    return `logstrip: update available ${info.currentVersion} \u2192 ${info.latestVersion} (npm i -g logstrip)\n`;
}
