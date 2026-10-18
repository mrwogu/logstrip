// Structured data (schema.org JSON-LD) for search engines and AI answer engines.
import { NPM, REPO, SITE, SITE_DESCRIPTION } from './site.mjs';

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

const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  name: 'LogStrip',
  url: `${SITE}/`,
  description: SITE_DESCRIPTION,
  inLanguage: 'en',
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

export function homeJsonLd(version: string): HeadTag {
  return jsonLdTag([
    WEBSITE,
    {
      '@type': 'SoftwareApplication',
      name: 'LogStrip',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Linux, macOS, Windows',
      description:
        'Free, zero-dependency CLI that compresses noisy logs into high-signal AI context with automatic source detection across 705+ log ecosystems.',
      url: `${SITE}/`,
      softwareVersion: version,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      installUrl: NPM,
      programmingLanguage: 'TypeScript',
      runtimePlatform: 'Node.js 22+',
      license: 'https://opensource.org/licenses/MIT',
      author: {
        '@type': 'Person',
        name: 'mrwogu',
        url: 'https://github.com/mrwogu',
      },
      sameAs: [REPO, NPM],
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
    {
      '@type': 'TechArticle',
      headline: article.title,
      ...(article.description ? { description: article.description } : {}),
      url: article.url,
      ...(article.dateModified ? { dateModified: article.dateModified.toISOString() } : {}),
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE}/#website` },
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
