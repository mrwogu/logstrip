import * as core from '@actions/core';
import path from 'node:path';
import {
  parseAggressiveness,
  processLogFile,
  type BonsaiResult,
} from '../core/bonsai-parser';

export async function run(): Promise<void> {
  try {
    const inputPath = core.getInput('log-path', { required: true });
    const aggressiveness = parseAggressiveness(
      core.getInput('aggressiveness') || 'high',
    );
    const outputPath = buildOutputPath(inputPath);

    const result = await processLogFile(inputPath, outputPath, {
      aggressiveness,
    });

    core.setOutput('output-path', result.outputPath ?? outputPath);
    await writeSummary(result);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

export function buildOutputPath(inputPath: string): string {
  const absoluteInputPath = path.resolve(inputPath);
  const extension = path.extname(absoluteInputPath);
  const basename = path.basename(absoluteInputPath, extension);
  const outputName = `${basename}.bonsai${extension || '.log'}`;

  return path.join(path.dirname(absoluteInputPath), outputName);
}

export async function getRepositorySlug(): Promise<string> {
  const github = await import('@actions/github');

  return `${github.context.repo.owner}/${github.context.repo.repo}`;
}

export async function writeSummary(
  result: BonsaiResult,
  repository?: string,
): Promise<void> {
  const savings = `${result.savingsPercent.toFixed(2)}%`;
  const repo = repository ?? (await getRepositorySlug());

  await core.summary
    .addHeading('ContextBonsai Report', 2)
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
