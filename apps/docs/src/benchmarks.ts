// Benchmark numbers for the homepage. They come from data/benchmarks.json,
// which scripts/export-benchmarks.mjs writes from the built parser, so the
// homepage and docs/benchmarks.md always show the same run.
import { escapeHtml } from './html';

export interface BenchmarkRow {
  id: string;
  kind: 'single' | 'mixed';
  inputLines: number;
  outputLines: number;
  inputTokens: number;
  outputTokens: number;
  savingsPercent: number;
}

export interface BenchmarkTotals {
  fixtures: number;
  inputLines: number;
  outputLines: number;
  inputTokens: number;
  outputTokens: number;
  savingsPercent: number;
  medianSavingsPercent: number;
  minSavingsPercent: number;
  maxSavingsPercent: number;
}

export interface BenchmarkDocument {
  logstripVersion: string;
  tokenEstimate: string;
  totals: BenchmarkTotals;
  fixtures: BenchmarkRow[];
}

export interface ProofSelection {
  /** Highest savings among the single-tool fixtures. */
  best: number;
  /** Fixtures closest to the median of the single-tool group. */
  middle: number;
  /** Lowest savings among the single-tool fixtures. */
  weakest: number;
}

export const HOME_SELECTION: ProofSelection = { best: 6, middle: 2, weakest: 2 };

const bySavingsDesc = (a: BenchmarkRow, b: BenchmarkRow): number =>
  b.savingsPercent - a.savingsPercent || a.id.localeCompare(b.id);

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Rows for the homepage ledger, chosen by rule so the list cannot be
 * cherry-picked by hand: from the single-tool fixtures, the best few, the few
 * nearest the median and the weakest few. Best savings first.
 */
export function pickProofRows(
  doc: BenchmarkDocument,
  selection: ProofSelection = HOME_SELECTION
): BenchmarkRow[] {
  const single = doc.fixtures.filter((row) => row.kind === 'single').sort(bySavingsDesc);
  const best = single.slice(0, selection.best);
  const weakest = single.slice(Math.max(single.length - selection.weakest, 0));
  const taken = new Set([...best, ...weakest].map((row) => row.id));
  const median = medianOf(single.map((row) => row.savingsPercent));
  const middle = single
    .filter((row) => !taken.has(row.id))
    .sort(
      (a, b) =>
        Math.abs(a.savingsPercent - median) - Math.abs(b.savingsPercent - median) ||
        a.id.localeCompare(b.id)
    )
    .slice(0, selection.middle);
  return [...best, ...middle, ...weakest].sort(bySavingsDesc);
}

export const formatNumber = (value: number): string => value.toLocaleString('en-US');
export const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

/** Share of the input that is kept, as a CSS percentage with two decimals. */
export function keptWidth(row: BenchmarkRow): string {
  if (row.inputTokens === 0) return '100%';
  return `${((row.outputTokens / row.inputTokens) * 100).toFixed(2)}%`;
}

function rowHtml(row: BenchmarkRow): string {
  const name = escapeHtml(row.id);
  return (
    '<li class="hp-row">' +
    `<span class="hp-row__name">${name}</span>` +
    `<span class="hp-row__bar" aria-hidden="true"><span class="hp-row__kept" style="width:${keptWidth(row)}"></span></span>` +
    `<span class="hp-row__tokens">${formatNumber(row.inputTokens)}<span aria-hidden="true"> &rarr; </span><span class="hp-sr"> to </span>${formatNumber(row.outputTokens)}</span>` +
    `<span class="hp-row__pct">${formatPercent(row.savingsPercent)}<span class="hp-sr"> saved</span></span>` +
    '</li>'
  );
}

/** The homepage proof block: totals line, ledger of bars and the selection note. */
export function proofHtml(doc: BenchmarkDocument, rows = pickProofRows(doc)): string {
  const { totals } = doc;
  return [
    '<div class="hp-proof">',
    '<p class="hp-proof__total">',
    `<strong>${formatPercent(totals.savingsPercent)}</strong> fewer tokens across all ${totals.fixtures} fixtures, `,
    `${formatNumber(totals.inputTokens)} to ${formatNumber(totals.outputTokens)}. `,
    `The median fixture saves ${formatPercent(totals.medianSavingsPercent)}, the lowest ${formatPercent(totals.minSavingsPercent)}, the highest ${formatPercent(totals.maxSavingsPercent)}.`,
    '</p>',
    '<ol class="hp-ledger" aria-label="Token savings per fixture">',
    ...rows.map(rowHtml),
    '</ol>',
    '<p class="hp-proof__legend"><span class="hp-key hp-key--kept"></span>kept <span class="hp-key hp-key--stripped"></span>stripped</p>',
    '</div>',
  ].join('');
}
