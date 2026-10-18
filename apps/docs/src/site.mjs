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
export const CHANGELOG = `${REPO}/blob/main/CHANGELOG.md`;

// Shown in the footer and in the structured data as the author of the project.
export const AUTHOR = {
  name: 'Wojciech Guziak',
  github: 'https://github.com/mrwogu',
  linkedin: 'https://www.linkedin.com/in/wojciechguziak/',
};

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

// Sidebar groups as data: group label -> { page label: slug }. src/nav.ts builds
// the header tabs from this table, one tab per group, so a group is added here
// and nowhere else. The first page of a group is the landing page of its tab.
const GROUPS = {
  'Get Started': {
    'Getting Started': 'getting-started',
    'Supported Sources': 'reference/sources',
  },
  Evaluate: {
    'Why LogStrip': 'why-logstrip',
    Benchmarks: 'benchmarks',
    Compare: 'compare',
  },
  Reference: {
    CLI: 'reference/cli',
    'Core API': 'reference/core',
    'GitHub Action': 'reference/action',
  },
  Guides: {
    'Compression Flow': 'guides/compression-flow',
    Configuration: 'guides/configuration',
    'Agent Plugins': 'guides/plugins',
    Security: 'guides/security',
    Troubleshooting: 'guides/troubleshooting',
  },
  Examples: {
    Cookbook: 'examples',
    'npm test': 'examples/npm-test',
    pytest: 'examples/pytest',
    'docker compose': 'examples/docker-compose',
    Kubernetes: 'examples/k8s',
    Jenkins: 'examples/jenkins',
  },
};

export const SIDEBAR = Object.entries(GROUPS).map(([label, pages]) => ({
  label,
  items: Object.entries(pages).map(([title, slug]) => ({ label: title, slug })),
}));
