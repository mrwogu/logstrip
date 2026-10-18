export interface SourceMarker {
    value: string;
    weight: number;
}
export interface SourceProfile {
    name: string;
    markers: readonly SourceMarker[];
    diagnosticBoostPatterns: readonly RegExp[];
}
export declare function createSourceProfiles(signatures: readonly (readonly [string, readonly string[]])[]): readonly SourceProfile[];
export declare function sourceMarkerWeight(marker: string): number;
