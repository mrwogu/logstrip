import path from 'node:path';
import {
  parseAggressiveness,
  parseSeverityLevel,
  processLogFile,
  type LogStripOptions,
  type LogStripResult,
  type MultilineMode,
} from '../core/logstrip-parser';

const VALID_MULTILINE_MODES: readonly MultilineMode[] = [
  'auto', 'python', 'node', 'java', 'go', 'rust', 'off',
];

// @actions/core 3 is ESM-only, so this CommonJS module cannot require it.
// A dynamic import works in the tsc build and in the esbuild bundle, like the
// one for @actions/github below.
function loadCore() {
  return import('@actions/core');
}

type ActionsCore = Awaited<ReturnType<typeof loadCore>>;
type InputReader = Pick<ActionsCore, 'getInput'>;

export async function run(): Promise<void> {
  let core: ActionsCore | undefined;
  try {
    core = await loadCore();
    const inputPath = core.getInput('log-path', { required: true });
    const aggressiveness = parseAggressiveness(
      core.getInput('aggressiveness') || 'auto',
    );
    const outputPath = core.getInput('output-path') || buildOutputPath(inputPath);
    const options: LogStripOptions = {
      aggressiveness,
      configPath: optionalInput(core, 'config-path'),
      multiline: parseOptionalMultilineMode(core, 'multiline'),
      severity: parseOptionalSeverity(core, 'severity'),
      include: parseOptionalRegex(core, 'include'),
      exclude: parseOptionalRegex(core, 'exclude'),
      sampleSize: parseOptionalPositiveInteger(core, 'sample'),
      maxLineLength: parseOptionalMinInteger(core, 'max-line-length', 100),
      timeoutMs: parseOptionalTimeoutMs(core, 'timeout'),
    };

    const result = await processLogFile(inputPath, outputPath, options);

    core.setOutput('output-path', result.outputPath ?? outputPath);
    await writeSummary(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (core === undefined) failWithoutCore(message);
    else core.setFailed(message);
  }
}

// core.setFailed is not available when @actions/core itself did not load.
// This is what it does: an error workflow command and a failing exit code.
function failWithoutCore(message: string): void {
  const escaped = message
    .replace(/%/gu, '%25')
    .replace(/\r/gu, '%0D')
    .replace(/\n/gu, '%0A');
  process.stdout.write(`::error::${escaped}\n`);
  process.exitCode = 1;
}

export function buildOutputPath(inputPath: string): string {
  const absoluteInputPath = path.resolve(inputPath);
  const extension = path.extname(absoluteInputPath);
  const basename = path.basename(absoluteInputPath, extension);
  const outputName = `${basename}.logstrip${extension || '.log'}`;

  return path.join(path.dirname(absoluteInputPath), outputName);
}

function optionalInput(core: InputReader, name: string): string | undefined {
  const value = core.getInput(name);
  return value === '' ? undefined : value;
}

function parseOptionalMultilineMode(core: InputReader, name: string): MultilineMode | undefined {
  const value = optionalInput(core, name);
  if (value === undefined) return undefined;
  const normalized = value.toLowerCase() as MultilineMode;
  if (VALID_MULTILINE_MODES.includes(normalized)) return normalized;
  throw new Error(
    `Unsupported multiline mode: ${value}. Valid values: ${VALID_MULTILINE_MODES.join(', ')}`,
  );
}

function parseOptionalRegex(core: InputReader, name: string): RegExp | undefined {
  const value = optionalInput(core, name);
  if (value === undefined) return undefined;
  try {
    return new RegExp(value, 'u');
  } catch {
    throw new Error(`Invalid ${name} regex: ${value}`);
  }
}

function parseOptionalSeverity(core: InputReader, name: string) {
  const value = optionalInput(core, name);
  return value === undefined ? undefined : parseSeverityLevel(value);
}

function parseOptionalPositiveInteger(core: InputReader, name: string): number | undefined {
  const value = optionalInput(core, name);
  if (value === undefined) return undefined;
  if (!/^\d+$/u.test(value)) throw new Error(`Invalid ${name}: ${value}. Must be a positive integer.`);
  const parsed = Number(value);
  if (parsed < 1) throw new Error(`Invalid ${name}: ${value}. Must be a positive integer.`);
  return parsed;
}

function parseOptionalMinInteger(
  core: InputReader,
  name: string,
  min: number,
): number | undefined {
  const value = optionalInput(core, name);
  if (value === undefined) return undefined;
  if (!/^\d+$/u.test(value)) throw new Error(`Invalid ${name}: ${value}. Must be >= ${min}.`);
  const parsed = Number(value);
  if (parsed < min) throw new Error(`Invalid ${name}: ${value}. Must be >= ${min}.`);
  return parsed;
}

function parseOptionalTimeoutMs(core: InputReader, name: string): number | undefined {
  const value = optionalInput(core, name);
  if (value === undefined) return undefined;
  if (!/^(?:\d+|\d*\.\d+)$/u.test(value)) throw new Error(`Invalid ${name}: ${value}. Must be a positive number.`);
  const parsed = Number(value);
  if (parsed < 0.1) throw new Error(`Invalid ${name}: ${value}. Must be a positive number.`);
  return Math.round(parsed * 1000);
}

export async function getRepositorySlug(): Promise<string> {
  const github = await import('@actions/github');

  return `${github.context.repo.owner}/${github.context.repo.repo}`;
}

export async function writeSummary(
  result: LogStripResult,
  repository?: string,
): Promise<void> {
  const core = await loadCore();
  const savings = `${result.savingsPercent.toFixed(2)}%`;
  const repo = repository ?? (await getRepositorySlug());

  await core.summary
    .addHeading('LogStrip Report', 2)
    .addTable([
      [
        { data: 'Metric', header: true },
        { data: 'Value', header: true },
      ],
      ['Repository', repo],
      ['Input tokens (est.)', result.inputTokens.toLocaleString('en-US')],
      ['Output tokens (est.)', result.outputTokens.toLocaleString('en-US')],
      ['Saved tokens', result.savedTokens.toLocaleString('en-US')],
      ['Savings', savings],
      ['Dropped lines', result.stats.droppedLines.toLocaleString('en-US')],
      [
        'Deduplicated lines',
        result.stats.duplicateLines.toLocaleString('en-US'),
      ],
    ])
    .write();
}

/* v8 ignore next 3 */
if (require.main === module) {
  void run();
}
