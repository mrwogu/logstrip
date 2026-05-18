#!/usr/bin/env node
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { parseArgs } from 'node:util';
import {
  parseAggressiveness,
  pathsReferToSameFile,
  processLogStream,
  type Aggressiveness,
  type BonsaiResult,
} from '../core/bonsai-parser';

export const CLI_VERSION = '1.0.0'; // x-release-please-version

export const HELP_TEXT = `Usage: bonsai [INPUT] [options]

Stream-based log compression that trims noisy server logs, build
pipelines, vulnerability scanners, and container workloads down to the
diagnostic context an LLM actually needs.

Arguments:
  INPUT                    Path to the raw log. When omitted, reads from stdin.

Options:
  -o, --output <path>      Write the compressed log to <path>. Defaults to stdout.
  -a, --aggressiveness <l> Compression preset: low | medium | high | aggressive.
                           Default: high.
  -s, --stats              Print compression statistics to stderr.
  -j, --json               Print BonsaiResult as JSON to stdout. Requires --output.
  -h, --help               Show this help text and exit.
  -v, --version            Print the CLI version and exit.

Examples:
  bonsai raw.log -o clean.log
  cat raw.log | bonsai > clean.log
  bonsai raw.log --stats > clean.log
  bonsai raw.log -o clean.log --json
`;

export interface CliOptions {
  input?: string;
  output?: string;
  aggressiveness: Aggressiveness;
  stats: boolean;
  json: boolean;
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
      : 'high';

  let aggressiveness: Aggressiveness;
  try {
    aggressiveness = parseAggressiveness(aggressivenessInput);
  } catch (error) {
    throw new CliError(messageOf(error), 2);
  }

  return {
    input: parsed.positionals[0],
    output:
      typeof parsed.values.output === 'string' ? parsed.values.output : undefined,
    aggressiveness,
    stats: parsed.values.stats === true,
    json: parsed.values.json === true,
    help: parsed.values.help === true,
    version: parsed.values.version === true,
  };
}

export function formatStats(result: BonsaiResult): string {
  const lines = [
    'ContextBonsai compression report',
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
    await writeAll(io.stderr, `bonsai: ${cliError.message}\n`);
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

  if (options.json && options.output === undefined) {
    await writeAll(
      io.stderr,
      'bonsai: --json requires --output so the compressed log does not collide with the JSON report on stdout\n',
    );
    return 2;
  }

  if (options.input === undefined && io.stdinIsTTY) {
    await writeAll(
      io.stderr,
      'bonsai: no INPUT given and stdin is a terminal. Pass a file path or pipe a log.\n',
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
      'bonsai: INPUT and --output must be different paths; refusing to overwrite the input log\n',
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

  let result: BonsaiResult;
  try {
    result = await processLogStream(input, output as Writable, {
      aggressiveness: options.aggressiveness,
    });
  } catch (error) {
    if (options.input !== undefined) {
      (input as Readable).destroy();
    }
    if (options.output !== undefined) {
      (output as Writable).destroy();
    }
    await writeAll(io.stderr, `bonsai: ${messageOf(error)}\n`);
    return 1;
  }

  if (options.output !== undefined) {
    result = { ...result, outputPath: options.output };
    await endStream(output as Writable);
  }

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
        `bonsai: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
/* v8 ignore stop */
