import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  docIdFromEntry,
  remarkMkdocsCompat,
  rewriteDocLink,
  rewriteDocLinkFrom,
} from './remark-mkdocs-compat.mjs';

const DOCS = fileURLToPath(new URL('../../../../docs', import.meta.url));

describe('docIdFromEntry', () => {
  it('maps index and README pages to their directory', () => {
    expect(docIdFromEntry('index.md')).toBe('index');
    expect(docIdFromEntry('examples/index.md')).toBe('examples');
    expect(docIdFromEntry('guides/README.md')).toBe('guides');
    expect(docIdFromEntry('reference/cli.md')).toBe('reference/cli');
  });
});

describe('rewriteDocLinkFrom', () => {
  it('resolves links from a docs-relative page path and adds the base', () => {
    expect(rewriteDocLinkFrom('../reference/cli.md#severity-filtering', 'examples/pytest.md')).toBe(
      '/logstrip/reference/cli/#severity-filtering'
    );
    expect(rewriteDocLinkFrom('../../README.md', 'guides/security.md')).toBe(
      'https://github.com/mrwogu/logstrip/blob/main/README.md'
    );
  });
});

describe('rewriteDocLink', () => {
  const from = resolve(DOCS, 'examples/pytest.md');

  it('turns relative .md links into site URLs under the base and keeps the hash', () => {
    expect(rewriteDocLink('../reference/cli.md#auto-mode-default', from)).toBe(
      '/logstrip/reference/cli/#auto-mode-default'
    );
    expect(rewriteDocLink('index.md', from)).toBe('/logstrip/examples/');
    expect(rewriteDocLink('../index.md', from)).toBe('/logstrip/');
  });

  it('leaves absolute, external and non-markdown links alone', () => {
    expect(rewriteDocLink('https://example.com/a.md', from)).toBe('https://example.com/a.md');
    expect(rewriteDocLink('/logstrip/reference/cli/', from)).toBe('/logstrip/reference/cli/');
    expect(rewriteDocLink('#local', from)).toBe('#local');
  });
});

describe('remarkMkdocsCompat', () => {
  it('drops the body H1, rewrites links and sets the page slug', () => {
    // Arrange
    const link = { type: 'link', url: 'npm-test.md', children: [] };
    const tree = {
      type: 'root',
      children: [
        { type: 'heading', depth: 1, children: [{ type: 'text', value: 'Title' }] },
        { type: 'paragraph', children: [link] },
      ],
    };
    const file = {
      path: resolve(DOCS, 'examples/pytest.md'),
      data: { astro: { frontmatter: {} } },
    };

    // Act
    remarkMkdocsCompat()(tree, file);

    // Assert
    expect(tree.children.some((c) => c.type === 'heading')).toBe(false);
    expect(link.url).toBe('/logstrip/examples/npm-test/');
    expect(file.data.astro.frontmatter).toEqual({ slug: 'examples/pytest' });
  });

  it('keeps deeper headings and leaves files outside docs/ without a slug', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'heading', depth: 2, children: [{ type: 'text', value: 'Sub' }] }],
    };
    const file = { path: resolve(DOCS, '../README.md'), data: { astro: { frontmatter: {} } } };

    remarkMkdocsCompat()(tree, file);

    expect(tree.children).toHaveLength(1);
    expect(file.data.astro.frontmatter).toEqual({});
  });
});
