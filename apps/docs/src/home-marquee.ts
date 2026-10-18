// The sources marquee on the landing page: three rows of tool pills that
// scroll sideways. Built at build time, so it needs no JavaScript.
import { escapeHtml } from './html';

export const ECOSYSTEM_PILLS = [
  'Trivy',
  'Snyk',
  'Semgrep',
  'nginx',
  'PostgreSQL',
  'Redis',
  'AWS Lambda',
  'Datadog',
  'Sentry',
  'Docker',
  'Kubernetes',
  'Terraform',
  'Kafka',
  'Elasticsearch',
  'OpenTelemetry',
  'Prometheus',
  'Grafana',
  'GitHub Actions',
  'GitLab CI',
  'Cloudflare',
  'Spring Boot',
  'Django',
  'Express',
  'Next.js',
  'Jenkins',
  'Helm',
  'MongoDB',
  'Vitest',
  'Jest',
  'Pytest',
  'Playwright',
  'npm',
  'Cargo',
  'Gradle',
  'Webpack',
  'Fastify',
  'NestJS',
  'React Native',
  'Flutter',
  'Vercel',
  'Argo',
  'Go test',
  'pnpm',
  'Cypress',
  'Bun',
  'Maven',
  'Electron',
  'Bazel',
  'Tekton',
  'yarn',
];

export interface MarqueeRow {
  pills: string[];
  reverse: boolean;
  seconds: number;
}

/** Splits the pills into three rows. The middle row runs the other way. */
export function marqueeRows(pills: readonly string[]): MarqueeRow[] {
  const perRow = Math.ceil(pills.length / 3);
  return [
    { pills: pills.slice(0, perRow), reverse: false, seconds: 50 },
    { pills: pills.slice(perRow, perRow * 2), reverse: true, seconds: 58 },
    { pills: pills.slice(perRow * 2), reverse: false, seconds: 46 },
  ].filter((row) => row.pills.length > 0);
}

/**
 * Row markup. Each track holds its pills twice so the loop has no gap. The
 * second copy is marked, so reduced-motion styles can hide it and show one
 * static, wrapped list instead.
 */
export function marqueeHtml(pills: readonly string[]): string {
  const pill = (name: string, copy: boolean): string =>
    `<span class="hp-pill${copy ? ' hp-pill--copy' : ''}">${escapeHtml(name)}</span>`;
  return marqueeRows(pills)
    .map((row) => {
      const items = [
        ...row.pills.map((name) => pill(name, false)),
        ...row.pills.map((name) => pill(name, true)),
      ].join('');
      const modifier = row.reverse ? ' hp-marquee__row--reverse' : '';
      return (
        `<div class="hp-marquee__row${modifier}" aria-hidden="true">` +
        `<div class="hp-marquee__track" style="animation-duration: ${row.seconds}s">${items}</div>` +
        '</div>'
      );
    })
    .join('');
}
