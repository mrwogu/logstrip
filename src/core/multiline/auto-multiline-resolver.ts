import type { MultilineMode } from './multiline-buffer.js';

const SOURCE_TO_MULTILINE: Record<string, MultilineMode> = {
  pytest: 'python',
  django: 'python',
  flask: 'python',
  celery: 'python',
  aiohttp: 'python',
  sanic: 'python',
  tornado: 'python',
  structlog: 'python',
  loguru: 'python',
  ruff: 'python',
  mypy: 'python',
  pyright: 'python',
  pylint: 'python',
  sphinx: 'python',
  jest: 'node',
  vitest: 'node',
  mocha: 'node',
  cypress: 'node',
  express: 'node',
  fastify: 'node',
  nestjs: 'node',
  nextjs: 'node',
  pino: 'node',
  winston: 'node',
  bunyan: 'node',
  maven: 'java',
  gradle: 'java',
  'spring-boot': 'java',
  junit: 'java',
  logback: 'java',
  log4j: 'java',
  tomcat: 'java',
  jetty: 'java',
  'go-test': 'go',
  'go-build': 'go',
  'go-fmt': 'go',
  cargo: 'rust',
  rustc: 'rust',
};

/**
 * Resolve the best multiline mode from detected log sources.
 * Returns the mode matching the first recognized source, or 'off' if none match.
 */
export function resolveAutoMultiline(
  detectedSources: readonly string[],
): Exclude<MultilineMode, 'auto-source'> {
  for (const src of detectedSources) {
    const mode = SOURCE_TO_MULTILINE[src];
    if (mode !== undefined) {
      return mode as Exclude<MultilineMode, 'auto-source'>;
    }
  }
  return 'off';
}

/**
 * Compute the effective multiline mode given the requested mode and
 * the current set of detected sources (updated continuously during streaming).
 */
export function effectiveMultilineMode(
  requested: MultilineMode,
  detectedSources: readonly string[],
): Exclude<MultilineMode, 'auto-source'> {
  if (requested !== 'auto-source') {
    return requested as Exclude<MultilineMode, 'auto-source'>;
  }

  return resolveAutoMultiline(detectedSources);
}
