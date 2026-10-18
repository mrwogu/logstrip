import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import sitemap from '@astrojs/sitemap';
import { gitLastModified } from './src/plugins/git-lastmod.mjs';
import { remarkMkdocsCompat } from './src/plugins/remark-mkdocs-compat.mjs';
import { OG_IMAGE, OG_IMAGE_ALT } from './src/seo.ts';
import {
  AUTHOR,
  BASE,
  NPM,
  ORIGIN,
  REPO,
  SIDEBAR,
  SITE_DESCRIPTION,
  stripBase,
  withBase,
} from './src/site.mjs';

const lastModified = gitLastModified();
const ogImage = OG_IMAGE;

export default defineConfig({
  site: ORIGIN,
  base: BASE,
  // site/ is gitignored and uploaded to GitHub Pages by docs.yml
  outDir: '../../site',
  trailingSlash: 'always',
  markdown: {
    processor: unified({ remarkPlugins: [remarkMkdocsCompat] }),
  },
  integrations: [
    // Starlight skips its own sitemap when this one is present.
    sitemap({
      serialize(item) {
        const lastmod = lastModified.get(stripBase(new URL(item.url).pathname));
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
    starlight({
      title: 'LogStrip',
      description: SITE_DESCRIPTION,
      logo: {
        src: './public/assets/images/logo-icon-256.webp',
        alt: 'LogStrip',
      },
      favicon: '/assets/images/favicon.ico',
      social: [
        { icon: 'github', label: 'GitHub', href: REPO },
        { icon: 'npm', label: 'npm', href: NPM },
      ],
      editLink: { baseUrl: `${REPO}/edit/main/apps/docs/` },
      lastUpdated: true,
      // Starlight transforms (asides, heading links) only run on src/content/docs
      // unless told about other directories. Our sources live in docs/.
      markdown: { processedDirs: ['../../docs'] },
      customCss: ['./src/styles/theme.css'],
      components: {
        PageTitle: './src/components/PageTitle.astro',
        Header: './src/components/Header.astro',
        Footer: './src/components/Footer.astro',
      },
      routeMiddleware: './src/route-middleware.ts',
      head: [
        // Snippets: let search engines show full text and large image previews.
        {
          tag: 'meta',
          attrs: {
            name: 'robots',
            content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
          },
        },
        { tag: 'meta', attrs: { name: 'author', content: AUTHOR.name } },
        { tag: 'link', attrs: { rel: 'author', href: AUTHOR.github } },
        {
          tag: 'meta',
          attrs: { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#161818' },
        },
        {
          tag: 'meta',
          attrs: { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#ffffff' },
        },
        { tag: 'meta', attrs: { property: 'og:image', content: ogImage } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        {
          tag: 'meta',
          attrs: { property: 'og:image:type', content: 'image/png' },
        },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: OG_IMAGE_ALT } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: ogImage } },
        { tag: 'meta', attrs: { name: 'twitter:image:alt', content: OG_IMAGE_ALT } },
        // Icons for iOS home screens and Android, next to the favicon Starlight sets.
        {
          tag: 'link',
          attrs: {
            rel: 'apple-touch-icon',
            sizes: '256x256',
            href: withBase('/assets/images/logo-icon-256.png'),
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'icon',
            type: 'image/png',
            sizes: '64x64',
            href: withBase('/assets/images/favicon-64.png'),
          },
        },
        // The whole documentation as Markdown, for agents and answer engines.
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'text/plain',
            title: 'llms.txt',
            href: withBase('/llms.txt'),
          },
        },
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossorigin: '',
          },
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
