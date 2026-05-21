#!/usr/bin/env node
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { parseArgs } from 'node:util';
import {
  parseAggressiveness,
  parseSeverityLevel,
  pathsReferToSameFile,
  processLogStream,
  processLogStreamWithTimeout,
  type Aggressiveness,
  type LogStripResult,
  type MultilineMode,
  type SeverityLevel,
} from '../core/logstrip-parser';
import {
  formatTelemetrySummary,
  loadTelemetry,
  recordTelemetry,
} from '../core/telemetry/telemetry-store';

export const CLI_VERSION = '1.4.0'; // x-release-please-version

export const HELP_TEXT = `Usage: logstrip [INPUT] [options]

Stream-based log compression that trims noisy server logs, build
pipelines, vulnerability scanners, and container workloads down to the
diagnostic context an LLM actually needs.

Arguments:
  INPUT                    Path to the raw log. When omitted, reads from stdin.

Options:
  -o, --output <path>      Write the compressed log to <path>. Defaults to stdout.
  -a, --aggressiveness <l> Compression preset: low | medium | high | aggressive | auto.
                           Default: auto.
  -s, --stats              Print compression statistics to stderr.
  -j, --json               Print LogStripResult JSON to stdout. Requires --output.
  -m, --multiline <mode>   Multiline handling: auto | python | node | java | go | rust | off.
                           Default: off.
      --severity <level>   Minimum severity: fatal | error | warn | info | debug | trace.
      --include <regex>    Keep only lines matching this regex.
      --exclude <regex>    Drop lines matching this regex.
      --sample <N>         Limit output to first N kept lines.
      --max-line-length <n> Truncate lines longer than n chars. Default: 100000.
      --timeout <s>        Stop processing after s seconds.
      --progress           Show progress bar (file input only, requires --output).
      --config <path>      Path to .logstrip.yml config file. Auto-detects from cwd.
      --telemetry          Show cumulative telemetry summary on stderr and exit.
  -h, --help               Show this help text and exit.
  -v, --version            Print the CLI version and exit.

Examples:
  logstrip raw.log -o clean.log
  cat raw.log | logstrip > clean.log
  logstrip raw.log --stats > clean.log
  logstrip raw.log -o clean.log --json
  logstrip traceback.log -m python -o clean.log
  logstrip build.log --exclude 'Downloading|Extracting' -o clean.log
  logstrip huge.log --progress --timeout 30 -o clean.log
`;

const VALID_MULTILINE_MODES: readonly string[] = [
  'auto', 'python', 'node', 'java', 'go', 'rust', 'off',
];

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
  telemetry: boolean;
  help: boolean;
  version: boolean;
}

export interface CliIo {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  stdinIsTTY: boolean;
}

export class CliError extends Error {
  public readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export function parseMultilineMode(value: string): MultilineMode {
  const normalized = value.toLowerCase();
  if (VALID_MULTILINE_MODES.includes(normalized)) {
    return normalized as MultilineMode;
  }
  throw new CliError(
    `Unsupported multiline mode: ${value}. Valid values: ${VALID_MULTILINE_MODES.join(', ')}`,
    2,
  );
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseCliOptions(argv: readonly string[]): CliOptions {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv as string[],
      allowPositionals: true,
      strict: true,
      options: {
        output: { type: 'string', short: 'o' },
        aggressiveness: { type: 'string', short: 'a' },
        stats: { type: 'boolean', short: 's', default: false },
        json: { type: 'boolean', short: 'j', default: false },
        multiline: { type: 'string', short: 'm' },
        severity: { type: 'string' },
        include: { type: 'string' },
        exclude: { type: 'string' },
        sample: { type: 'string' },
        'max-line-length': { type: 'string' },
        timeout: { type: 'string' },
        progress: { type: 'boolean', default: false },
        config: { type: 'string' },
        telemetry: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
  } catch (error) {
    throw new CliError(messageOf(error), 2);
  }

  if (parsed.positionals.length > 1) {
    throw new CliError(
      `Unexpected positional argument: ${parsed.positionals[1]}`,
      2,
    );
  }

  const aggressivenessInput =
    typeof parsed.values.aggressiveness === 'string'
      ? parsed.values.aggressiveness
      : 'auto';

  let aggressiveness: Aggressiveness;
  try {
    aggressiveness = parseAggressiveness(aggressivenessInput);
  } catch (error) {
    throw new CliError(messageOf(error), 2);
  }

  const multilineInput =
    typeof parsed.values.multiline === 'string'
      ? parsed.values.multiline
      : 'off';

  let multiline: MultilineMode;
  try {
    multiline = parseMultilineMode(multilineInput);
  } catch (error) {
    throw new CliError(messageOf(error), 2);
  }

  let severity: SeverityLevel | undefined;
  if (typeof parsed.values.severity === 'string') {
    try {
      severity = parseSeverityLevel(parsed.values.severity);
    } catch (error) {
      throw new CliError(messageOf(error), 2);
    }
  }

  let include: RegExp | undefined;
  if (typeof parsed.values.include === 'string') {
    try { include = new RegExp(parsed.values.include, 'u'); }
    catch { throw new CliError(`Invalid --include regex: ${parsed.values.include}`, 2); }
  }

  let exclude: RegExp | undefined;
  if (typeof parsed.values.exclude === 'string') {
    try { exclude = new RegExp(parsed.values.exclude, 'u'); }
    catch { throw new CliError(`Invalid --exclude regex: ${parsed.values.exclude}`, 2); }
  }

  let sample: number | undefined;
  if (typeof parsed.values.sample === 'string') {
    sample = parseInt(parsed.values.sample, 10);
    if (isNaN(sample) || sample < 1) throw new CliError(`Invalid --sample: ${parsed.values.sample}. Must be a positive integer.`, 2);
  }

  let maxLineLength: number | undefined;
  if (typeof parsed.values['max-line-length'] === 'string') {
    maxLineLength = parseInt(parsed.values['max-line-length'], 10);
    if (isNaN(maxLineLength) || maxLineLength < 100) throw new CliError(`Invalid --max-line-length. Must be >= 100.`, 2);
  }

  let timeout: number | undefined;
  if (typeof parsed.values.timeout === 'string') {
    timeout = parseFloat(parsed.values.timeout);
    if (isNaN(timeout) || timeout < 0.1) throw new CliError(`Invalid --timeout. Must be a positive number.`, 2);
    timeout = Math.round(timeout * 1000);
  }

  const progress = parsed.values.progress === true;

  return {
    input: parsed.positionals[0],
    output:
      typeof parsed.values.output === 'string' ? parsed.values.output : undefined,
    aggressiveness,
    stats: parsed.values.stats === true,
    json: parsed.values.json === true,
    multiline,
    severity,
    include,
    exclude,
    sample,
    maxLineLength,
    timeout,
    progress,
    config:
      typeof parsed.values.config === 'string'
        ? parsed.values.config
        : undefined,
    telemetry: parsed.values.telemetry === true,
    help: parsed.values.help === true,
    version: parsed.values.version === true,
  };
}

export function formatStats(result: LogStripResult): string {
  const lines = [
    'LogStrip compression report',
    `  input lines     : ${result.stats.inputLines}`,
    `  output lines    : ${result.stats.outputLines}`,
    `  dropped lines   : ${result.stats.droppedLines}`,
    `  duplicate lines : ${result.stats.duplicateLines}`,
    `  hidden internal : ${result.stats.hiddenInternalStackLines}`,
    `  input tokens    : ${result.inputTokens}`,
    `  output tokens   : ${result.outputTokens}`,
    `  saved tokens    : ${result.savedTokens}`,
    `  savings         : ${result.savingsPercent.toFixed(2)}%`,
  ];

  if (result.outputPath !== undefined) {
    lines.push(`  output path     : ${result.outputPath}`);
  }

  return `${lines.join('\n')}\n`;
}

export function writeAll(
  stream: NodeJS.WritableStream,
  chunk: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.write(chunk, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export function endStream(stream: Writable): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.end((error?: Error | null) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function runCli(
  argv: readonly string[],
  io: CliIo,
): Promise<number> {
  let options: CliOptions;
  try {
    options = parseCliOptions(argv);
  } catch (error) {
    const cliError = error as CliError;
    await writeAll(io.stderr, `logstrip: ${cliError.message}\n`);
    return cliError.exitCode;
  }

  if (options.help) {
    await writeAll(io.stdout, HELP_TEXT);
    return 0;
  }

  if (options.version) {
    await writeAll(io.stdout, `${CLI_VERSION}\n`);
    return 0;
  }

  if (options.telemetry) {
    const store = loadTelemetry();
    await writeAll(io.stderr, formatTelemetrySummary(store));
    return 0;
  }

  if (options.json && options.output === undefined) {
    await writeAll(
      io.stderr,
      'logstrip: --json requires --output so the compressed log does not collide with the JSON report on stdout\n',
    );
    return 2;
  }

  if (options.progress && options.input === undefined) {
    await writeAll(io.stderr, 'logstrip: --progress requires a file input (not stdin)\n');
    return 2;
  }

  if (options.input === undefined && io.stdinIsTTY) {
    await writeAll(
      io.stderr,
      'logstrip: no INPUT given and stdin is a terminal. Pass a file path or pipe a log.\n',
    );
    return 2;
  }

  if (
    options.input !== undefined &&
    options.output !== undefined &&
    pathsReferToSameFile(options.input, options.output)
  ) {
    await writeAll(
      io.stderr,
      'logstrip: INPUT and --output must be different paths; refusing to overwrite the input log\n',
    );
    return 2;
  }

  const input =
    options.input !== undefined
      ? createReadStream(options.input, { encoding: 'utf8' })
      : (io.stdin as NodeJS.ReadableStream);

  const output =
    options.output !== undefined
      ? createWriteStream(options.output, { encoding: 'utf8' })
      : (io.stdout as NodeJS.WritableStream);

  let result: LogStripResult;
  try {
    result = await processLogStream(input, output as Writable, {
      aggressiveness: options.aggressiveness,
      configPath: options.config,
      multiline: options.multiline,
      severity: options.severity,
    });
  } catch (error) {
    if (options.input !== undefined) {
      (input as Readable).destroy();
    }
    if (options.output !== undefined) {
      (output as Writable).destroy();
    }
    await writeAll(io.stderr, `logstrip: ${messageOf(error)}\n`);
    return 1;
  }

  if (options.output !== undefined) {
    result = { ...result, outputPath: options.output };
    await endStream(output as Writable);
  }

  try { recordTelemetry(result); } catch { /* non-critical, ignore write failures */ }

  if (options.json) {
    await writeAll(io.stdout, `${JSON.stringify(result, null, 2)}\n`);
  } else if (options.stats) {
    await writeAll(io.stderr, formatStats(result));
  }

  return 0;
}

/* v8 ignore start */
if (require.main === module) {
  runCli(process.argv.slice(2), {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    stdinIsTTY: Boolean(process.stdin.isTTY),
  })
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `logstrip: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
/* v8 ignore stop */
