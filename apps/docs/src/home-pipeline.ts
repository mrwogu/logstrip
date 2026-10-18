// The pipeline diagram on the homepage, drawn as inline SVG at build time.
// Two layouts come from one description: a row for wide screens and a column
// for phones, so the text never shrinks below a readable size. The page shows
// one of them and hides the other with CSS.
import { escapeHtml } from './html';

export interface PipelineStage {
  name: string;
  /** Two short lines of text, 21 characters at most so they fit the box. */
  lines: readonly [string, string];
  /** What the stage leaves in the output, shown in mono type. */
  mark: string;
}

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  { name: 'classify', lines: ['log or text?', 'prose passes through'], mark: 'text | log' },
  { name: 'sanitize', lines: ['mask secrets', 'ids become [ID]'], mark: '[TIME]  [IP]' },
  { name: 'score', lines: ['rank every line', 'keep the context'], mark: 'ERROR  at app' },
  { name: 'dedupe', lines: ['fold repeats', 'hide library frames'], mark: '[x3]  [... hidden]' },
  { name: 'budget', lines: ['cap at --max-tokens', 'best lines, in order'], mark: '--max-tokens N' },
];

export interface PipelineSample {
  inputLines: number;
  outputLines: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  width: number;
  height: number;
  start: Rect;
  stages: Rect[];
  end: Rect;
  vertical: boolean;
}

const BOX_H = 128;
const GAP = 24;

function wideLayout(count: number): Layout {
  const node = { w: 96, h: 72 };
  const box = { w: 176, h: BOX_H };
  const height = 168;
  const stages = Array.from({ length: count }, (_, i) => ({
    x: node.w + GAP + i * (box.w + GAP),
    y: (height - box.h) / 2,
    ...box,
  }));
  const last = stages[count - 1];
  return {
    width: last.x + last.w + GAP + node.w,
    height,
    start: { x: 0, y: (height - node.h) / 2, ...node },
    stages,
    end: { x: last.x + last.w + GAP, y: (height - node.h) / 2, ...node },
    vertical: false,
  };
}

function tallLayout(count: number): Layout {
  const width = 360;
  const node = { w: 320, h: 52 };
  const box = { w: 320, h: BOX_H };
  const stages = Array.from({ length: count }, (_, i) => ({
    x: 20,
    y: node.h + GAP + i * (box.h + GAP),
    ...box,
  }));
  const last = stages[count - 1];
  return {
    width,
    height: last.y + last.h + GAP + node.h,
    start: { x: 20, y: 0, ...node },
    stages,
    end: { x: 20, y: last.y + last.h + GAP, ...node },
    vertical: true,
  };
}

const n = (value: number): string => String(Math.round(value * 100) / 100);

function arrow(from: Rect, to: Rect, vertical: boolean, marker: string): string {
  const [x1, y1, x2, y2] = vertical
    ? [from.x + from.w / 2, from.y + from.h + 3, to.x + to.w / 2, to.y - 3]
    : [from.x + from.w + 3, from.y + from.h / 2, to.x - 3, to.y + to.h / 2];
  return `<line class="hp-svg__arrow" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" marker-end="url(#${marker})"/>`;
}

function node(rect: Rect, label: string, detail: string, vertical: boolean): string {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const text = vertical
    ? `<text class="hp-svg__text" x="${n(cx)}" y="${n(cy + 5)}" text-anchor="middle">${escapeHtml(label)} <tspan class="hp-svg__mono">${escapeHtml(detail)}</tspan></text>`
    : `<text class="hp-svg__text" x="${n(cx)}" y="${n(cy - 4)}" text-anchor="middle">${escapeHtml(label)}</text>` +
      `<text class="hp-svg__mono" x="${n(cx)}" y="${n(cy + 16)}" text-anchor="middle">${escapeHtml(detail)}</text>`;
  return `<rect class="hp-svg__node" x="${n(rect.x)}" y="${n(rect.y)}" width="${rect.w}" height="${rect.h}" rx="10"/>${text}`;
}

function stageBox(rect: Rect, stage: PipelineStage, index: number): string {
  const { x, y, w, h } = rect;
  return [
    `<rect class="hp-svg__box" x="${n(x)}" y="${n(y)}" width="${w}" height="${h}" rx="12"/>`,
    `<text class="hp-svg__num" x="${n(x + w - 18)}" y="${n(y + 30)}" text-anchor="middle">${index + 1}</text>`,
    `<text class="hp-svg__name" x="${n(x + 16)}" y="${n(y + 30)}">${escapeHtml(stage.name)}</text>`,
    `<text class="hp-svg__text" x="${n(x + 16)}" y="${n(y + 54)}">${escapeHtml(stage.lines[0])}</text>`,
    `<text class="hp-svg__text" x="${n(x + 16)}" y="${n(y + 74)}">${escapeHtml(stage.lines[1])}</text>`,
    `<rect class="hp-svg__chip" x="${n(x + 16)}" y="${n(y + h - 38)}" width="${w - 32}" height="26" rx="6"/>`,
    `<text class="hp-svg__mono" x="${n(x + 26)}" y="${n(y + h - 20)}">${escapeHtml(stage.mark)}</text>`,
  ].join('');
}

/** One SVG for one layout. `idPrefix` keeps the ids of the two copies apart. */
export function pipelineSvg(
  sample: PipelineSample,
  vertical: boolean,
  stages: readonly PipelineStage[] = PIPELINE_STAGES
): string {
  const layout = vertical ? tallLayout(stages.length) : wideLayout(stages.length);
  const id = vertical ? 'hp-pipe-tall' : 'hp-pipe-wide';
  const sequence = [layout.start, ...layout.stages, layout.end];
  const arrows = sequence
    .slice(1)
    .map((to, i) => arrow(sequence[i], to, layout.vertical, `${id}-head`));
  const description =
    `A raw log of ${sample.inputLines} lines passes through ${stages.length} stages: ` +
    `${stages.map((stage) => stage.name).join(', ')}. The clean log has ${sample.outputLines} lines.`;
  return [
    `<svg class="hp-svg hp-svg--${vertical ? 'tall' : 'wide'}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-labelledby="${id}-title ${id}-desc" xmlns="http://www.w3.org/2000/svg">`,
    `<title id="${id}-title">How LogStrip processes a log</title>`,
    `<desc id="${id}-desc">${escapeHtml(description)}</desc>`,
    `<defs><marker id="${id}-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="hp-svg__head" d="M1 1 L8 5 L1 9"/></marker></defs>`,
    node(layout.start, 'raw log', `${sample.inputLines} lines`, layout.vertical),
    ...arrows,
    ...layout.stages.map((rect, i) => stageBox(rect, stages[i], i)),
    node(layout.end, 'clean log', `${sample.outputLines} lines`, layout.vertical),
    '</svg>',
  ].join('');
}

/** Both layouts, side by side in the markup. CSS shows the one that fits. */
export function pipelineHtml(sample: PipelineSample): string {
  return `<div class="hp-pipeline">${pipelineSvg(sample, false)}${pipelineSvg(sample, true)}</div>`;
}
