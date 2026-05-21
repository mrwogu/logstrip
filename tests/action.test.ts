import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogStripResult } from '../src/core/logstrip-parser';

const mocks = vi.hoisted(() => {
  const summary = {
    addHeading: vi.fn(),
    addTable: vi.fn(),
    write: vi.fn(),
  };

  return {
    getInput: vi.fn(),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    summary,
    processLogFile: vi.fn(),
  };
});

vi.mock('@actions/core', () => ({
  getInput: mocks.getInput,
  setOutput: mocks.setOutput,
  setFailed: mocks.setFailed,
  summary: mocks.summary,
}));

vi.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'mrwogu',
      repo: 'logstrip',
    },
  },
}));

vi.mock('../src/core/logstrip-parser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/logstrip-parser')>();

  return {
    ...actual,
    processLogFile: mocks.processLogFile,
  };
});

import { buildOutputPath, run, writeSummary } from '../src/action/index';

const result = (outputPath?: string): LogStripResult => ({
  inputTokens: 100,
  outputTokens: 25,
  savedTokens: 75,
  savingsPercent: 75,
  outputPath,
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

describe('GitHub Action wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.summary.addHeading.mockReturnValue(mocks.summary);
    mocks.summary.addTable.mockReturnValue(mocks.summary);
    mocks.summary.write.mockResolvedValue(undefined);
  });

  it('builds default output paths', () => {
    expect(buildOutputPath(path.join('logs', 'raw.log'))).toBe(
      path.join(process.cwd(), 'logs', 'raw.logstrip.log'),
    );
    expect(buildOutputPath(path.join('logs', 'raw'))).toBe(
      path.join(process.cwd(), 'logs', 'raw.logstrip.log'),
    );
  });

  it('runs parser, sets fallback output and writes summary', async () => {
    const inputPath = 'raw.log';
    const expectedOutput = path.join(process.cwd(), 'raw.logstrip.log');

    mocks.getInput.mockImplementation((name: string) =>
      name === 'log-path' ? inputPath : '',
    );
    mocks.processLogFile.mockResolvedValue(result());

    await run();

    expect(mocks.processLogFile).toHaveBeenCalledWith(inputPath, expectedOutput, {
      aggressiveness: 'auto',
    });
    expect(mocks.setOutput).toHaveBeenCalledWith('output-path', expectedOutput);
    expect(mocks.summary.addHeading).toHaveBeenCalledWith(
      'LogStrip Report',
      2,
    );
    expect(mocks.summary.addTable).toHaveBeenCalledWith(
      expect.arrayContaining([
        ['Repository', 'mrwogu/logstrip'],
        ['Savings', '75.00%'],
      ]),
    );
    expect(mocks.summary.write).toHaveBeenCalledTimes(1);
  });

  it('prefers parser outputPath when present', async () => {
    mocks.getInput.mockImplementation((name: string) =>
      name === 'log-path' ? 'raw' : name === 'aggressiveness' ? 'low' : '',
    );
    mocks.processLogFile.mockResolvedValue(result('/tmp/custom.log'));

    await run();

    expect(mocks.processLogFile).toHaveBeenCalledWith(
      'raw',
      path.join(process.cwd(), 'raw.logstrip.log'),
      { aggressiveness: 'low' },
    );
    expect(mocks.setOutput).toHaveBeenCalledWith(
      'output-path',
      '/tmp/custom.log',
    );
  });

  it('marks invalid inputs as failed', async () => {
    mocks.getInput.mockImplementation((name: string) =>
      name === 'log-path' ? 'raw.log' : 'extreme',
    );

    await run();

    expect(mocks.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported aggressiveness'),
    );
    expect(mocks.processLogFile).not.toHaveBeenCalled();
  });

  it('marks non-error failures as failed', async () => {
    mocks.getInput.mockImplementation((name: string) =>
      name === 'log-path' ? 'raw.log' : name === 'aggressiveness' ? 'high' : '',
    );
    mocks.processLogFile.mockRejectedValue('boom');

    await run();

    expect(mocks.setFailed).toHaveBeenCalledWith('boom');
  });

  it('passes optional action inputs through to the parser', async () => {
    const inputs: Record<string, string> = {
      'log-path': 'raw.log',
      aggressiveness: 'aggressive',
      'output-path': 'custom.log',
      'config-path': '.logstrip.yml',
      multiline: 'python',
      severity: 'error',
      include: 'ERROR',
      exclude: 'heartbeat',
      sample: '5',
      'max-line-length': '1000',
      timeout: '2.5',
    };
    mocks.getInput.mockImplementation((name: string) => inputs[name] ?? '');
    mocks.processLogFile.mockResolvedValue(result('custom.log'));

    await run();

    expect(mocks.processLogFile).toHaveBeenCalledWith('raw.log', 'custom.log', {
      aggressiveness: 'aggressive',
      configPath: '.logstrip.yml',
      multiline: 'python',
      severity: 'error',
      include: /ERROR/u,
      exclude: /heartbeat/u,
      sampleSize: 5,
      maxLineLength: 1000,
      timeoutMs: 2500,
    });
  });

  it('marks invalid optional action inputs as failed', async () => {
    mocks.getInput.mockImplementation((name: string) =>
      name === 'log-path'
        ? 'raw.log'
        : name === 'aggressiveness'
          ? 'auto'
          : name === 'include'
            ? '[invalid'
            : '',
    );

    await run();

    expect(mocks.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Invalid include regex'),
    );
    expect(mocks.processLogFile).not.toHaveBeenCalled();
  });

  it('marks invalid multiline action input as failed', async () => {
    mocks.getInput.mockImplementation((name: string) =>
      name === 'log-path'
        ? 'raw.log'
        : name === 'aggressiveness'
          ? 'auto'
          : name === 'multiline'
            ? 'badmode'
            : '',
    );

    await run();

    expect(mocks.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported multiline mode'),
    );
    expect(mocks.processLogFile).not.toHaveBeenCalled();
  });

  it.each([
    ['sample', 'abc', 'Invalid sample'],
    ['sample', '0', 'Invalid sample'],
    ['max-line-length', 'abc', 'Invalid max-line-length'],
    ['max-line-length', '50', 'Invalid max-line-length'],
    ['timeout', 'abc', 'Invalid timeout'],
    ['timeout', '0', 'Invalid timeout'],
  ])('marks invalid %s action input as failed', async (field, value, message) => {
    mocks.getInput.mockImplementation((name: string) =>
      name === 'log-path'
        ? 'raw.log'
        : name === 'aggressiveness'
          ? 'auto'
          : name === field
            ? value
            : '',
    );

    await run();

    expect(mocks.setFailed).toHaveBeenCalledWith(
      expect.stringContaining(message),
    );
    expect(mocks.processLogFile).not.toHaveBeenCalled();
  });

  it('writes a formatted summary table', async () => {
    await writeSummary(result('/tmp/out.log'));

    expect(mocks.summary.addTable).toHaveBeenCalledWith(
      expect.arrayContaining([
        ['Input tokens (est.)', '100'],
        ['Output tokens (est.)', '25'],
        ['Saved tokens', '75'],
      ]),
    );
  });
});
