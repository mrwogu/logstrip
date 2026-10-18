export type MultilineMode = 'auto' | 'auto-source' | 'python' | 'node' | 'java' | 'go' | 'rust' | 'off';
export interface ContinuationContext {
    mode: MultilineMode;
    groupLineCount: number;
    groupByteCount: number;
    previousLine: string;
    /**
     * For auto-source mode: the resolved effective mode derived from detected sources.
     * Updated externally when the top detected source changes.
     */
    effectiveMode?: Exclude<MultilineMode, 'auto-source'>;
}
export declare function createContinuationContext(mode: MultilineMode): ContinuationContext;
export declare function isContinuationLine(line: string, ctx: ContinuationContext): boolean;
