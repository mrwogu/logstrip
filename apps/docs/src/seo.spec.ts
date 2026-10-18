import { describe, expect, it } from 'vitest';
import { faqJsonLd, homeJsonLd, jsonLdTag, pageJsonLd } from './seo';

const parse = (content: string): { '@graph': Record<string, unknown>[] } => JSON.parse(content);

describe('jsonLdTag', () => {
  it('escapes < so page text cannot close the script tag', () => {
    const tag = jsonLdTag([{ name: '</script><b>' }]);

    expect(tag.content).not.toContain('<');
    expect(parse(tag.content)['@graph'][0].name).toBe('</script><b>');
  });
});

describe('homeJsonLd', () => {
  it('describes the website and the CLI with its version', () => {
    const graph = parse(homeJsonLd('1.2.3').content)['@graph'];

    expect(graph.map((node) => node['@type'])).toEqual(['WebSite', 'SoftwareApplication']);
    expect(graph[1]).toMatchObject({
      name: 'LogStrip',
      softwareVersion: '1.2.3',
      url: 'https://mrwogu.github.io/logstrip/',
      installUrl: 'https://www.npmjs.com/package/logstrip',
      runtimePlatform: 'Node.js 22+',
    });
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
  it('adds an article and numbered breadcrumbs', () => {
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

    expect(graph[0]).toMatchObject({
      '@type': 'TechArticle',
      headline: 'Security',
      description: 'Security guide',
      dateModified: '2026-01-02T03:04:05.000Z',
    });
    expect(graph[1].itemListElement).toEqual([
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
    const [article] = parse(
      pageJsonLd({ title: 'X', url: 'https://mrwogu.github.io/logstrip/x/' }, []).content
    )['@graph'];

    expect(article).not.toHaveProperty('description');
    expect(article).not.toHaveProperty('dateModified');
  });
});
