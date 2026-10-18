export type SeverityLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
export declare const VALID_SEVERITY_LEVELS: readonly string[];
export declare function parseSeverityLevel(value: string): SeverityLevel;
export declare function inferSeverity(line: string): SeverityLevel | undefined;
export declare function passesSeverityFilter(line: string, minLevel: SeverityLevel): boolean;
