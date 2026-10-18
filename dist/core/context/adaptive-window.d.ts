export interface AdaptiveAfterBounds {
    minAfter: number;
    baseAfter: number;
    maxAfter: number;
    denseGap: number;
    sparseGap: number;
}
export declare function buildAdaptiveAfterBounds(baseAfter: number): AdaptiveAfterBounds;
export declare function neutralErrorGap(bounds: AdaptiveAfterBounds): number;
export declare function resolveAdaptiveAfterWindow(linesSinceError: number, bounds: AdaptiveAfterBounds): number;
