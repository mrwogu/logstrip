// Fills the homepage template (components/home.html) at build time. The page is
// plain HTML on purpose, so placeholders are the only logic: `{{name}}` for a
// value and `<!-- name -->` for a block of generated markup.
import { formatNumber, type BenchmarkDocument } from './benchmarks';

export interface HomeParts {
  base: string;
  values: Readonly<Record<string, string>>;
  blocks: Readonly<Record<string, string>>;
}

const FIXTURE_ON_PAGE = 'jest-noisy';

/** Numbers quoted in the page text, taken from the benchmark data. */
export function homeValues(doc: BenchmarkDocument): Record<string, string> {
  const jest = doc.fixtures.find((row) => row.id === FIXTURE_ON_PAGE);
  if (!jest) throw new Error(`benchmark data has no ${FIXTURE_ON_PAGE} fixture`);
  // The excerpt on the page shows the first 12 lines of the fixture.
  const shown = 12;
  return {
    fixtures: String(doc.totals.fixtures),
    'jest-lines-in': formatNumber(jest.inputLines),
    'jest-lines-out': formatNumber(jest.outputLines),
    'jest-tokens-in': formatNumber(jest.inputTokens),
    'jest-tokens-out': formatNumber(jest.outputTokens),
    'jest-more-lines': formatNumber(jest.inputLines - shown),
  };
}

/** Replaces every placeholder. A missing or leftover one is a build error. */
export function renderHome(template: string, parts: HomeParts): string {
  let html = template.replaceAll('{{base}}', parts.base);
  for (const [name, value] of Object.entries(parts.values)) {
    html = html.replaceAll(`{{${name}}}`, value);
  }
  for (const [name, markup] of Object.entries(parts.blocks)) {
    const marker = `<!-- ${name} -->`;
    if (!html.includes(marker)) throw new Error(`home template has no ${marker} placeholder`);
    html = html.replace(marker, () => markup);
  }
  const left = /\{\{[\w-]+\}\}/.exec(html);
  if (left) throw new Error(`home template still has ${left[0]}`);
  return html;
}
