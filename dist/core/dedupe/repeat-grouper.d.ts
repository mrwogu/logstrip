export interface RepeatGroup {
    firstLine: string;
    firstTokens: string[];
    signature: string;
    deltas: Map<number, RepeatDelta>;
    count: number;
    firstSeen: number | null;
    lastSeen: number | null;
    /** Highest relevance score seen across the collapsed lines (for budgeting). */
    score: number;
}
interface RepeatDelta {
    prefix: string;
    suffix: string;
    values: string[];
    hasMoreValues: boolean;
}
export declare function createRepeatSignature(line: string, template?: boolean): string;
export declare function createRepeatGroup(line: string, score?: number, signature?: string): RepeatGroup;
export declare function addRepeatGroupLine(group: RepeatGroup, line: string, score?: number, template?: boolean): void;
export declare function getRepeatGroupSpreadMs(group: RepeatGroup): number | null;
export declare function renderRepeatGroup(group: RepeatGroup): string;
export {};
