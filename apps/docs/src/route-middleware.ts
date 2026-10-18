import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { markdownUrl } from './llms';
import { gitLastModified } from './plugins/git-lastmod.mjs';
import { findActiveTab, paginationIn, sidebarForTab } from './nav';
import { pageJsonLd, type Crumb } from './seo';
import { ORIGIN, SITE, stripBase, withBase } from './site.mjs';

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

  // The homepage sets its own structured data, the 404 page gets none.
  if (path === '/' || route.entry.id === '404') return;
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
});
