import { describe, expect, it, vi } from 'vitest';

vi.mock('@astrojs/starlight/route-data', () => ({
  defineRouteMiddleware: (fn: unknown) => fn,
}));

const { onRequest } = await import('./route-middleware');

interface TestRoute {
  entry: {
    id: string;
    data: {
      title: string;
      description?: string;
      lastUpdated?: boolean;
      prev?: boolean;
    };
  };
  sidebar: unknown[];
  head: { tag: string; attrs?: Record<string, string>; content?: string }[];
  lastUpdated?: Date;
  pagination?: { prev?: unknown; next?: unknown };
}

function run(
  pathname: string,
  id: string,
  prev?: boolean,
  head: TestRoute['head'] = []
): TestRoute {
  const route: TestRoute = {
    entry: { id, data: { title: 'Page', description: 'About', prev } },
    pagination: { prev: 'from frontmatter' },
    sidebar: [
      {
        type: 'group',
        label: 'Get Started',
        entries: [{ type: 'link', label: 'Page', isCurrent: true }],
      },
      { type: 'group', label: 'Reference', entries: [] },
    ],
    head,
  };
  const handler = onRequest as unknown as (context: unknown) => void;
  handler({
    locals: { starlightRoute: route },
    url: new URL(pathname, 'https://mrwogu.github.io'),
  });
  return route;
}

describe('route middleware', () => {
  it('keeps pagination set in frontmatter', () => {
    const route = run('/logstrip/getting-started/', 'getting-started', false);

    expect(route.pagination).toEqual({ prev: 'from frontmatter' });
  });

  it('filters the sidebar and adds Markdown link, date and JSON-LD to docs pages', () => {
    const route = run('/logstrip/getting-started/', 'getting-started');

    expect(route.sidebar).toHaveLength(1);
    expect(route.pagination).toEqual({ prev: undefined, next: undefined });
    expect(route.head[0].attrs).toEqual({
      rel: 'alternate',
      type: 'text/markdown',
      href: 'https://mrwogu.github.io/logstrip/getting-started/index.md',
    });
    expect(route.lastUpdated).toBeInstanceOf(Date);
    const graph = JSON.parse(route.head[1].content ?? '')['@graph'];
    expect(graph[1].url).toBe('https://mrwogu.github.io/logstrip/getting-started/');
    expect(graph[2].itemListElement.map((crumb: { name: string }) => crumb.name)).toEqual([
      'LogStrip',
      'Page',
    ]);
    expect(route.head[2].attrs).toEqual({
      property: 'article:modified_time',
      content: route.lastUpdated?.toISOString(),
    });
  });

  it('adds the dataset to the benchmarks page only', () => {
    const types = (route: TestRoute): string[] =>
      route.head
        .filter((tag) => tag.tag === 'script')
        .flatMap((tag) => JSON.parse(tag.content ?? '')['@graph'])
        .map((node: { '@type': string }) => node['@type']);

    expect(types(run('/logstrip/benchmarks/', 'benchmarks'))).toContain('Dataset');
    expect(types(run('/logstrip/compare/', 'compare'))).not.toContain('Dataset');
  });

  it('adds the tab to the breadcrumbs of pages below its landing page', () => {
    const route = run('/logstrip/reference/sources/', 'reference/sources');

    const graph = JSON.parse(route.head[1].content ?? '')['@graph'];
    expect(graph[2].itemListElement.map((crumb: { name: string }) => crumb.name)).toEqual([
      'LogStrip',
      'Get Started',
      'Page',
    ]);
  });

  it('leaves the homepage without page structured data', () => {
    expect(run('/logstrip/', 'index').head).toEqual([]);
  });

  it('keeps the 404 page out of the index and gives it no structured data', () => {
    const route = run('/logstrip/404/', '404', undefined, [
      { tag: 'meta', attrs: { name: 'robots', content: 'index, follow' } },
      { tag: 'meta', attrs: { name: 'author', content: 'x' } },
    ]);

    expect(route.head).toEqual([
      { tag: 'meta', attrs: { name: 'author', content: 'x' } },
      { tag: 'meta', attrs: { name: 'robots', content: 'noindex' } },
    ]);
  });
});
