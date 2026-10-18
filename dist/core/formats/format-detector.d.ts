export type DetectedFormat = 'logfmt' | 'syslog' | 'json' | 'unknown';
export declare function detectFormat(line: string): DetectedFormat;
export declare function groupHttpStatusCodes(line: string): string;
