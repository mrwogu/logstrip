import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import benchmarks from './data/benchmarks.json';
import type { BenchmarkDocument } from './benchmarks';
import { markdownUrl } from './llms';
import { gitLastModified } from './plugins/git-lastmod.mjs';
import { findActiveTab, paginationIn, sidebarForTab } from './nav';
import { benchmarkJsonLd, pageJsonLd, type Crumb } from './seo';
import { ORIGIN, SITE, stripBase, withBase } from './site.mjs';

const doc = benchmarks as BenchmarkDocument;

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  // Page path without the base, like the keys of the git dates.
  const path = stripBase(context.url.pathname);

  // Show only the sidebar groups of the active header tab.
  const tab = findActiveTab(route.sidebar);
  route.sidebar = sidebarForTab(route.sidebar, tab);
  // Previous/next links would otherwise jump into another tab. Pages that set
  // prev or next in frontmatter keep what Starlight computed from it.
  const { prev, next } = route.entry.data;
  if (tab?.groups && prev === undefined && next === undefined)
    route.pagination = paginationIn(route.sidebar) as typeof route.pagination;

  // The homepage sets its own structured data.
  if (path === '/') return;
  // The 404 page gets none and stays out of the index: the site-wide robots
  // tag from astro.config.mjs is replaced, so the page carries one directive.
  if (route.entry.id === '404') {
    route.head = route.head.filter((tag) => !(tag.tag === 'meta' && tag.attrs?.name === 'robots'));
    route.head.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } });
    return;
  }
  const modified = gitLastModified().get(path);
  if (modified && route.entry.data.lastUpdated !== false) route.lastUpdated = new Date(modified);
  const url = new URL(withBase(path), ORIGIN).href;
  const crumbs: Crumb[] = [{ name: 'LogStrip', url: `${SITE}/` }];
  if (tab && !tab.external && tab.href !== path) {
    crumbs.push({
      name: tab.label,
      url: new URL(withBase(tab.href), ORIGIN).href,
    });
  }
  crumbs.push({ name: route.entry.data.title, url });
  route.head.push(
    {
      tag: 'link',
      attrs: {
        rel: 'alternate',
        type: 'text/markdown',
        href: markdownUrl(route.entry.id),
      },
    },
    pageJsonLd(
      {
        title: route.entry.data.title,
        description: route.entry.data.description,
        url,
        dateModified: route.lastUpdated,
      },
      crumbs
    )
  );
  // Starlight marks docs pages as og:type article; give the article its date.
  if (route.lastUpdated) {
    route.head.push({
      tag: 'meta',
      attrs: { property: 'article:modified_time', content: route.lastUpdated.toISOString() },
    });
  }
  if (path === '/benchmarks/') {
    route.head.push(
      benchmarkJsonLd({
        fixtures: doc.totals.fixtures,
        savingsPercent: doc.totals.savingsPercent,
        version: doc.logstripVersion,
      })
    );
  }
});
