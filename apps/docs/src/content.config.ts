import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { docIdFromEntry } from './plugins/remark-mkdocs-compat.mjs';
import { DOCS_BASE } from './site.mjs';

// Markdown sources stay in the repo-level docs/ folder, next to the code.
export const collections = {
  docs: defineCollection({
    loader: glob({
      base: DOCS_BASE,
      pattern: ['**/*.md', '!index.md'],
      generateId: ({ entry }) => docIdFromEntry(entry),
    }),
    schema: docsSchema(),
  }),
};
