// Shared by astro.config.mjs and the llms.txt / Markdown endpoints.
export const ORIGIN = 'https://mrwogu.github.io';

// GitHub Pages project site: every internal URL starts with this.
export const BASE = '/logstrip';

// Public URL of the site root, without a trailing slash.
export const SITE = `${ORIGIN}${BASE}`;

// Markdown sources, relative to apps/docs. Entry `filePath`s start with it.
export const DOCS_BASE = '../../docs';

export const REPO = 'https://github.com/mrwogu/logstrip';
export const NPM = 'https://www.npmjs.com/package/logstrip';

export const SITE_DESCRIPTION =
  'Free, zero-dependency CLI that compresses noisy logs into high-signal AI context. 705+ detected ecosystems, stream-safe, deterministic output.';

/** Site path (starting with /) with the base in front. */
export function withBase(path) {
  return `${BASE}${path}`;
}

/** URL path without the base, so it matches `/getting-started/` style keys. */
export function stripBase(pathname) {
  if (pathname === BASE) return '/';
  return pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length) : pathname;
}

// Top-level groups map to the header tabs in src/nav.ts.
export const SIDEBAR = [
  {
    label: 'Start',
    items: [
      { label: 'Getting Started', slug: 'getting-started' },
      { label: 'Supported Sources', slug: 'reference/sources' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'CLI', slug: 'reference/cli' },
      { label: 'Core API', slug: 'reference/core' },
      { label: 'GitHub Action', slug: 'reference/action' },
    ],
  },
  {
    label: 'Guides',
    items: [
      { label: 'Compression Flow', slug: 'guides/compression-flow' },
      { label: 'Configuration', slug: 'guides/configuration' },
      { label: 'Agent Plugins', slug: 'guides/plugins' },
      { label: 'Security', slug: 'guides/security' },
      { label: 'Troubleshooting', slug: 'guides/troubleshooting' },
    ],
  },
  {
    label: 'Examples',
    items: [
      { label: 'Cookbook', slug: 'examples' },
      { label: 'npm test', slug: 'examples/npm-test' },
      { label: 'pytest', slug: 'examples/pytest' },
      { label: 'docker compose', slug: 'examples/docker-compose' },
      { label: 'Kubernetes', slug: 'examples/k8s' },
      { label: 'Jenkins', slug: 'examples/jenkins' },
    ],
  },
];
