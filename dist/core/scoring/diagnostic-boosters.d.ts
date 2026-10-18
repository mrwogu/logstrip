export interface DiagnosticBooster {
    pattern: RegExp;
    score: number;
    label: string;
    source?: string;
}
/**
 * Consolidated diagnostic booster table.
 *
 * Boosters without a `source` field apply globally in `scoreLineRelevance`.
 * Those with a `source` field are used by `source-profile.ts` for per-source
 * diagnostic boosts that only fire when the source is confidently detected.
 */
export declare const HTTP_5XX_FIELD_PATTERN: RegExp;
export declare const HTTP_4XX_FIELD_PATTERN: RegExp;
export declare const DIAGNOSTIC_BOOSTERS: readonly DiagnosticBooster[];
/**
 * Extract just the patterns keyed by source name, for use in
 * `source-profile.ts` (each source has its own diagnostic boost patterns).
 */
export declare function buildSourceBoosterPatterns(): Map<string, RegExp[]>;
