// Plain Markdown for LLMs and agents, in the same shape the MkDocs site had:
// /llms.txt links every page's /<page>/index.md, /llms-full.txt has them all.
import { posix } from 'node:path';
import { rewriteDocLinkFrom } from './plugins/remark-mkdocs-compat.mjs';
import { DOCS_BASE, NPM, REPO, SIDEBAR, SITE, SITE_DESCRIPTION, stripBase } from './site.mjs';

export const LLMS_SUMMARY =
  'LogStrip is a stream-based CLI that trims noisy CI, server, scanner and container logs down to the diagnostic context an LLM needs: it scores lines, folds repeats, masks secrets and keeps JSON valid. It ships as an npm CLI, a TypeScript library and a GitHub Action.';

/** The part of a docs collection entry this module needs. */
export interface DocPage {
  id: string;
  body?: string;
  filePath?: string;
  data: { title: string; description?: string };
}

/** The part of the Starlight sidebar config this module reads. */
export interface SidebarItem {
  label?: string;
  slug?: string;
  items?: readonly SidebarItem[];
}

export interface LlmsSection {
  label: string;
  pages: DocPage[];
}

export function markdownUrl(id: string): string {
  return `${SITE}/${id}/index.md`;
}

/** Applies `transform` to the text between fenced code blocks, fences stay as written. */
function outsideFences(body: string, transform: (part: string) => string): string {
  const parts: string[] = [];
  let chunk: string[] = [];
  let inFence = false;
  const flush = (convert: boolean): void => {
    if (chunk.length > 0) parts.push(convert ? transform(chunk.join('\n')) : chunk.join('\n'));
    chunk = [];
  };
  for (const line of body.split('\n')) {
    const isFence = line.trimStart().startsWith('```');
    if (isFence && !inFence) flush(true);
    chunk.push(line);
    if (isFence && inFence) flush(false);
    if (isFence) inFence = !inFence;
  }
  flush(!inFence);
  return parts.join('\n');
}

/**
 * Some pages wrap Markdown in layout-only HTML (card grids, source lists) and
 * use Starlight asides. Agents get plain Markdown: wrappers are dropped and
 * `:::tip[Title]` becomes a blockquote. Code examples are left alone.
 */
export function plainMarkdown(body: string): string {
  return outsideFences(body, (part) =>
    part
      .replaceAll(
        /^(?:<div class="(?:logstrip-grid|logstrip-card|source-list)">|<\/div>|<span class="logstrip-metric">.*<\/span>)\n?/gm,
        ''
      )
      .replaceAll(
        /^:::(\w+)(?:\[([^\]\n]*)\])?\n([\s\S]*?)\n:::$/gm,
        (_aside, kind: string, title: string | undefined, text: string) =>
          [`> **${title ?? kind}**`, '>', ...text.split('\n').map((line) => `> ${line}`)].join('\n')
      )
      .replaceAll(/\n{3,}/g, '\n\n')
  );
}

/** Page source with its H1 and with doc links pointing at other Markdown pages. */
export function pageMarkdown(page: DocPage): string {
  const body = plainMarkdown(page.body ?? '').replaceAll(
    /\]\(([^)\s]+\.md(?:#[^)\s]*)?)\)/g,
    (link, url: string) => {
      if (!page.filePath || url.startsWith('/')) return link;
      const target = stripBase(rewriteDocLinkFrom(url, posix.relative(DOCS_BASE, page.filePath)));
      const match = /^\/([^#]*)(#.*)?$/.exec(target);
      if (!match) return `](${target})`;
      const id = match[1].replace(/\/$/, '');
      return `](${id ? markdownUrl(id) : `${SITE}/`}${match[2] ?? ''})`;
    }
  );
  const trimmed = body.trimStart();
  return trimmed.startsWith('# ') ? trimmed : `# ${page.data.title}\n\n${trimmed}`;
}

function collect(items: readonly SidebarItem[], byId: Map<string, DocPage>): DocPage[] {
  return items.flatMap((item) => {
    if (item.slug) {
      const page = byId.get(item.slug);
      return page ? [page] : [];
    }
    return collect(item.items ?? [], byId);
  });
}

/** Sidebar groups with their pages, plus one section for pages outside the sidebar. */
export function llmsSections(
  pages: readonly DocPage[],
  sidebar: readonly SidebarItem[] = SIDEBAR
): LlmsSection[] {
  const docs = pages.filter((page) => page.id !== '404');
  const byId = new Map(docs.map((page) => [page.id, page]));
  const sections = sidebar.map((group) => ({
    label: group.label ?? '',
    pages: collect(group.items ?? [], byId),
  }));
  const listed = new Set(sections.flatMap((section) => section.pages.map((page) => page.id)));
  const rest = docs.filter((page) => !listed.has(page.id));
  if (rest.length > 0) sections.push({ label: 'More', pages: rest });
  return sections;
}

export function llmsIndex(sections: readonly LlmsSection[]): string {
  const lines = [
    '# LogStrip',
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    LLMS_SUMMARY,
    '',
    `Every page below is plain Markdown. The whole documentation in one file: ${SITE}/llms-full.txt`,
  ];
  for (const section of sections) {
    lines.push('', `## ${section.label}`, '');
    for (const page of section.pages) {
      const description = page.data.description ? `: ${page.data.description}` : '';
      lines.push(`- [${page.data.title}](${markdownUrl(page.id)})${description}`);
    }
  }
  lines.push(
    '',
    '## Optional',
    '',
    `- [Source code](${REPO}): GitHub repository`,
    `- [npm package](${NPM}): logstrip CLI and TypeScript library`,
    `- [Changelog](${REPO}/blob/main/CHANGELOG.md): release notes`,
    ''
  );
  return lines.join('\n');
}

export function llmsFull(sections: readonly LlmsSection[]): string {
  const pages = sections.flatMap((section) => section.pages);
  return [`# LogStrip\n\n> ${LLMS_SUMMARY}`, ...pages.map(pageMarkdown)].join('\n\n---\n\n');
}
