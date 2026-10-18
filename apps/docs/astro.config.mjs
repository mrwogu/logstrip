import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import sitemap from '@astrojs/sitemap';
import { remarkMkdocsCompat } from './src/plugins/remark-mkdocs-compat.mjs';
import { BASE, ORIGIN, REPO, SIDEBAR } from './src/site.mjs';

export default defineConfig({
  site: ORIGIN,
  base: BASE,
  // site/ is gitignored and uploaded to GitHub Pages by docs.yml
  outDir: '../../site',
  trailingSlash: 'ignore',
  markdown: {
    processor: unified({ remarkPlugins: [remarkMkdocsCompat] }),
  },
  integrations: [
    // Starlight skips its own sitemap when this one is present.
    sitemap(),
    starlight({
      title: 'LogStrip',
      description:
        'Free, zero-dependency CLI that compresses noisy logs into high-signal AI context. 705+ detected ecosystems, stream-safe, deterministic output.',
      logo: { src: './public/assets/images/logo-icon-256.webp', alt: 'LogStrip' },
      favicon: '/assets/images/favicon.ico',
      social: [
        { icon: 'github', label: 'GitHub', href: REPO },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/logstrip' },
      ],
      editLink: { baseUrl: `${REPO}/edit/main/apps/docs/` },
      lastUpdated: true,
      // Starlight transforms (asides, heading links) only run on src/content/docs
      // unless told about other directories. Our sources live in docs/.
      markdown: { processedDirs: ['../../docs'] },
      customCss: ['./src/styles/theme.css'],
      head: [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap',
          },
        },
      ],
      plugins: [starlightLinksValidator({ errorOnLocalLinks: false })],
      sidebar: SIDEBAR,
    }),
  ],
});
