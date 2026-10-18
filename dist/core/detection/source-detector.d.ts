import { type SourceProfile } from '../sources/source-profile.js';
import { type AhoCorasick } from './aho-corasick.js';
export declare const SOURCE_ACTIVE_CONFIDENCE = 12;
export declare const SOURCE_DIAGNOSTIC_BOOST = 40;
/**
 * Adaptive threshold: small logs need fewer marker hits to activate a source.
 * Reduces the required confidence proportionally when total input lines are low.
 */
export declare function getEffectiveActiveConfidence(inputLines: number): number;
export interface SourceDetectionHit {
    hits: number;
    confidence: number;
    matchedMarkers: Set<string>;
}
export interface SourceDetectionState {
    hits: Map<string, SourceDetectionHit>;
    profiles: readonly SourceProfile[];
    automaton: AhoCorasick;
}
export declare function createSourceDetectionState(sources?: readonly (readonly [string, readonly string[]])[]): SourceDetectionState;
export declare function collectDetectedSourceHits(line: string, state: SourceDetectionState): void;
export declare function rankDetectedSources(state: SourceDetectionState, limit?: number): readonly string[];
export declare function detectLogSources(input: string | readonly string[], limit?: number): readonly string[];
export declare function scoreSourceDiagnosticBoost(line: string, state: SourceDetectionState, inputLines?: number): number;
