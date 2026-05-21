import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable, Writable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CLI_VERSION,
  CliError,
  endStream,
  formatStats,
  HELP_TEXT,
  messageOf,
  parseCliOptions,
  runCli,
  writeAll,
  type CliIo,
} from '../src/cli/index';

function bufferWritable(): Writable & { value: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, cb) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      cb();
    },
  }) as Writable & { value: () => string };

  stream.value = () => Buffer.concat(chunks).toString('utf8');
  return stream;
}

function bufferReadable(content: string): Readable {
  return Readable.from([content]);
}

function makeIo(
  input: Readable,
  options: { stdinIsTTY?: boolean } = {},
): { io: CliIo; stdout: ReturnType<typeof bufferWritable>; stderr: ReturnType<typeof bufferWritable> } {
  const stdout = bufferWritable();
  const stderr = bufferWritable();
  return {
    io: {
      stdin: input,
      stdout,
      stderr,
      stdinIsTTY: options.stdinIsTTY ?? false,
    },
    stdout,
    stderr,
  };
}

let workDir: string;
const telemetryDir = join(tmpdir(), 'logstrip-cli-telemetry');

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'logstrip-cli-'));
  process.env.LOGSTRIP_TELEMETRY_DIR = telemetryDir;
});

afterAll(async () => {
  await rm(workDir, { force: true, recursive: true });
  try { await rm(telemetryDir, { force: true, recursive: true }); } catch {}
  delete process.env.LOGSTRIP_TELEMETRY_DIR;
});

describe('parseCliOptions', () => {
  it('returns defaults when only an input is given', () => {
    const opts = parseCliOptions(['raw.log']);

    expect(opts.input).toBe('raw.log');
    expect(opts.output).toBeUndefined();
    expect(opts.aggressiveness).toBe('auto');
    expect(opts.stats).toBe(false);
    expect(opts.json).toBe(false);
    expect(opts.config).toBeUndefined();
    expect(opts.help).toBe(false);
    expect(opts.version).toBe(false);
  });

  it('parses --config flag', () => {
    const opts = parseCliOptions(['raw.log', '--config', '.logstrip.yml']);

    expect(opts.input).toBe('raw.log');
    expect(opts.config).toBe('.logstrip.yml');
  });

  it('parses --telemetry flag', () => {
    const opts = parseCliOptions(['--telemetry']);

    expect(opts.telemetry).toBe(true);
  });

  it('defaults telemetry to false', () => {
    const opts = parseCliOptions(['raw.log']);

    expect(opts.telemetry).toBe(false);
  });

  it('parses every short flag', () => {
    const opts = parseCliOptions([
      'raw.log',
      '-o',
      'out.log',
      '-a',
      'low',
      '-s',
      '-j',
    ]);

    expect(opts).toMatchObject({
      input: 'raw.log',
      output: 'out.log',
      aggressiveness: 'low',
      stats: true,
      json: true,
    });
  });

  it('parses every long flag', () => {
    const opts = parseCliOptions([
      '--output',
      'out.log',
      '--aggressiveness',
      'aggressive',
      '--stats',
      '--json',
      '--help',
      '--version',
    ]);

    expect(opts).toMatchObject({
      output: 'out.log',
      aggressiveness: 'aggressive',
      stats: true,
      json: true,
      help: true,
      version: true,
    });
  });

  it('parses auto aggressiveness', () => {
    const opts = parseCliOptions(['raw.log', '--aggressiveness', 'auto']);

    expect(opts.aggressiveness).toBe('auto');
  });

  it('rejects unknown flags via CliError(exitCode=2)', () => {
    const error = (() => {
      try {
        parseCliOptions(['--nope']);
        return undefined;
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
  });

  it('rejects extra positionals via CliError(exitCode=2)', () => {
    const error = (() => {
      try {
        parseCliOptions(['raw.log', 'extra.log']);
        return undefined;
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
    expect((error as CliError).message).toContain('Unexpected positional');
  });

  it('rejects unsupported aggressiveness as CliError(exitCode=2)', () => {
    const error = (() => {
      try {
        parseCliOptions(['-a', 'extreme', 'raw.log']);
        return undefined;
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
    expect((error as CliError).message).toContain('Unsupported aggressiveness');
  });
});

describe('writeAll', () => {
  it('rejects when the stream callback signals an error', async () => {
    const broken = new Writable({
      write(_chunk, _encoding, cb) {
        cb(new Error('write broken'));
      },
    });
    broken.on('error', () => undefined);

    await expect(writeAll(broken, 'data')).rejects.toThrow('write broken');
  });

  it('resolves on normal writes', async () => {
    const sink = bufferWritable();

    await expect(writeAll(sink, 'ok')).resolves.toBeUndefined();
    expect(sink.value()).toBe('ok');
  });
});

describe('endStream', () => {
  it('rejects when the end callback signals an error', async () => {
    const broken = new Writable({
      write(_chunk, _encoding, cb) {
        cb();
      },
      final(cb) {
        cb(new Error('end broken'));
      },
    });
    broken.on('error', () => undefined);

    await expect(endStream(broken)).rejects.toThrow('end broken');
  });

  it('resolves on graceful end', async () => {
    const sink = new PassThrough();

    await expect(endStream(sink)).resolves.toBeUndefined();
  });
});

describe('messageOf', () => {
  it('returns the error message for Error instances', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
  });

  it('coerces non-Error values to string', () => {
    expect(messageOf('plain')).toBe('plain');
    expect(messageOf(42)).toBe('42');
  });
});

describe('formatStats', () => {
  it('renders compact stats with the output path when present', () => {
    const text = formatStats({
      inputTokens: 100,
      outputTokens: 25,
      savedTokens: 75,
      savingsPercent: 75,
      outputPath: '/tmp/out.log',
      stats: {
        droppedLines: 3,
        duplicateLines: 2,
        hiddenInternalStackLines: 1,
        inputBytes: 1000,
        inputLines: 10,
        inputWords: 77,
        outputBytes: 250,
        outputLines: 4,
        outputWords: 19,
      },
    });

    expect(text).toContain('input lines     : 10');
    expect(text).toContain('savings         : 75.00%');
    expect(text).toContain('output path     : /tmp/out.log');
  });

  it('omits output path when missing', () => {
    const text = formatStats({
      inputTokens: 0,
      outputTokens: 0,
      savedTokens: 0,
      savingsPercent: 0,
      stats: {
        droppedLines: 0,
        duplicateLines: 0,
        hiddenInternalStackLines: 0,
        inputBytes: 0,
        inputLines: 0,
        inputWords: 0,
        outputBytes: 0,
        outputLines: 0,
        outputWords: 0,
      },
    });

    expect(text).not.toContain('output path');
  });
});

describe('runCli', () => {
  let counter = 0;
  let inputPath: string;

  beforeEach(async () => {
    counter += 1;
    inputPath = join(workDir, `raw-${counter}.log`);
    await writeFile(
      inputPath,
      [
        '[INFO] boot ok',
        '[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed',
        '[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed',
        '',
      ].join('\n'),
      'utf8',
    );
  });

  it('compresses stdin to stdout when no paths are given', async () => {
    const { io, stdout, stderr } = makeIo(
      bufferReadable(
        [
          '[INFO] boot',
          '[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed',
          '[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed',
          '',
        ].join('\n'),
      ),
    );

    const code = await runCli([], io);

    expect(code).toBe(0);
    expect(stdout.value()).toContain('[x2] [ERROR] request [ID] failed');
    expect(stderr.value()).toBe('');
  });

  it('compresses a file to a file and stays silent without --stats', async () => {
    const outputPath = join(workDir, `out-${counter}.log`);
    const { io, stdout, stderr } = makeIo(new PassThrough());

    const code = await runCli([inputPath, '-o', outputPath], io);

    expect(code).toBe(0);
    expect(stdout.value()).toBe('');
    expect(stderr.value()).toBe('');
    expect(await readFile(outputPath, 'utf8')).toContain(
      '[x2] [ERROR] request [ID] failed',
    );
  });

  it('rejects identical input and output paths before truncating the log', async () => {
    const original = await readFile(inputPath, 'utf8');
    const { io, stderr } = makeIo(new PassThrough());

    const code = await runCli([inputPath, '-o', inputPath], io);

    expect(code).toBe(2);
    expect(stderr.value()).toContain('must be different paths');
    expect(await readFile(inputPath, 'utf8')).toBe(original);
  });

  it('rejects case-only input and output path variants', async () => {
    const { io, stderr } = makeIo(new PassThrough());

    const code = await runCli([inputPath, '-o', inputPath.toUpperCase()], io);

    expect(code).toBe(2);
    expect(stderr.value()).toContain('must be different paths');
  });

  it('writes stats to stderr when --stats is set with --output', async () => {
    const outputPath = join(workDir, `out-${counter}.log`);
    const { io, stderr } = makeIo(new PassThrough());

    const code = await runCli([inputPath, '-o', outputPath, '--stats'], io);

    expect(code).toBe(0);
    expect(stderr.value()).toContain('LogStrip compression report');
    expect(stderr.value()).toContain('savings');
  });

  it('writes JSON to stdout when --json is set with --output', async () => {
    const outputPath = join(workDir, `out-${counter}.log`);
    const { io, stdout } = makeIo(new PassThrough());

    const code = await runCli([inputPath, '-o', outputPath, '--json'], io);

    expect(code).toBe(0);
    const report = JSON.parse(stdout.value()) as { savingsPercent: number };
    expect(report.savingsPercent).toBeGreaterThan(0);
  });

  it('rejects --json without --output as usage error', async () => {
    const { io, stderr } = makeIo(new PassThrough());

    const code = await runCli([inputPath, '--json'], io);

    expect(code).toBe(2);
    expect(stderr.value()).toContain('--json requires --output');
  });

  it('refuses to read stdin when it is a TTY', async () => {
    const { io, stderr } = makeIo(new PassThrough(), { stdinIsTTY: true });

    const code = await runCli([], io);

    expect(code).toBe(2);
    expect(stderr.value()).toContain('stdin is a terminal');
  });

  it('reports flag errors with friendly stderr', async () => {
    const { io, stderr } = makeIo(new PassThrough());

    const code = await runCli(['--unknown'], io);

    expect(code).toBe(2);
    expect(stderr.value()).toContain('logstrip:');
  });

  it('reports unsupported aggressiveness as exit 2', async () => {
    const { io, stderr } = makeIo(new PassThrough());

    const code = await runCli([inputPath, '-a', 'extreme'], io);

    expect(code).toBe(2);
    expect(stderr.value()).toContain('Unsupported aggressiveness');
  });

  it('handles runtime errors from processLogFile as exit 1', async () => {
    const { io, stderr } = makeIo(new PassThrough());

    const code = await runCli(
      [join(workDir, 'missing.log'), '-o', join(workDir, 'never.log')],
      io,
    );

    expect(code).toBe(1);
    expect(stderr.value()).toContain('logstrip:');
  });

  it('reports stdin/stdout pipeline errors as exit 1', async () => {
    const stdin = new Readable({
      read() {
        this.destroy(new Error('stdin pipe broken'));
      },
    });
    const { io, stderr } = makeIo(stdin);

    const code = await runCli([], io);

    expect(code).toBe(1);
    expect(stderr.value()).toContain('stdin pipe broken');
  });

  it('prints help when --help is set', async () => {
    const { io, stdout } = makeIo(new PassThrough());

    const code = await runCli(['--help'], io);

    expect(code).toBe(0);
    expect(stdout.value()).toBe(HELP_TEXT);
  });

  it('prints version when --version is set', async () => {
    const { io, stdout } = makeIo(new PassThrough());

    const code = await runCli(['--version'], io);

    expect(code).toBe(0);
    expect(stdout.value()).toBe(`${CLI_VERSION}\n`);
  });

  it('parses --multiline flag', () => {
    const opts = parseCliOptions(['raw.log', '--multiline', 'python']);
    expect(opts.multiline).toBe('python');
  });

  it('parses --severity flag', () => {
    const opts = parseCliOptions(['raw.log', '--severity', 'error']);
    expect(opts.severity).toBe('error');
  });

  it('parses --include flag', () => {
    const opts = parseCliOptions(['raw.log', '--include', 'ERROR|WARN']);
    expect(opts.include).toBeInstanceOf(RegExp);
    expect(opts.include?.source).toBe('ERROR|WARN');
  });

  it('parses --exclude flag', () => {
    const opts = parseCliOptions(['raw.log', '--exclude', 'DEBUG|TRACE']);
    expect(opts.exclude).toBeInstanceOf(RegExp);
    expect(opts.exclude?.source).toBe('DEBUG|TRACE');
  });

  it('parses --sample flag', () => {
    const opts = parseCliOptions(['raw.log', '--sample', '10']);
    expect(opts.sample).toBe(10);
  });

  it('parses --max-line-length flag', () => {
    const opts = parseCliOptions(['raw.log', '--max-line-length', '500']);
    expect(opts.maxLineLength).toBe(500);
  });

  it('parses --timeout flag', () => {
    const opts = parseCliOptions(['raw.log', '--timeout', '30']);
    expect(opts.timeout).toBe(30000);
  });

  it('parses --progress flag', () => {
    const opts = parseCliOptions(['raw.log', '--progress', '-o', 'out.log']);
    expect(opts.progress).toBe(true);
  });

  it('rejects invalid --multiline mode', () => {
    const error = (() => {
      try { parseCliOptions(['raw.log', '--multiline', 'badmode']); return undefined; }
      catch (e) { return e; }
    })();
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
    expect((error as CliError).message).toContain('Unsupported multiline mode');
  });

  it('rejects invalid --severity level', () => {
    const error = (() => {
      try { parseCliOptions(['raw.log', '--severity', 'verbose']); return undefined; }
      catch (e) { return e; }
    })();
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
    expect((error as CliError).message).toContain('Unsupported severity level');
  });

  it('rejects invalid --include regex', () => {
    const error = (() => {
      try { parseCliOptions(['raw.log', '--include', '[invalid']); return undefined; }
      catch (e) { return e; }
    })();
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
    expect((error as CliError).message).toContain('Invalid --include regex');
  });

  it('rejects invalid --exclude regex', () => {
    const error = (() => {
      try { parseCliOptions(['raw.log', '--exclude', '[invalid']); return undefined; }
      catch (e) { return e; }
    })();
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
    expect((error as CliError).message).toContain('Invalid --exclude regex');
  });

  it('rejects invalid --sample value', () => {
    const error = (() => {
      try { parseCliOptions(['raw.log', '--sample', 'abc']); return undefined; }
      catch (e) { return e; }
    })();
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
    expect((error as CliError).message).toContain('Invalid --sample');
  });

  it('rejects negative --sample value', () => {
    const error = (() => {
      try { parseCliOptions(['raw.log', '--sample', '0']); return undefined; }
      catch (e) { return e; }
    })();
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
  });

  it('rejects invalid --max-line-length value', () => {
    const error = (() => {
      try { parseCliOptions(['raw.log', '--max-line-length', '50']); return undefined; }
      catch (e) { return e; }
    })();
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
    expect((error as CliError).message).toContain('Invalid --max-line-length');
  });

  it('rejects invalid --timeout value', () => {
    const error = (() => {
      try { parseCliOptions(['raw.log', '--timeout', '0']); return undefined; }
      catch (e) { return e; }
    })();
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
    expect((error as CliError).message).toContain('Invalid --timeout');
  });

  it('rejects --progress without a file input', async () => {
    const { io, stderr } = makeIo(new PassThrough());

    const code = await runCli(['--progress'], io);

    expect(code).toBe(2);
    expect(stderr.value()).toContain('--progress requires a file input');
  });

  it('shows telemetry summary with --telemetry and exits', async () => {
    const { io, stderr } = makeIo(new PassThrough());

    const code = await runCli(['--telemetry'], io);

    expect(code).toBe(0);
    expect(stderr.value()).toContain('LogStrip Telemetry');
  });

  it('records telemetry after a successful run', async () => {
    const { io, stdout } = makeIo(new PassThrough());

    const code = await runCli([inputPath], io);

    expect(code).toBe(0);
    expect(stdout.value()).toContain('[ERROR]');

    const { loadTelemetry: load } = await import('../src/core/telemetry/telemetry-store');
    const store = load();
    expect(store.totalRuns).toBeGreaterThanOrEqual(1);
    expect(store.totalSavedTokens).toBeGreaterThan(0);
  });
});
