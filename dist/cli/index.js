#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliError = exports.HELP_TEXT = exports.CLI_VERSION = void 0;
exports.messageOf = messageOf;
exports.parseCliOptions = parseCliOptions;
exports.formatStats = formatStats;
exports.writeAll = writeAll;
exports.endStream = endStream;
exports.runCli = runCli;
const node_fs_1 = require("node:fs");
const node_util_1 = require("node:util");
const logstrip_parser_1 = require("../core/logstrip-parser");
exports.CLI_VERSION = '1.1.0'; // x-release-please-version
exports.HELP_TEXT = `Usage: logstrip [INPUT] [options]

Stream-based log compression that trims noisy server logs, build
pipelines, vulnerability scanners, and container workloads down to the
diagnostic context an LLM actually needs.

Arguments:
  INPUT                    Path to the raw log. When omitted, reads from stdin.

Options:
  -o, --output <path>      Write the compressed log to <path>. Defaults to stdout.
  -a, --aggressiveness <l> Compression preset: low | medium | high | aggressive | auto.
                           Default: high.
  -s, --stats              Print compression statistics to stderr.
  -j, --json               Print LogStripResult as JSON to stdout. Requires --output.
      --config <path>      Path to .logstrip.yml config file. Auto-detects from cwd.
  -h, --help               Show this help text and exit.
  -v, --version            Print the CLI version and exit.

Examples:
  logstrip raw.log -o clean.log
  cat raw.log | logstrip > clean.log
  logstrip raw.log --stats > clean.log
  logstrip raw.log -o clean.log --json
`;
class CliError extends Error {
    exitCode;
    constructor(message, exitCode = 1) {
        super(message);
        this.name = 'CliError';
        this.exitCode = exitCode;
    }
}
exports.CliError = CliError;
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
function parseCliOptions(argv) {
    let parsed;
    try {
        parsed = (0, node_util_1.parseArgs)({
            args: argv,
            allowPositionals: true,
            strict: true,
            options: {
                output: { type: 'string', short: 'o' },
                aggressiveness: { type: 'string', short: 'a' },
                stats: { type: 'boolean', short: 's', default: false },
                json: { type: 'boolean', short: 'j', default: false },
                config: { type: 'string' },
                help: { type: 'boolean', short: 'h', default: false },
                version: { type: 'boolean', short: 'v', default: false },
            },
        });
    }
    catch (error) {
        throw new CliError(messageOf(error), 2);
    }
    if (parsed.positionals.length > 1) {
        throw new CliError(`Unexpected positional argument: ${parsed.positionals[1]}`, 2);
    }
    const aggressivenessInput = typeof parsed.values.aggressiveness === 'string'
        ? parsed.values.aggressiveness
        : 'high';
    let aggressiveness;
    try {
        aggressiveness = (0, logstrip_parser_1.parseAggressiveness)(aggressivenessInput);
    }
    catch (error) {
        throw new CliError(messageOf(error), 2);
    }
    return {
        input: parsed.positionals[0],
        output: typeof parsed.values.output === 'string' ? parsed.values.output : undefined,
        aggressiveness,
        stats: parsed.values.stats === true,
        json: parsed.values.json === true,
        config: typeof parsed.values.config === 'string'
            ? parsed.values.config
            : undefined,
        help: parsed.values.help === true,
        version: parsed.values.version === true,
    };
}
function formatStats(result) {
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
function writeAll(stream, chunk) {
    return new Promise((resolve, reject) => {
        stream.write(chunk, (error) => {
            if (error) {
                reject(error);
            }
            else {
                resolve();
            }
        });
    });
}
function endStream(stream) {
    return new Promise((resolve, reject) => {
        stream.end((error) => {
            if (error) {
                reject(error);
            }
            else {
                resolve();
            }
        });
    });
}
async function runCli(argv, io) {
    let options;
    try {
        options = parseCliOptions(argv);
    }
    catch (error) {
        const cliError = error;
        await writeAll(io.stderr, `logstrip: ${cliError.message}\n`);
        return cliError.exitCode;
    }
    if (options.help) {
        await writeAll(io.stdout, exports.HELP_TEXT);
        return 0;
    }
    if (options.version) {
        await writeAll(io.stdout, `${exports.CLI_VERSION}\n`);
        return 0;
    }
    if (options.json && options.output === undefined) {
        await writeAll(io.stderr, 'logstrip: --json requires --output so the compressed log does not collide with the JSON report on stdout\n');
        return 2;
    }
    if (options.input === undefined && io.stdinIsTTY) {
        await writeAll(io.stderr, 'logstrip: no INPUT given and stdin is a terminal. Pass a file path or pipe a log.\n');
        return 2;
    }
    if (options.input !== undefined &&
        options.output !== undefined &&
        (0, logstrip_parser_1.pathsReferToSameFile)(options.input, options.output)) {
        await writeAll(io.stderr, 'logstrip: INPUT and --output must be different paths; refusing to overwrite the input log\n');
        return 2;
    }
    const input = options.input !== undefined
        ? (0, node_fs_1.createReadStream)(options.input, { encoding: 'utf8' })
        : io.stdin;
    const output = options.output !== undefined
        ? (0, node_fs_1.createWriteStream)(options.output, { encoding: 'utf8' })
        : io.stdout;
    let result;
    try {
        result = await (0, logstrip_parser_1.processLogStream)(input, output, {
            aggressiveness: options.aggressiveness,
            configPath: options.config,
        });
    }
    catch (error) {
        if (options.input !== undefined) {
            input.destroy();
        }
        if (options.output !== undefined) {
            output.destroy();
        }
        await writeAll(io.stderr, `logstrip: ${messageOf(error)}\n`);
        return 1;
    }
    if (options.output !== undefined) {
        result = { ...result, outputPath: options.output };
        await endStream(output);
    }
    if (options.json) {
        await writeAll(io.stdout, `${JSON.stringify(result, null, 2)}\n`);
    }
    else if (options.stats) {
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
        .catch((error) => {
        process.stderr.write(`logstrip: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
/* v8 ignore stop */
