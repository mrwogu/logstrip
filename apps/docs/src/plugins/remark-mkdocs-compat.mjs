// Keeps docs/ sources readable on GitHub and in editors while Starlight
// renders them: relative `.md` links and a body H1 stay in the files.
import { posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, REPO } from '../site.mjs';

const DOCS_DIR = fileURLToPath(new URL('../../../../docs', import.meta.url));
const REPO_BLOB = `${REPO}/blob/main/`;

/** Page id from a path inside docs/: index.md and README.md map to their directory. */
export function docIdFromEntry(entry) {
  const path = entry.replace(/\.mdx?$/, '').replace(/(^|\/)README$/, '$1index');
  if (path === 'index') return 'index';
  return path.replace(/\/index$/, '');
}

/** Link from the page at `pagePath` (relative to docs/) to its site URL, base included. */
export function rewriteDocLinkFrom(url, pagePath) {
  const match = /^([^:#?]+\.md)(#.*)?$/.exec(url);
  if (!match || url.startsWith('/')) return url;
  const rel = posix.normalize(posix.join(posix.dirname(pagePath), decodeURI(match[1])));
  const hash = match[2] ?? '';
  if (rel.startsWith('..')) return REPO_BLOB + posix.normalize(`docs/${rel}`) + hash;
  const id = docIdFromEntry(rel);
  const path = id === 'index' ? '/' : `/${id}/`;
  return `${BASE}${path}${hash}`;
}

export function rewriteDocLink(url, filePath) {
  return rewriteDocLinkFrom(url, relative(DOCS_DIR, filePath).replaceAll('\\', '/'));
}

function walk(node, fn) {
  fn(node);
  if (node.children) for (const child of node.children) walk(child, fn);
}

export function remarkMkdocsCompat() {
  return (tree, file) => {
    // starlight-links-validator maps files to pages via src/content/docs.
    // Sources live in docs/, so hand it the page slug explicitly.
    const rel = file.path ? relative(DOCS_DIR, file.path).replaceAll('\\', '/') : '';
    const id = rel && !rel.startsWith('..') ? docIdFromEntry(rel) : undefined;
    if (id && id !== 'index' && file.data.astro?.frontmatter) {
      file.data.astro.frontmatter.slug = id;
    }
    // Starlight renders the frontmatter title as the page heading.
    const headingIndex = tree.children.findIndex((c) => c.type === 'heading');
    if (headingIndex !== -1 && tree.children[headingIndex].depth === 1) {
      tree.children.splice(headingIndex, 1);
    }
    walk(tree, (node) => {
      if ((node.type === 'link' || node.type === 'definition') && file.path) {
        node.url = rewriteDocLink(node.url, file.path);
      }
    });
  };
}
