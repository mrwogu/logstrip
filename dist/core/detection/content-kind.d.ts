export type ContentKind = 'log' | 'text';
export interface ContentClassification {
    kind: ContentKind;
    /** Sampled lines that look like log output. */
    logLines: number;
    /** Sampled lines that look like prose, markup, code or configuration. */
    textLines: number;
    /** Non-blank lines that were scored (log, text and undecided ones). */
    sampledLines: number;
}
export interface ContentSampleLimits {
    maxLines: number;
    maxBytes: number;
}
export declare const DEFAULT_CONTENT_SAMPLE_LIMITS: ContentSampleLimits;
/**
 * True once a sample holds as many non-blank lines, or as many bytes (blank
 * lines included), as the limits allow. Callers stop reading at that point.
 */
export declare function isContentSampleFull(sampledLines: number, sampledBytes: number, limits?: ContentSampleLimits): boolean;
/**
 * Scores the leading lines of an input one at a time, so a caller that reads
 * a stream can stop as soon as the verdict is settled. classifyContent runs
 * the same sampler over a finished array.
 */
export declare class ContentSampler {
    private readonly limits;
    private strongLogLines;
    private weakLogLines;
    private textLines;
    private sampledLines;
    private sampledBytes;
    private insideFence;
    private fencedLines;
    constructor(limits?: ContentSampleLimits);
    /** True once the sample holds as many lines or bytes as the limits allow. */
    isFull(): boolean;
    /** Score one physical line. Lines that arrive after the sample is full are ignored. */
    add(line: string): void;
    /**
     * True once the verdict is 'log' and more lines cannot change it, or is
     * taken to be 'log' because the sample already reads like a log. Only a
     * 'text' verdict needs the whole sample.
     */
    isLogDecided(): boolean;
    /** The classification of the lines added so far. */
    result(): ContentClassification;
    private logScore;
}
/**
 * Decide whether the leading lines of an input are log output or plain text
 * (prose, markup, source code, configuration, data).
 *
 * Only the first DEFAULT_CONTENT_SAMPLE_LINES non-blank lines, up to
 * DEFAULT_CONTENT_SAMPLE_BYTES, are scored. When the sample does not clearly
 * look like text the result is 'log', so unrecognised formats keep today's
 * behaviour of being compressed.
 */
export declare function classifyContent(lines: readonly string[], limits?: ContentSampleLimits): ContentClassification;
