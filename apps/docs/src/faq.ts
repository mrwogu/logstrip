// Homepage FAQ. One list feeds both the visible section and the FAQPage
// structured data, so answer engines quote the same text readers see. The
// numbers come from the benchmark data, so they cannot drift from the page
// that lists them.
import { formatPercent, type BenchmarkTotals } from './benchmarks';
import { escapeHtml } from './html';

export interface FaqItem {
  question: string;
  answer: string;
}

export function homeFaq(totals: BenchmarkTotals): readonly FaqItem[] {
  return [
    {
      question: 'What is LogStrip?',
      answer:
        'LogStrip is a command-line tool, a TypeScript library and a GitHub Action that cut noisy CI, server, scanner and container logs down to the lines an AI agent needs. It keeps errors, the first occurrence of each event, context and application stack frames, folds repeats into [xN], and masks secrets.',
    },
    {
      question: 'How many tokens does it save?',
      answer: `It depends on the log. On the ${totals.fixtures} test fixtures in the repository, savings range from ${formatPercent(totals.minSavingsPercent)} to ${formatPercent(totals.maxSavingsPercent)} per fixture, with a median of ${formatPercent(totals.medianSavingsPercent)}, measured with LogStrip's own word-based token estimate. The fixtures are small and written by us, so run logstrip with --stats on your own log.`,
    },
    {
      question: 'How is it different from LLMLingua and other prompt compressors?',
      answer:
        'Prompt compressors use a language model to remove low-information tokens, which suits prose. LogStrip works on whole log lines with fixed rules: no model, no network, and the same output for the same input. A line is kept, folded into a count, or hidden behind a marker, never cut in the middle. It does not suit prose, which it passes through untouched.',
    },
    {
      question: 'Does it send my logs anywhere?',
      answer:
        'No. Compression runs on your machine with no model and no network. In an interactive terminal the CLI checks npm once a day for a newer version. That check does not run when stderr is redirected, as in CI, and LOGSTRIP_NO_UPDATE_CHECK=1 turns it off. Usage statistics stay in a local file.',
    },
    {
      question: 'Does it remove secrets?',
      answer:
        'It masks tokens, JWTs, connection-string passwords, authorization headers, PEM private keys and high-entropy strings in every mode, including when text is passed through. It is not a secret scanner, so run one before you share logs outside your organization.',
    },
    {
      question: 'What does it change in my log?',
      answer:
        'Ids, hashes, timestamps and IP addresses become placeholders such as [ID] and [TIME], and line and column numbers in stack frames become [NN], so that repeated events fold into one. The raw file is never modified. Use --preserve-id-suffix to keep the tail of each id.',
    },
    {
      question: 'Which agents and CI systems does it work with?',
      answer:
        'Plugins exist for Claude Code, Cursor, GitHub Copilot, Codex, OpenCode and Factory Droid. All except OpenCode also get a hook that compresses logs automatically. There is a GitHub Action, and any CI system can call the CLI. It detects 705+ log sources.',
    },
    {
      question: 'What happens if the input is not a log?',
      answer:
        'LogStrip looks at the start of the input. Prose, markdown, source code and configuration are copied through with only secrets masked. Pass --force when you want it compressed anyway.',
    },
    {
      question: 'Can it handle very large logs?',
      answer:
        'Yes. It reads line by line with bounded memory, so a log does not have to fit in memory. The one exception is a whole JSON report, which is parsed in memory up to 8 MiB. Larger ones use the line pipeline.',
    },
    {
      question: 'What does it cost and what does it need?',
      answer:
        'It is free and MIT licensed. It needs Node.js 22 or newer and has no runtime dependencies. Install it with npm install --global logstrip, or run it once with npx -y logstrip.',
    },
  ];
}

export function faqHtml(items: readonly FaqItem[]): string {
  return items
    .map(
      (item) =>
        `<details class="hp-faq__item"><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`
    )
    .join('\n');
}
