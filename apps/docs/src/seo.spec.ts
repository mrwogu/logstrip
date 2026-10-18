import { describe, expect, it } from 'vitest';
import { benchmarkJsonLd, faqJsonLd, homeJsonLd, jsonLdTag, pageJsonLd } from './seo';

const parse = (content: string): { '@graph': Record<string, unknown>[] } => JSON.parse(content);

const AUTHOR_ID = 'https://mrwogu.github.io/logstrip/#author';
const SOFTWARE_ID = 'https://mrwogu.github.io/logstrip/#software';

describe('jsonLdTag', () => {
  it('escapes < so page text cannot close the script tag', () => {
    const tag = jsonLdTag([{ name: '</script><b>' }]);

    expect(tag.content).not.toContain('<');
    expect(parse(tag.content)['@graph'][0].name).toBe('</script><b>');
  });
});

describe('homeJsonLd', () => {
  const graph = parse(homeJsonLd('1.2.3').content)['@graph'];

  it('describes the website, the author, the CLI with its version and the repository', () => {
    expect(graph.map((node) => node['@type'])).toEqual([
      'WebSite',
      'Person',
      'SoftwareApplication',
      'SoftwareSourceCode',
    ]);
    expect(graph[2]).toMatchObject({
      '@id': SOFTWARE_ID,
      name: 'LogStrip',
      softwareVersion: '1.2.3',
      url: 'https://mrwogu.github.io/logstrip/',
      installUrl: 'https://www.npmjs.com/package/logstrip',
      runtimePlatform: 'Node.js 22+',
      isAccessibleForFree: true,
    });
    expect(graph[3]).toMatchObject({
      codeRepository: 'https://github.com/mrwogu/logstrip',
      targetProduct: { '@id': SOFTWARE_ID },
    });
  });

  it('names the author once and links every entity to that node', () => {
    expect(graph[1]).toEqual({
      '@type': 'Person',
      '@id': AUTHOR_ID,
      name: 'Wojciech Guziak',
      url: 'https://github.com/mrwogu',
      sameAs: ['https://github.com/mrwogu', 'https://www.linkedin.com/in/wojciechguziak/'],
    });
    expect(graph[0].author).toEqual({ '@id': AUTHOR_ID });
    expect(graph[2].author).toEqual({ '@id': AUTHOR_ID });
    expect(graph[3].author).toEqual({ '@id': AUTHOR_ID });
  });
});

describe('faqJsonLd', () => {
  it('lists each question with its accepted answer', () => {
    const graph = parse(faqJsonLd([{ question: 'Q1?', answer: 'A1 </script>' }]).content)['@graph'];

    expect(graph).toEqual([
      {
        '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: 'Q1?', acceptedAnswer: { '@type': 'Answer', text: 'A1 </script>' } },
        ],
      },
    ]);
  });

  it('keeps the answer text from closing the script tag', () => {
    expect(faqJsonLd([{ question: 'Q', answer: '</script>' }]).content).not.toContain('<');
  });
});

describe('pageJsonLd', () => {
  it('adds the author, an article and numbered breadcrumbs', () => {
    const graph = parse(
      pageJsonLd(
        {
          title: 'Security',
          description: 'Security guide',
          url: 'https://mrwogu.github.io/logstrip/guides/security/',
          dateModified: new Date('2026-01-02T03:04:05Z'),
        },
        [
          { name: 'LogStrip', url: 'https://mrwogu.github.io/logstrip/' },
          {
            name: 'Security',
            url: 'https://mrwogu.github.io/logstrip/guides/security/',
          },
        ]
      ).content
    )['@graph'];

    expect(graph.map((node) => node['@type'])).toEqual(['Person', 'TechArticle', 'BreadcrumbList']);
    expect(graph[1]).toMatchObject({
      '@type': 'TechArticle',
      headline: 'Security',
      description: 'Security guide',
      mainEntityOfPage: 'https://mrwogu.github.io/logstrip/guides/security/',
      dateModified: '2026-01-02T03:04:05.000Z',
      author: { '@id': AUTHOR_ID },
      publisher: { '@id': AUTHOR_ID },
      about: { '@id': SOFTWARE_ID },
    });
    expect(graph[2].itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'LogStrip',
        item: 'https://mrwogu.github.io/logstrip/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Security',
        item: 'https://mrwogu.github.io/logstrip/guides/security/',
      },
    ]);
  });

  it('leaves out a missing description and date', () => {
    const [, article] = parse(
      pageJsonLd({ title: 'X', url: 'https://mrwogu.github.io/logstrip/x/' }, []).content
    )['@graph'];

    expect(article).not.toHaveProperty('description');
    expect(article).not.toHaveProperty('dateModified');
  });
});

describe('benchmarkJsonLd', () => {
  it('describes the measured savings as a dataset with the numbers in the text', () => {
    const [dataset] = parse(
      benchmarkJsonLd({ fixtures: 51, savingsPercent: 51.3, version: '2.0.0' }).content
    )['@graph'];

    expect(dataset).toMatchObject({
      '@type': 'Dataset',
      url: 'https://mrwogu.github.io/logstrip/benchmarks/',
      creator: { '@id': AUTHOR_ID },
      about: { '@id': SOFTWARE_ID },
    });
    expect(dataset.description).toContain('51 log fixtures');
    expect(dataset.description).toContain('51.3% fewer tokens');
    expect(dataset.description).toContain('LogStrip 2.0.0');
  });
});
