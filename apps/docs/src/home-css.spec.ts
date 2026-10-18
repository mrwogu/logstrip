// Guards the landing page stylesheet against the findings a code scanner raised
// on the old one: text that fails the contrast ratio, duplicate selectors and
// !important. The colours are read from the CSS itself, so a change to a token
// is checked without anyone remembering to update a test.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
  fileURLToPath(new URL('./styles/home.css', import.meta.url)),
  'utf8'
).replaceAll(/\/\*[\s\S]*?\*\//g, '');

interface Rule {
  selector: string;
  body: string;
  children: Rule[];
}

/** Index of the brace that closes the one just before `from`. */
function closingBrace(text: string, from: number): number {
  let depth = 1;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return i;
  }
  throw new Error('unbalanced braces in home.css');
}

/** Rules of one nesting level. At-rules that hold rules (@media, @supports) get children. */
function parse(text: string): Rule[] {
  const rules: Rule[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('{', cursor);
    if (open === -1) break;
    const close = closingBrace(text, open + 1);
    const selector = text.slice(cursor, open).trim();
    const body = text.slice(open + 1, close);
    const nests = /^@(media|supports)\b/.test(selector);
    rules.push({ selector, body, children: nests ? parse(body) : [] });
    cursor = close + 1;
  }
  return rules;
}

const normalize = (selector: string): string =>
  selector
    .split(',')
    .map((part) => part.trim().replaceAll(/\s+/g, ' '))
    .sort((a, b) => a.localeCompare(b))
    .join(', ');

function duplicates(rules: readonly Rule[], scope = 'top level'): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  for (const rule of rules) {
    if (rule.selector.startsWith('@keyframes')) {
      const key = rule.selector;
      if (seen.has(key)) found.push(`${scope}: ${key}`);
      seen.add(key);
    } else if (rule.children.length > 0) {
      found.push(...duplicates(rule.children, rule.selector));
    } else if (!rule.selector.startsWith('@')) {
      const key = normalize(rule.selector);
      if (seen.has(key)) found.push(`${scope}: ${key}`);
      seen.add(key);
    }
  }
  return found;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function tokens(selector: string): Record<string, string> {
  const rule = parse(CSS).find((item) => item.selector === selector);
  if (!rule) throw new Error(`home.css has no ${selector} rule`);
  return Object.fromEntries(
    [...rule.body.matchAll(/--hp-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]])
  );
}

const DARK = tokens('.home-page');
const LIGHT = { ...DARK, ...tokens(":root[data-theme='light'] .home-page") };

/** Text token, background token. Every pair is body text and needs 4.5:1. */
const PAGE_PAIRS: readonly (readonly [string, string])[] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['faint', 'bg'],
  ['faint', 'surface'],
  ['accent-text', 'bg'],
  ['accent-text', 'surface'],
  ['btn-ink', 'btn-bg'],
];

const TERMINAL_PAIRS: readonly (readonly [string, string])[] = ['text', 'muted', 'faint', 'accent', 'warn', 'danger'].flatMap(
  (name) => [
    [`term-${name}`, 'term-bg'],
    [`term-${name}`, 'term-bar'],
  ]
) as [string, string][];

describe('home.css contrast', () => {
  it.each([
    ['dark', DARK],
    ['light', LIGHT],
  ])('keeps every text colour at 4.5:1 or better in the %s theme', (_theme, theme) => {
    const failing = [...PAGE_PAIRS, ...TERMINAL_PAIRS]
      .map(([fg, bg]) => ({ fg, bg, ratio: contrast(theme[fg], theme[bg]) }))
      .filter((pair) => !(pair.ratio >= 4.5))
      .map((pair) => `${pair.fg} on ${pair.bg}: ${pair.ratio.toFixed(2)}`);

    expect(failing).toEqual([]);
  });

  it('keeps the filled bars visible against the page in both themes', () => {
    expect(contrast(DARK.bar, DARK.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(LIGHT.bar, LIGHT.bg)).toBeGreaterThanOrEqual(3);
  });

  it('reads the tokens it checks, so a renamed token fails here instead of passing silently', () => {
    for (const [fg, bg] of [...PAGE_PAIRS, ...TERMINAL_PAIRS]) {
      expect(DARK[fg], fg).toMatch(/^#/);
      expect(DARK[bg], bg).toMatch(/^#/);
    }
  });
});

describe('home.css hygiene', () => {
  it('has no duplicate selectors at the same level', () => {
    expect(duplicates(parse(CSS))).toEqual([]);
  });

  it('has no !important', () => {
    expect(CSS).not.toContain('!important');
  });

  it('sets no all-caps text, the kickers are lowercase', () => {
    expect(CSS).not.toMatch(/text-transform:\s*uppercase/);
  });

  it('keeps the selectors it relies on, so the check above is not an empty parse', () => {
    expect(parse(CSS).length).toBeGreaterThan(100);
    expect(parse(CSS).some((rule) => rule.selector.startsWith('@media'))).toBe(true);
  });
});
