import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CONTENT_TEXT_MAX_LOG_RATIO,
  DEFAULT_CONTENT_SAMPLE_BYTES,
  DEFAULT_CONTENT_SAMPLE_LINES,
  classifyContent,
  createLogStripTransform,
  maskSecrets,
  processLogFile,
  processLogStream,
  processLogStreamWithTimeout,
  processLogString,
  type ContentClassification,
  type ContentKind,
  type LogStripLineDecision,
} from '../src/core/logstrip-parser';

class MemoryWritable extends Writable {
  readonly chunks: string[] = [];

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(String(chunk));
    callback();
  }

  content(): string {
    return this.chunks.join('');
  }
}

const MARKDOWN = [
  '# Release notes',
  '',
  'This release improves the way the parser handles very long input files.',
  '',
  '## Changes',
  '',
  '- Faster startup for small inputs.',
  '- Better handling of repeated errors in `watch` mode.',
  '',
  'See [the guide](https://example.com/guide) for the full list.',
  '',
].join('\n');

const YAML_CONFIG = [
  'name: ci',
  'on:',
  '  push:',
  '    branches: [main]',
  'jobs:',
  '  test:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '      - run: npm test',
  '',
].join('\n');

const LOG = [
  '2024-01-15 10:23:45.123 [INFO] boot ok',
  '2024-01-15 10:23:46.456 [DEBUG] cache warmed',
  '2024-01-15 10:23:47.789 [ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed',
  '2024-01-15 10:23:48.012 [ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed',
  '',
].join('\n');

function numberedHeadings(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `## Section ${index}`);
}

function numberedErrors(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `[ERROR] failure ${index}`);
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

describe('text passthrough', () => {
  it('copies markdown through unchanged', async () => {
    const result = await processLogString(MARKDOWN);

    expect(result.output).toBe(MARKDOWN);
    expect(result.contentKind).toBe('text');
  });

  it('copies a YAML config through unchanged', async () => {
    const result = await processLogString(YAML_CONFIG);

    expect(result.output).toBe(YAML_CONFIG);
    expect(result.contentKind).toBe('text');
  });

  it('counts the input in the stats and drops nothing', async () => {
    const result = await processLogString(MARKDOWN);
    const lineCount = MARKDOWN.split('\n').length - 1;
    const wordCount = MARKDOWN.split(/\s+/u).filter(Boolean).length;

    expect(result.stats).toEqual({
      inputLines: lineCount,
      outputLines: lineCount,
      inputWords: wordCount,
      outputWords: wordCount,
      inputBytes: byteLength(MARKDOWN),
      outputBytes: byteLength(MARKDOWN),
      droppedLines: 0,
      duplicateLines: 0,
      hiddenInternalStackLines: 0,
      truncatedLines: 0,
    });
  });

  it('reports zero savings', async () => {
    const result = await processLogString(MARKDOWN);

    expect(result.inputTokens).toBeGreaterThan(0);
    expect(result.outputTokens).toBe(result.inputTokens);
    expect(result.savedTokens).toBe(0);
    expect(result.savingsPercent).toBe(0);
  });

  it('keeps blank lines', async () => {
    const result = await processLogString(MARKDOWN);

    expect(result.output.split('\n').filter((line) => line === '')).toHaveLength(
      MARKDOWN.split('\n').filter((line) => line === '').length,
    );
  });

  it('adds a final newline and normalizes CRLF line endings', async () => {
    const crlf = MARKDOWN.replace(/\n/gu, '\r\n');
    const noFinalNewline = MARKDOWN.trimEnd();

    expect((await processLogString(crlf)).output).toBe(MARKDOWN);
    expect((await processLogString(noFinalNewline)).output).toBe(
      `${noFinalNewline}\n`,
    );
  });

  it('does not mask identifiers or truncate and filter the text', async () => {
    const longLine = `This sentence is long on purpose. ${'It keeps going and going. '.repeat(20)}`;
    const text = [
      '# Credentials example',
      'The service id is 123e4567-e89b-12d3-a456-426614174000 in this sample.',
      longLine.trim(),
      '## Notes',
    ].join('\n');

    const result = await processLogString(`${text}\n`, {
      maxLineLength: 100,
      include: /nothing-matches-this/u,
      exclude: /Notes/u,
      severity: 'fatal',
      sampleSize: 1,
    });

    expect(result.output).toBe(`${text}\n`);
    expect(result.stats.truncatedLines).toBe(0);
  });

  it('keeps grouped multiline entries intact and counts physical lines', async () => {
    const result = await processLogString(YAML_CONFIG, { multiline: 'python' });

    expect(result.output).toBe(YAML_CONFIG);
    expect(result.contentKind).toBe('text');
    expect(result.stats.inputLines).toBe(10);
    expect(result.stats.outputLines).toBe(10);
  });

  it('uses the custom token estimator for both sides', async () => {
    const seen: string[] = [];
    const result = await processLogString(MARKDOWN, {
      tokenEstimator: (line) => {
        seen.push(line);
        return 2;
      },
    });
    const lineCount = MARKDOWN.split('\n').length - 1;

    expect(result.inputTokens).toBe(lineCount * 2);
    expect(result.outputTokens).toBe(lineCount * 2);
    expect(result.savedTokens).toBe(0);
    // Every line is measured twice: once as input and once as output.
    expect(seen).toHaveLength(lineCount * 2);
    expect(seen.filter((_, index) => index % 2 === 0).join('')).toBe(MARKDOWN);
    expect(seen.filter((_, index) => index % 2 === 1).join('')).toBe(MARKDOWN);
  });

  it('classifies empty input as a log and writes nothing', async () => {
    const result = await processLogString('');

    expect(result.output).toBe('');
    expect(result.contentKind).toBe('log');
    expect(result.stats.inputLines).toBe(0);
  });
});

describe('text passthrough: decisions', () => {
  it('emits a kept passthrough decision for every line', async () => {
    const decisions: LogStripLineDecision[] = [];
    await processLogString(MARKDOWN, {
      onDecision: (decision) => decisions.push(decision),
    });

    const lines = MARKDOWN.split('\n').slice(0, -1);
    expect(decisions.map((decision) => decision.line)).toEqual(lines);
    for (const decision of decisions) {
      expect(decision).toEqual({
        line: decision.line,
        sanitizedLine: decision.line,
        kept: true,
        dropped: false,
        hardKeep: false,
        repeated: false,
        reason: 'passthrough',
      });
    }
  });

  it('never reports passthrough for a log', async () => {
    const decisions: LogStripLineDecision[] = [];
    await processLogString(LOG, {
      onDecision: (decision) => decisions.push(decision),
    });

    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.some((decision) => decision.reason === 'passthrough')).toBe(
      false,
    );
  });
});

describe('text passthrough: opting out', () => {
  it('compresses the same text when textPassthrough is false', async () => {
    const result = await processLogString(MARKDOWN, { textPassthrough: false });

    expect(result.contentKind).toBe('log');
    expect(result.output).not.toBe(MARKDOWN);
    expect(result.stats.outputLines).toBeLessThan(result.stats.inputLines);
    expect(result.stats.droppedLines).toBeGreaterThan(0);
  });

  it('treats textPassthrough: true like the default', async () => {
    const result = await processLogString(MARKDOWN, { textPassthrough: true });

    expect(result.output).toBe(MARKDOWN);
    expect(result.contentKind).toBe('text');
  });
});

describe('contentKind on the log paths', () => {
  it('reports log for a compressed log', async () => {
    const result = await processLogString(LOG);

    expect(result.contentKind).toBe('log');
    expect(result.output).toContain('[x2] [TIME] [ERROR] request [ID] failed');
    expect(result.savedTokens).toBeGreaterThan(0);
  });

  it('keeps compressing a log that starts with a short prose banner', async () => {
    const banner = Array.from(
      { length: 10 },
      (_, index) =>
        `This report line number ${index + 1} was written for people who read the nightly summary.`,
    );
    const body = Array.from(
      { length: 90 },
      (_, index) =>
        `2024-01-15 10:23:${String(index % 60).padStart(2, '0')}.123 [${index % 10 === 0 ? 'ERROR' : 'INFO'}] step ${index} finished`,
    );

    const result = await processLogString(`${[...banner, ...body].join('\n')}\n`);

    expect(result.contentKind).toBe('log');
    expect(result.stats.droppedLines).toBeGreaterThan(50);
    expect(result.output).toContain('[ERROR]');
  });

  it('reports log for a JSON document handled by the report path', async () => {
    const report = JSON.stringify(
      {
        summary: { failed: 1, passed: 2 },
        tests: [{ name: 'a', status: 'failed', message: 'boom' }],
      },
      null,
      2,
    );

    const result = await processLogString(`${report}\n`);

    expect(result.contentKind).toBe('log');
    expect(result.detectedFormat).toBe('json');
  });

  it('passes a JSON config through when the report path is disabled', async () => {
    const config = `${JSON.stringify(
      { name: 'my-app', version: '1.2.3', scripts: { build: 'tsc', test: 'vitest run' } },
      null,
      2,
    )}\n`;

    const result = await processLogString(config, { jsonReport: false });

    expect(result.contentKind).toBe('text');
    expect(result.output).toBe(config);
  });
});

describe('text passthrough: sample caps', () => {
  it('decides from the first 100 non-blank lines only', async () => {
    const textFirst = [...numberedHeadings(100), ...numberedErrors(300)].join('\n');
    const logFirst = [...numberedErrors(100), ...numberedHeadings(300)].join('\n');

    const text = await processLogString(`${textFirst}\n`);
    const log = await processLogString(`${logFirst}\n`);

    expect(text.contentKind).toBe('text');
    expect(text.output).toBe(`${textFirst}\n`);
    expect(log.contentKind).toBe('log');
    expect(log.stats.droppedLines).toBeGreaterThan(0);
  });

  it('decides from the first 256 KiB when the lines are large', async () => {
    const bigHeading = `# ${'x'.repeat(10_000)}`;
    const headingCount = Math.ceil(DEFAULT_CONTENT_SAMPLE_BYTES / (bigHeading.length + 1));
    const input = [
      ...Array.from({ length: headingCount }, () => bigHeading),
      ...numberedErrors(200),
    ].join('\n');

    const result = await processLogString(`${input}\n`);

    expect(headingCount).toBeLessThan(DEFAULT_CONTENT_SAMPLE_LINES);
    expect(result.contentKind).toBe('text');
    expect(result.output).toBe(`${input}\n`);
  });

  it('reads a log verdict from the byte sample even when text follows', async () => {
    const bigError = `[ERROR] ${'x'.repeat(10_000)}`;
    const errorCount = Math.ceil(DEFAULT_CONTENT_SAMPLE_BYTES / (bigError.length + 1));
    const input = [
      ...Array.from({ length: errorCount }, () => bigError),
      ...numberedHeadings(500),
    ].join('\n');

    const result = await processLogString(`${input}\n`);

    expect(result.contentKind).toBe('log');
    expect(result.output).not.toBe(`${input}\n`);
  });

  it('exposes the thresholds the decision uses', () => {
    expect(CONTENT_TEXT_MAX_LOG_RATIO).toBeLessThan(0.5);
    const classification: ContentClassification = classifyContent(['# a', '# b']);
    const kind: ContentKind = classification.kind;

    expect(kind).toBe('text');
  });
});

describe('text passthrough: streaming', () => {
  async function waitFor(condition: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 200 && !condition(); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  it('starts writing before the input has ended', async () => {
    const input = new PassThrough();
    const output = new MemoryWritable();
    const lines = numberedHeadings(150);

    const done = processLogStream(input, output);
    input.write(`${lines.join('\n')}\n`);
    await waitFor(() => output.chunks.length > 0);

    expect(output.chunks.length).toBeGreaterThan(0);
    expect(output.chunks[0]).toBe('## Section 0\n');

    input.end('## Last section\n');
    const result = await done;

    expect(result.contentKind).toBe('text');
    expect(output.content()).toBe(`${[...lines, '## Last section'].join('\n')}\n`);
  });

  it('writes one chunk per line', async () => {
    const output = new MemoryWritable();
    const lines = numberedHeadings(250);

    await processLogStream(Readable.from([`${lines.join('\n')}\n`]), output);

    expect(output.chunks).toHaveLength(250);
    expect(output.chunks[249]).toBe('## Section 249\n');
  });

  it('waits for drain when the output applies backpressure', async () => {
    const written: string[] = [];
    const slow = new Writable({
      highWaterMark: 1,
      write(chunk, _encoding, callback) {
        written.push(String(chunk));
        setImmediate(callback);
      },
    });
    const lines = numberedHeadings(120);

    const result = await processLogStream(
      Readable.from([`${lines.join('\n')}\n`]),
      slow,
    );

    expect(result.contentKind).toBe('text');
    expect(written.join('')).toBe(`${lines.join('\n')}\n`);
  });
});

describe('text passthrough: abort and timeout', () => {
  it('rejects an already aborted signal before reading', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      processLogString(MARKDOWN, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('stops passing text through when the signal aborts mid-stream', async () => {
    const controller = new AbortController();
    const lines = numberedHeadings(300);
    const output = new MemoryWritable();

    await expect(
      processLogStream(Readable.from([`${lines.join('\n')}\n`]), output, {
        signal: controller.signal,
        onDecision: (decision) => {
          if (decision.line === '## Section 149') {
            controller.abort();
          }
        },
      }),
    ).rejects.toMatchObject({ code: 'ABORTED' });

    expect(output.chunks).toHaveLength(150);
    expect(output.chunks[149]).toBe('## Section 149\n');
  });

  it('returns the content kind through the timeout wrapper', async () => {
    const text = await processLogStreamWithTimeout(
      Readable.from([MARKDOWN]),
      new MemoryWritable(),
      {},
      5000,
    );
    const log = await processLogStreamWithTimeout(
      Readable.from([LOG]),
      new MemoryWritable(),
      {},
      5000,
    );

    expect(text.contentKind).toBe('text');
    expect(log.contentKind).toBe('log');
  });

  it('returns the content kind when timeoutMs is passed as an option', async () => {
    const output = new MemoryWritable();

    const result = await processLogStream(Readable.from([MARKDOWN]), output, {
      timeoutMs: 5000,
    });

    expect(result.contentKind).toBe('text');
    expect(output.content()).toBe(MARKDOWN);
  });

  it('leaves the content kind unset on a timeout', async () => {
    const never = new Readable({ read() {} });

    const result = await processLogStreamWithTimeout(
      never,
      new MemoryWritable(),
      {},
      20,
    );

    expect(result.timedOut).toBe(true);
    expect(result.contentKind).toBeUndefined();
  });
});

describe('text passthrough: wrappers', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'logstrip-passthrough-'));
  });

  afterAll(async () => {
    await rm(workDir, { force: true, recursive: true });
  });

  it('processLogFile copies a text file and reports its kind', async () => {
    const inputPath = join(workDir, 'notes.md');
    const outputPath = join(workDir, 'notes.logstrip.md');
    await writeFile(inputPath, MARKDOWN, 'utf8');

    const result = await processLogFile(inputPath, outputPath);

    expect(result.contentKind).toBe('text');
    expect(result.outputPath).toBe(outputPath);
    expect(await readFile(outputPath, 'utf8')).toBe(MARKDOWN);
  });

  it('processLogFile still compresses a log and reports its kind', async () => {
    const inputPath = join(workDir, 'build.log');
    const outputPath = join(workDir, 'build.logstrip.log');
    await writeFile(inputPath, LOG, 'utf8');

    const result = await processLogFile(inputPath, outputPath);

    expect(result.contentKind).toBe('log');
    expect(await readFile(outputPath, 'utf8')).toContain('[x2] [TIME] [ERROR] request [ID] failed');
  });

  it('processLogFile honours textPassthrough: false', async () => {
    const inputPath = join(workDir, 'forced.md');
    const outputPath = join(workDir, 'forced.logstrip.md');
    await writeFile(inputPath, MARKDOWN, 'utf8');

    const result = await processLogFile(inputPath, outputPath, {
      textPassthrough: false,
    });

    expect(result.contentKind).toBe('log');
    expect(await readFile(outputPath, 'utf8')).not.toBe(MARKDOWN);
  });

  it('createLogStripTransform passes text through and exposes the kind', async () => {
    const transform = createLogStripTransform();
    const chunks: Buffer[] = [];
    transform.on('data', (chunk: Buffer) => chunks.push(chunk));

    transform.end(MARKDOWN);
    await finished(transform);
    const result = await transform.result;

    expect(Buffer.concat(chunks).toString('utf8')).toBe(MARKDOWN);
    expect(result.contentKind).toBe('text');
    expect(result.savedTokens).toBe(0);
  });

  it('createLogStripTransform exposes the kind of a log', async () => {
    const transform = createLogStripTransform();
    transform.resume();

    transform.end(LOG);
    await finished(transform);

    expect((await transform.result).contentKind).toBe('log');
  });
});

describe('text passthrough: credentials', () => {
  const GITHUB_TOKEN = `ghp_${'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6'}`;
  const PEM_BODY = [
    'MIIEowIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gun',
    'VTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u+qKhbwKfBstIs+bMY2Zkp18gnTxK',
  ];
  const SECRET_DOC = [
    '# Deployment notes',
    '',
    'The service reads its settings from the environment when it starts.',
    '',
    '## Settings',
    '',
    `- github: ${GITHUB_TOKEN}`,
    '- password=hunter2hunter2',
    '- database: postgres://admin:s3cr3tP4ss@db.internal:5432/app',
    '',
    '## Private key',
    '',
    '-----BEGIN RSA PRIVATE KEY-----',
    ...PEM_BODY,
    '-----END RSA PRIVATE KEY-----',
    '',
    'Rotate the key every quarter. See [the guide](https://example.com/rotate).',
    'Request 123e4567-e89b-12d3-a456-426614174000 came in at 2024-01-15T10:23:45Z from 10.0.0.1.',
    'Mail ops@example.com when a build fails.',
    '',
  ];
  const MASKED_DOC = [
    ...SECRET_DOC.slice(0, 6),
    '- github: [REDACTED]',
    '- password=[REDACTED]',
    '- database: postgres://admin:[REDACTED]@db.internal:5432/app',
    ...SECRET_DOC.slice(9, 12),
    '[PEM PRIVATE KEY REDACTED]',
    ...SECRET_DOC.slice(16),
  ];

  it('masks tokens, password fields, connection strings and private keys', async () => {
    const result = await processLogString(`${SECRET_DOC.join('\n')}`);

    expect(result.contentKind).toBe('text');
    expect(result.output).toBe(MASKED_DOC.join('\n'));
    expect(result.output).not.toContain(GITHUB_TOKEN);
    expect(result.output).not.toContain('hunter2hunter2');
    expect(result.output).not.toContain('s3cr3tP4ss');
    expect(result.output).not.toContain(PEM_BODY[0]);
    expect(result.output).not.toContain('END RSA PRIVATE KEY');
  });

  it('leaves identifiers, timestamps, addresses and emails alone', async () => {
    const result = await processLogString(SECRET_DOC.join('\n'));

    expect(result.output).toContain('123e4567-e89b-12d3-a456-426614174000');
    expect(result.output).toContain('2024-01-15T10:23:45Z');
    expect(result.output).toContain('10.0.0.1');
    expect(result.output).toContain('ops@example.com');
  });

  it('counts the dropped key lines and the masked output', async () => {
    const result = await processLogString(SECRET_DOC.join('\n'));
    const inputLines = SECRET_DOC.length - 1;

    expect(result.stats.inputLines).toBe(inputLines);
    expect(result.stats.droppedLines).toBe(PEM_BODY.length + 1);
    expect(result.stats.outputLines).toBe(inputLines - PEM_BODY.length - 1);
    expect(result.stats.outputBytes).toBe(byteLength(`${MASKED_DOC.join('\n')}`));
    expect(result.stats.outputBytes).toBeLessThan(result.stats.inputBytes);
    expect(result.savedTokens).toBeGreaterThan(0);
  });

  it('reports the masked line and the dropped key lines in the decisions', async () => {
    const decisions: LogStripLineDecision[] = [];
    await processLogString(SECRET_DOC.join('\n'), {
      onDecision: (decision) => decisions.push(decision),
    });

    const token = decisions.find((decision) => decision.line.startsWith('- github'));
    const body = decisions.find((decision) => decision.line === PEM_BODY[0]);
    expect(token).toMatchObject({
      sanitizedLine: '- github: [REDACTED]',
      kept: true,
      reason: 'passthrough',
    });
    expect(body).toMatchObject({
      kept: false,
      dropped: true,
      reason: 'custom-ignore',
    });
    expect(body).not.toHaveProperty('sanitizedLine');
  });

  it('redacts a private key that is still open when the input ends', async () => {
    const lines = [
      ...SECRET_DOC.slice(0, 12),
      '-----BEGIN PRIVATE KEY-----',
      ...PEM_BODY,
    ];

    const result = await processLogString(`${lines.join('\n')}\n`);

    expect(result.contentKind).toBe('text');
    expect(result.output.endsWith('[PEM PRIVATE KEY REDACTED]\n[PEM block unterminated - input redacted]\n')).toBe(true);
    expect(result.output).not.toContain(PEM_BODY[0]);
    expect(result.stats.truncatedLines).toBe(1);
    expect(result.stats.droppedLines).toBe(PEM_BODY.length);
  });

  it('keeps everything after a page that only names the private key header', async () => {
    const doc = [
      '# Masking rules',
      '',
      'Private keys are collapsed to a single marker.',
      '',
      '| Secret | Marker | Example |',
      '| :--- | :--- | :--- |',
      '| PEM private key blocks | `[PEM PRIVATE KEY REDACTED]` | `-----BEGIN RSA PRIVATE KEY-----` |',
      '',
      'A key file starts with `-----BEGIN PRIVATE KEY-----`.',
      'Everything after those lines has to survive.',
      '',
      '- last item',
    ].join('\n');

    const result = await processLogString(`${doc}\n`);

    expect(result.contentKind).toBe('text');
    expect(result.output).toBe(`${doc}\n`);
    expect(result.stats.droppedLines).toBe(0);
  });

  it('redacts a private key stored on one line without losing the lines after it', async () => {
    const doc = [
      '# Service account',
      '',
      'The file below is read by the deploy job at startup time.',
      '',
      '```json',
      '{',
      '  "client_email": "deploy@example.iam.gserviceaccount.com",',
      '  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0B\\n-----END PRIVATE KEY-----\\n",',
      '  "project_id": "demo"',
      '}',
      '```',
    ].join('\n');

    const result = await processLogString(`${doc}\n`);

    expect(result.contentKind).toBe('text');
    expect(result.output).toContain('[PEM PRIVATE KEY REDACTED]');
    expect(result.output).not.toContain('MIIEvQIBADANBgkqhkiG9w0B');
    expect(result.output).toContain('"project_id": "demo"');
    expect(result.output.endsWith('}\n```\n')).toBe(true);
  });

  it('keeps a text file without secrets byte for byte', async () => {
    const clean = SECRET_DOC.filter(
      (line) =>
        !line.includes('ghp_') &&
        !line.includes('password=') &&
        !line.includes('postgres://') &&
        !line.includes('PRIVATE KEY') &&
        !PEM_BODY.includes(line),
    ).join('\n');

    const result = await processLogString(`${clean}\n`);

    expect(result.output).toBe(`${clean}\n`);
    expect(result.savingsPercent).toBe(0);
  });

  it('applies the custom sanitize rules of the config', async () => {
    const text = [
      '# Internal hosts',
      '',
      'Every build agent registers itself with the control plane at startup.',
      '',
      '- agent: ACME-PROD-7731 is the oldest one',
      '- agent: ACME-PROD-7732 was added last month',
    ].join('\n');

    const result = await processLogString(`${text}\n`, {
      config: {
        sources: [],
        diagnosticPatterns: [],
        ignorePatterns: [],
        internalStackPatterns: [],
        sanitizePatterns: [
          { pattern: 'ACME-PROD-\\d+', replacement: '[HOST]' },
        ],
      },
    });

    expect(result.contentKind).toBe('text');
    expect(result.output).toBe(
      `${text.replace(/ACME-PROD-\d+/gu, '[HOST]')}\n`,
    );
  });

  it('measures masked output with the custom token estimator', async () => {
    const result = await processLogString(SECRET_DOC.join('\n'), {
      tokenEstimator: (line) => line.length,
    });

    expect(result.contentKind).toBe('text');
    expect(result.outputTokens).toBeLessThan(result.inputTokens);
    expect(result.savedTokens).toBe(result.inputTokens - result.outputTokens);
  });

  it('exports maskSecrets from the package entry', () => {
    expect(maskSecrets('password=hunter2')).toBe('password=[REDACTED]');
  });

  it('reports zero savings when the estimator sees nothing', async () => {
    const result = await processLogString(MARKDOWN, { tokenEstimator: () => 0 });

    expect(result.contentKind).toBe('text');
    expect(result.inputTokens).toBe(0);
    expect(result.savingsPercent).toBe(0);
  });
});
