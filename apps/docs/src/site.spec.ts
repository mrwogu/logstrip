import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SIDEBAR, stripBase, withBase } from './site.mjs';

// apps/docs/src -> repo root -> docs
const DOCS_DIR = fileURLToPath(new URL('../../../docs', import.meta.url));

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? markdownFiles(join(dir, entry.name))
      : entry.name.endsWith('.md')
        ? [join(dir, entry.name)]
        : []
  );
}

/** docs/guides/plugins.md -> guides/plugins, docs/examples/index.md -> examples. */
function slugOf(file: string): string {
  return relative(DOCS_DIR, file)
    .replace(/\.md$/, '')
    .replace(/(^|\/)index$/, '');
}

const slugs = SIDEBAR.flatMap((group) => group.items.map((item) => item.slug));

describe('SIDEBAR', () => {
  it('is built from the group table, in order, without repeated slugs', () => {
    expect(SIDEBAR.map((group) => group.label)).toEqual([
      'Get Started',
      'Evaluate',
      'Reference',
      'Guides',
      'Examples',
    ]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('points every entry at a Markdown page in docs/', () => {
    const pages = new Set(markdownFiles(DOCS_DIR).map(slugOf));

    expect(slugs.filter((slug) => !pages.has(slug))).toEqual([]);
  });

  it('lists every docs page, so the header tabs and llms.txt reach it', () => {
    const listed = new Set(slugs);
    const missing = markdownFiles(DOCS_DIR)
      .map(slugOf)
      .filter((slug) => slug !== '' && !listed.has(slug));

    expect(missing).toEqual([]);
  });
});

describe('docs pages', () => {
  it('have a title and a description in their frontmatter', () => {
    const problems = markdownFiles(DOCS_DIR).flatMap((file) => {
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
      return ['title', 'description']
        .filter((key) => !new RegExp(`^${key}: .+`, 'm').test(frontmatter))
        .map((key) => `${slugOf(file)} has no ${key}`);
    });

    expect(problems).toEqual([]);
  });
});

describe('withBase and stripBase', () => {
  it('add and remove the project-site base', () => {
    expect(withBase('/why-logstrip/')).toBe('/logstrip/why-logstrip/');
    expect(stripBase('/logstrip/why-logstrip/')).toBe('/why-logstrip/');
    expect(stripBase('/logstrip')).toBe('/');
  });
});
