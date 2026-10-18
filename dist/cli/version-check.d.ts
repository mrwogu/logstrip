export interface UpdateInfo {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
}
export declare function getCacheDir(): string;
export declare function getCachePath(): string;
export declare function fetchLatestVersion(): Promise<string | null>;
export declare function isNewerVersion(currentVersion: string, latestVersion: string): boolean;
/**
 * Check npm for a newer logstrip release. Respects a 24h on-disk cache
 * at ~/.logstrip/.cache/version.json (override via $LOGSTRIP_CACHE_DIR)
 * and is disabled when $LOGSTRIP_NO_UPDATE_CHECK is set. Returns null on
 * any failure - this is best-effort, never blocking.
 */
export declare function checkForUpdates(currentVersion: string): Promise<UpdateInfo | null>;
export declare function formatUpdateNotification(info: UpdateInfo): string;
