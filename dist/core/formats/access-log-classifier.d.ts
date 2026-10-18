export interface AccessLogMatch {
    path: string;
    status: number;
    userAgent: string;
}
export declare function matchAccessLogLine(line: string): AccessLogMatch | null;
export declare function isAccessLogLine(line: string): boolean;
export declare function isAccessLogNoiseLine(line: string): boolean;
export declare function extractHttpStatusFromLine(line: string): number;
