export declare const JSON_REPORT_MAX_BYTES: number;
export declare const JSON_REPORT_MIN_REFERENCE_LENGTH = 24;
export declare const JSON_REPORT_MAX_VARIANT_VALUES = 50;
export declare const JSON_GROUP_MARKER = "[logstrip:group]";
export declare const JSON_META_MARKER = "[logstrip:meta]";
export declare const JSON_META_NOTE_MARKER: string;
export interface JsonReportCompression {
    text: string;
    duplicateEntries: number;
    prunedFields: number;
    fieldReferences: number;
}
export interface ClaimedJsonDocument {
    text: string;
    value: unknown;
}
export interface JsonDocumentClaim {
    doc?: ClaimedJsonDocument;
    replay: AsyncIterable<string>;
}
/**
 * Inspect the head of a line stream for a JSON document. Returns the parsed
 * document when the input is one, or a `replay` iterable that re-yields every
 * consumed line followed by the rest of the stream so the standard pipeline
 * sees the input unchanged.
 *
 * A document is claimed when the first non-blank line starts with `{`/`[` and
 * either the whole (capped) input parses as JSON, or that single line parses
 * and nothing but blank lines follow. A first line that parses on its own with
 * more content after it is JSONL (pino/bunyan) and is replayed untouched.
 */
export declare function claimJsonDocument(lines: AsyncIterable<string>, maxBytes: number): Promise<JsonDocumentClaim>;
export declare function replayLines(buffered: readonly string[], iterator: AsyncIterator<string>): AsyncIterable<string>;
/**
 * Compress a parsed JSON document. Lossless by construction except for the
 * shared sanitizer masks and the per-group variant cap.
 */
export declare function compressJsonReport(value: unknown): JsonReportCompression;
