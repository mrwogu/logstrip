export interface ExtractedJsonLog {
    level?: string | number;
    msg?: string;
    errStack?: string;
    raw: Record<string, unknown>;
}
export declare function extractJsonLog(line: string): ExtractedJsonLog | null;
/**
 * Normalize a pino-style numeric level (60=fatal, 50=error, 40=warn, 30=info,
 * 20=debug, 10=trace) to a canonical string. String levels are lowercased
 * as-is. Undefined/missing levels default to "info".
 */
export declare function normalizeJsonLevel(level: unknown): string;
/**
 * Score a JSON log line based on its parsed level field.
 *
 * Returns:
 * - `undefined` if the line does not parse as JSON (fall through to standard scoring)
 * - `null` if the line is a JSON info/debug/trace entry without an error stack (drop)
 * - a number (25-100) for keep-worthy JSON lines
 */
export declare function scoreJsonLine(line: string): number | null | undefined;
