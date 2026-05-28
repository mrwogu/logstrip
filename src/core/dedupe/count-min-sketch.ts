import { createHash } from 'node:crypto';

/**
 * Memory-stable approximate frequency counter using the Count-Min Sketch
 * algorithm. Sacrifices exact counts (~0.5% false-positive rate at 8192×4)
 * for constant memory (~128 KB) regardless of stream size.
 */
export class CountMinSketch {
  private readonly tables: Uint32Array[];

  constructor(
    private readonly width = 8192,
    private readonly depth = 4,
  ) {
    this.tables = Array.from({ length: depth }, () => new Uint32Array(width));
  }

  private hash(key: string, seed: number): number {
    const h = createHash('sha1').update(`${seed}:${key}`).digest();
    return h.readUInt32BE(0) % this.width;
  }

  /**
   * Increment the count for a key and return the new estimated count
   * (the minimum among all hash tables — the count-min estimate).
   */
  increment(key: string): number {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.depth; i++) {
      const idx = this.hash(key, i);
      const next = this.tables[i][idx] + 1;
      this.tables[i][idx] = next;
      if (next < min) min = next;
    }
    return min;
  }
}
