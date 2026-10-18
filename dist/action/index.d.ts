import { type LogStripResult } from '../core/logstrip-parser';
export declare function run(): Promise<void>;
export declare function buildOutputPath(inputPath: string): string;
export declare function getRepositorySlug(): Promise<string>;
export declare function writeSummary(result: LogStripResult, repository?: string): Promise<void>;
