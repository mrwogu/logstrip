import type { Aggressiveness, StaticAggressiveness } from '../types.js';
export interface DynamicAggressivenessState {
    enabled: boolean;
    effective: StaticAggressiveness;
    windowLines: number;
    keptLines: number;
    droppedLines: number;
    hardKeeps: number;
    repeatedLines: number;
}
export interface LineDecision {
    kept: boolean;
    dropped: boolean;
    hardKeep: boolean;
    repeated: boolean;
}
export declare function createDynamicAggressivenessState(requested: Aggressiveness): DynamicAggressivenessState;
export declare function recordLineDecision(state: DynamicAggressivenessState, decision: LineDecision): void;
