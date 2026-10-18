import { describe, expect, it } from 'vitest';
import {
  llmsFull,
  llmsIndex,
  llmsSections,
  markdownUrl,
  pageMarkdown,
  plainMarkdown,
  type DocPage,
  type SidebarItem,
} from './llms';

const page = (id: string, extra: Partial<DocPage> = {}): DocPage => ({
  id,
  body: `# ${id}\n\nBody of ${id}.`,
  filePath: `../../docs/${id}.md`,
  data: { title: `Title ${id}`, description: `About ${id}` },
  ...extra,
});

const SIDEBAR: SidebarItem[] = [
  { label: 'Start', items: [{ label: 'Intro', slug: 'getting-started' }] },
  {
    label: 'Reference',
    items: [
      { label: 'CLI', slug: 'reference/cli' },
      { label: 'Missing', slug: 'reference/missing' },
    ],
  },
  { label: 'Empty' },
];

describe('markdownUrl', () => {
  it('points at the index.md next to each HTML page', () => {
    expect(markdownUrl('guides/security')).toBe(
      'https://mrwogu.github.io/logstrip/guides/security/index.md'
    );
  });
});

describe('plainMarkdown', () => {
  it('drops card and source list wrappers and keeps the Markdown inside', () => {
    const body = [
      '<div class="logstrip-grid">',
      '',
      '<div class="logstrip-card">',
      '<span class="logstrip-metric">node</span>',
      '',
      '### [npm test](npm-test.md)',
      '',
      'Runs vitest.',
      '</div>',
      '',
      '</div>',
      '',
      '<div class="source-list">',
      '',
      '- Express',
      '',
      '</div>',
    ].join('\n');

    expect(plainMarkdown(body).trim()).toBe(
      ['### [npm test](npm-test.md)', '', 'Runs vitest.', '', '- Express'].join('\n')
    );
  });

  it('turns asides into blockquotes with their title', () => {
    const body =
      ':::tip[CLI is preferred]\nUse the CLI.\nIt is simpler.\n:::\n\n:::note\nPlain.\n:::';

    expect(plainMarkdown(body)).toBe(
      [
        '> **CLI is preferred**',
        '>',
        '> Use the CLI.',
        '> It is simpler.',
        '',
        '> **note**',
        '>',
        '> Plain.',
      ].join('\n')
    );
  });

  it('leaves code examples untouched', () => {
    const body = [
      '```html',
      '<div class="source-list">',
      '</div>',
      '```',
      '',
      ':::tip',
      'x',
      ':::',
    ];

    expect(plainMarkdown(body.join('\n')).split('\n').slice(0, 4)).toEqual(body.slice(0, 4));
  });
});

describe('pageMarkdown', () => {
  it('rewrites relative doc links to absolute Markdown URLs and keeps the hash', () => {
    const source = page('examples/pytest', {
      body: '# pytest\n\nSee [cli](../reference/cli.md#severity-filtering) and [npm](npm-test.md).',
    });

    expect(pageMarkdown(source)).toBe(
      '# pytest\n\nSee [cli](https://mrwogu.github.io/logstrip/reference/cli/index.md#severity-filtering) and [npm](https://mrwogu.github.io/logstrip/examples/npm-test/index.md).'
    );
  });

  it('keeps external, absolute and outside-docs links usable', () => {
    const source = page('guides/security', {
      body: '# Security\n\n[a](https://x.dev/a.md) [b](/b.md) [c](../../CONTRIBUTING.md)',
    });

    expect(pageMarkdown(source)).toBe(
      '# Security\n\n[a](https://x.dev/a.md) [b](/b.md) [c](https://github.com/mrwogu/logstrip/blob/main/CONTRIBUTING.md)'
    );
  });

  it('adds the title as H1 when the body has none', () => {
    const source = page('guides/security', { body: 'Just text.' });

    expect(pageMarkdown(source)).toBe('# Title guides/security\n\nJust text.');
  });
});

describe('llmsSections', () => {
  const pages = [
    page('getting-started'),
    page('reference/cli'),
    page('guides/hidden'),
    page('404'),
  ];

  it('follows the sidebar, skips unknown slugs and collects the rest', () => {
    const sections = llmsSections(pages, SIDEBAR);

    expect(sections.map((s) => [s.label, s.pages.map((p) => p.id)])).toEqual([
      ['Start', ['getting-started']],
      ['Reference', ['reference/cli']],
      ['Empty', []],
      ['More', ['guides/hidden']],
    ]);
  });

  it('uses the real sidebar by default', () => {
    expect(llmsSections([page('getting-started')])[0].pages).toHaveLength(1);
  });

  it('builds an index with descriptions and a full dump with every page', () => {
    const sections = llmsSections(pages, SIDEBAR);

    const index = llmsIndex(sections);
    const full = llmsFull(sections);

    expect(index).toContain(
      '- [Title getting-started](https://mrwogu.github.io/logstrip/getting-started/index.md): About getting-started'
    );
    expect(index).toContain('## Optional');
    expect(full).toContain('Body of guides/hidden.');
    expect(full).not.toContain('Body of 404');
  });

  it('lists a page without a description as a bare link', () => {
    const index = llmsIndex(
      llmsSections([page('getting-started', { data: { title: 'Intro' } })], SIDEBAR)
    );

    expect(index).toContain(
      '- [Intro](https://mrwogu.github.io/logstrip/getting-started/index.md)\n'
    );
  });
});
