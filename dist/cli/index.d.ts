#!/usr/bin/env node
import { Readable, Writable } from 'node:stream';
import { type Aggressiveness, type LogStripResult, type MultilineMode, type SeverityLevel } from '../core/logstrip-parser';
export declare const CLI_VERSION = "2.0.0";
export declare const HOOK_SUBCOMMAND = "hook";
export declare const HELP_TEXT = "Usage: logstrip [INPUT] [options]\n       logstrip hook\n\nStream-based log compression that trims noisy server logs, build\npipelines, vulnerability scanners, and container workloads down to the\ndiagnostic context an LLM actually needs.\n\nArguments:\n  INPUT                    Path to the raw log. When omitted, reads from stdin.\n                           Input that is not a log (prose, markdown, source code,\n                           configuration) is copied through unchanged, with\n                           credentials masked, instead of being compressed.\n\nSubcommands:\n  hook                     Run as an AI assistant plugin hook. Reads a JSON event\n                           from stdin (PreToolUse or UserPromptSubmit) and emits\n                           the matching hookSpecificOutput JSON to stdout. Used\n                           by the bundled Droid, Claude, Codex, Copilot, and\n                           Cursor plugin manifests.\n\nOptions:\n  -o, --output <path>      Write the compressed log to <path>. Defaults to stdout.\n  -a, --aggressiveness <l> Compression preset: low | medium | high | aggressive | auto.\n                           Default: auto.\n  -s, --stats              Print compression statistics to stderr.\n  -j, --json               Print LogStripResult JSON to stdout. Requires --output.\n  -m, --multiline <mode>   Multiline handling: auto | python | node | java | go | rust | off.\n                           Default: off.\n      --severity <level>   Minimum severity: fatal | error | warn | info | debug | trace.\n      --include <regex>    Keep only lines matching this regex.\n      --exclude <regex>    Drop lines matching this regex.\n      --sample <N>         Limit output to first N kept lines.\n      --max-tokens <N>     Trim output to at most N tokens, keeping the\n                           highest-scoring lines (LLM context-budget mode).\n      --dedupe-window <N>  Collapse non-adjacent duplicate lines seen within\n                           the last N distinct lines. Default: 1 (adjacent only).\n      --format-sample <N>  Majority-vote format detection window over the first\n                           N non-blank lines. Default: 50.\n      --collapse-blocks <N> Collapse consecutive repeats of a block of up to N\n                           lines into one copy plus a [block xM] marker.\n      --no-collapse-repeated-blocks Disable replacing a block of lines that\n                           repeats earlier output (e.g. the same stack trace\n                           printed again) with a [... N lines repeated from\n                           above ...] marker.\n      --no-collapse-stacks Disable auto-collapsing of repeated stack-trace\n                           windows that differ only in addresses/offsets.\n      --no-root-cause      Disable auto-pruning of downstream cascade\n                           restatements (e.g. \"aborting due to previous errors\").\n      --no-multilingual    Disable auto-detection of non-English error/failure\n                           keywords (e.g. \"erreur\", \"Fehler\", \"\u9519\u8BEF\").\n      --no-adaptive-context Disable auto-mode adaptive context windows that\n                           widen around isolated errors and tighten around\n                           clustered ones.\n      --max-stack-frames <N> Keep at most N consecutive application stack\n                           frames per trace; the rest collapse into a\n                           [... K more application stack frames ...] marker.\n                           0 keeps every frame. Default: 10.\n      --no-template-mining Disable folding of near-identical lines that\n                           differ only in a number after a generic word\n                           label (e.g. \"Retrying job 17\" / \"Retrying job 18\").\n      --no-json-report     Disable auto-detection of structured JSON documents\n                           (test reports, scanner exports). Detected documents\n                           are compressed semantically - repeated entries\n                           grouped, duplicate fields referenced, empty fields\n                           pruned - and stay valid JSON.\n      --force              Compress even when the input does not look like a log.\n                           Disables the text passthrough that copies prose,\n                           markdown, code and config files through unchanged.\n      --preserve-id-suffix <N> Keep the last N chars of redacted UUIDs/hashes\n                           (e.g. [ID:74000]) instead of fully masking. 0-16,\n                           0 masks fully. Default: 0.\n      --max-line-length <n> Truncate lines longer than n chars. Default: 100000.\n      --timeout <s>        Stop processing after s seconds.\n      --progress           Show progress bar (file input only, requires --output).\n      --config <path>      Path to .logstrip.yml config file. Auto-detects from cwd.\n      --telemetry          Show cumulative telemetry summary on stderr and exit.\n  -h, --help               Show this help text and exit.\n  -v, --version            Print the CLI version and exit.\n\nExamples:\n  logstrip raw.log -o clean.log\n  cat raw.log | logstrip > clean.log\n  logstrip raw.log --stats > clean.log\n  logstrip raw.log -o clean.log --json\n  logstrip traceback.log -m python -o clean.log\n  logstrip build.log --exclude 'Downloading|Extracting' -o clean.log\n  logstrip output.txt --force -o clean.log\n  logstrip huge.log --progress --timeout 30 -o clean.log\n";
export interface CliOptions {
    input?: string;
    output?: string;
    aggressiveness: Aggressiveness;
    stats: boolean;
    json: boolean;
    multiline: MultilineMode;
    severity?: SeverityLevel;
    include?: RegExp;
    exclude?: RegExp;
    sample?: number;
    maxLineLength?: number;
    timeout?: number;
    progress: boolean;
    config?: string;
    preserveIdSuffix?: number;
    maxTokens?: number;
    collapseRepeatedStacks: boolean;
    dedupeWindow?: number;
    rootCause: boolean;
    formatSample?: number;
    multilingual: boolean;
    collapseBlocks?: number;
    adaptiveContext: boolean;
    maxStackFrames?: number;
    templateMining: boolean;
    collapseRepeatedBlocks: boolean;
    jsonReport: boolean;
    force: boolean;
    telemetry: boolean;
    help: boolean;
    version: boolean;
}
export interface CliIo {
    stdin: NodeJS.ReadableStream;
    stdout: NodeJS.WritableStream;
    stderr: NodeJS.WritableStream;
    stdinIsTTY: boolean;
    stderrIsTTY?: boolean;
}
export declare class CliError extends Error {
    readonly exitCode: number;
    constructor(message: string, exitCode?: number);
}
export declare function parseMultilineMode(value: string): MultilineMode;
export declare function messageOf(error: unknown): string;
export declare function parseCliOptions(argv: readonly string[]): CliOptions;
export declare function formatStats(result: LogStripResult): string;
export declare function writeAll(stream: NodeJS.WritableStream, chunk: string): Promise<void>;
export declare function endStream(stream: Writable): Promise<void>;
export declare function attachProgress(input: Readable, stderr: NodeJS.WritableStream, totalBytes: number): () => Promise<void>;
export declare function runCli(argv: readonly string[], io: CliIo): Promise<number>;
