/**
 * Minimal Aho-Corasick multi-pattern matcher.
 *
 * Finds, in a single O(text length) pass, the set of patterns that occur as
 * substrings of a text. Used by the source detector to replace thousands of
 * per-marker `String.includes` scans per line with one automaton traversal.
 *
 * Matching is performed over UTF-16 code units, matching `String.includes`
 * semantics exactly; all source markers are ASCII so results are identical.
 */
interface AcNode {
    next: Map<string, number>;
    fail: number;
    outputs: string[];
}
export interface AhoCorasick {
    nodes: AcNode[];
    isEmpty: boolean;
}
export declare function buildAhoCorasick(patterns: Iterable<string>): AhoCorasick;
export declare function matchAll(ac: AhoCorasick, text: string): Set<string>;
export {};
