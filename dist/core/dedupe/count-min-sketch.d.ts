/**
 * Memory-stable approximate frequency counter using the Count-Min Sketch
 * algorithm. Sacrifices exact counts (~0.5% false-positive rate at 8192×4)
 * for constant memory (~128 KB) regardless of stream size.
 */
export declare class CountMinSketch {
    private readonly width;
    private readonly depth;
    private readonly tables;
    constructor(width?: number, depth?: number);
    private hash;
    /**
     * Increment the count for a key and return the new estimated count
     * (the minimum among all hash tables — the count-min estimate).
     *
     * Uses conservative update: only cells currently at the minimum are
     * raised. Cells inflated by hash collisions with hotter keys are left
     * untouched, which cuts overestimation error several-fold at no memory
     * cost — important because overestimates feed false TF-IDF penalties.
     */
    increment(key: string): number;
}
