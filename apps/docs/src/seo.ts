// Structured data (schema.org JSON-LD) for search engines and AI answer engines.
// Every page shares the same three entities: the website, the author and the
// software. Pages reference them by @id, so one crawler visit builds one graph.
import { AUTHOR, CHANGELOG, NPM, REPO, SITE, SITE_DESCRIPTION } from './site.mjs';

export interface HeadTag {
  tag: 'script';
  attrs: Record<string, string>;
  content: string;
}

export interface Crumb {
  name: string;
  url: string;
}

export interface ArticleInfo {
  title: string;
  description?: string;
  url: string;
  dateModified?: Date;
}

export const OG_IMAGE = `${SITE}/assets/images/og-image-1200x630.png`;
export const OG_IMAGE_ALT =
  'LogStrip: a raw log on the left, the compressed LogStrip output on the right, with the measured token savings.';

const WEBSITE_ID = `${SITE}/#website`;
const AUTHOR_ID = `${SITE}/#author`;
const SOFTWARE_ID = `${SITE}/#software`;

const PERSON = {
  '@type': 'Person',
  '@id': AUTHOR_ID,
  name: AUTHOR.name,
  url: AUTHOR.github,
  sameAs: [AUTHOR.github, AUTHOR.linkedin],
};

const WEBSITE = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: 'LogStrip',
  url: `${SITE}/`,
  description: SITE_DESCRIPTION,
  inLanguage: 'en',
  author: { '@id': AUTHOR_ID },
  publisher: { '@id': AUTHOR_ID },
};

/** One JSON-LD script tag. `<` is escaped so page text can never close the tag. */
export function jsonLdTag(graph: readonly object[]): HeadTag {
  return {
    tag: 'script',
    attrs: { type: 'application/ld+json' },
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    }).replaceAll('<', String.raw`\u003c`),
  };
}

export function softwareJsonLd(version: string): object {
  return {
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE_ID,
    name: 'LogStrip',
    alternateName: 'logstrip',
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Log compression for AI agents',
    operatingSystem: 'Linux, macOS, Windows',
    description:
      'Free, zero-dependency CLI that compresses noisy logs into high-signal AI context with automatic source detection across 705+ log ecosystems.',
    url: `${SITE}/`,
    image: OG_IMAGE,
    screenshot: OG_IMAGE,
    softwareVersion: version,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isAccessibleForFree: true,
    installUrl: NPM,
    downloadUrl: NPM,
    softwareHelp: { '@type': 'CreativeWork', url: `${SITE}/getting-started/` },
    releaseNotes: CHANGELOG,
    programmingLanguage: 'TypeScript',
    runtimePlatform: 'Node.js 22+',
    license: 'https://opensource.org/licenses/MIT',
    author: { '@id': AUTHOR_ID },
    sameAs: [REPO, NPM],
    keywords: [
      'log compression',
      'token optimizer',
      'Claude Code',
      'AI agents',
      'CI logs',
      'LLM context',
      'secret masking',
    ],
    featureList: [
      'Stream-based log compression with bounded memory',
      '705+ detected log sources',
      'Deterministic output: no model and no network',
      'Secret masking in every mode',
      'Duplicate folding and internal stack frame hiding',
      'Token budget with --max-tokens',
      'Semantic compression of JSON reports',
      'Agent plugins and hooks for Claude Code, Cursor, GitHub Copilot, Codex, OpenCode and Factory Droid',
      'TypeScript library and GitHub Action',
    ],
  };
}

export function homeJsonLd(version: string): HeadTag {
  return jsonLdTag([
    WEBSITE,
    PERSON,
    softwareJsonLd(version),
    {
      '@type': 'SoftwareSourceCode',
      name: 'LogStrip source code',
      codeRepository: REPO,
      programmingLanguage: 'TypeScript',
      runtimePlatform: 'Node.js 22+',
      license: 'https://opensource.org/licenses/MIT',
      author: { '@id': AUTHOR_ID },
      targetProduct: { '@id': SOFTWARE_ID },
    },
  ]);
}

export function faqJsonLd(items: readonly { question: string; answer: string }[]): HeadTag {
  return jsonLdTag([
    {
      '@type': 'FAQPage',
      mainEntity: items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ]);
}

export function pageJsonLd(article: ArticleInfo, crumbs: readonly Crumb[]): HeadTag {
  return jsonLdTag([
    PERSON,
    {
      '@type': 'TechArticle',
      headline: article.title,
      ...(article.description ? { description: article.description } : {}),
      url: article.url,
      mainEntityOfPage: article.url,
      image: OG_IMAGE,
      ...(article.dateModified ? { dateModified: article.dateModified.toISOString() } : {}),
      inLanguage: 'en',
      isPartOf: { '@id': WEBSITE_ID },
      author: { '@id': AUTHOR_ID },
      publisher: { '@id': AUTHOR_ID },
      about: { '@id': SOFTWARE_ID },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    },
  ]);
}

export interface BenchmarkSummary {
  fixtures: number;
  savingsPercent: number;
  version: string;
}

/** The benchmarks page publishes real measurements, so it is also a Dataset. */
export function benchmarkJsonLd(summary: BenchmarkSummary): HeadTag {
  return jsonLdTag([
    {
      '@type': 'Dataset',
      name: 'LogStrip token savings per test fixture',
      description: `Token savings measured by running LogStrip ${summary.version} with default options over the ${summary.fixtures} log fixtures in its repository: ${summary.savingsPercent}% fewer tokens overall, using the word-based estimate that logstrip --stats prints. Reproducible with npm run bench.`,
      url: `${SITE}/benchmarks/`,
      license: 'https://opensource.org/licenses/MIT',
      isAccessibleForFree: true,
      creator: { '@id': AUTHOR_ID },
      about: { '@id': SOFTWARE_ID },
      variableMeasured: ['input tokens', 'output tokens', 'savings percent', 'lines in', 'lines out'],
      distribution: {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${REPO}/blob/main/apps/docs/src/data/benchmarks.json`,
      },
    },
  ]);
}
