export interface LogStripSourceSignature {
    name: string;
    markers: readonly string[];
}
export interface LogStripCustomConfig {
    sources: readonly LogStripSourceSignature[];
    diagnosticPatterns: readonly string[];
    ignorePatterns: readonly string[];
    sanitizePatterns: readonly SanitizeRule[];
    internalStackPatterns: readonly string[];
}
export interface SanitizeRule {
    pattern: string;
    replacement: string;
    flags?: string;
}
export declare function parseLogStripConfig(content: string): LogStripCustomConfig;
export declare function loadLogStripConfig(explicitPath?: string, startDir?: string): LogStripCustomConfig;
export declare function resolveConfigPath(explicitPath?: string, startDir?: string): string | undefined;
