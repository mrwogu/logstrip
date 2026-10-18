"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAutoMultiline = resolveAutoMultiline;
exports.effectiveMultilineMode = effectiveMultilineMode;
const SOURCE_TO_MULTILINE = {
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
function resolveAutoMultiline(detectedSources) {
    for (const src of detectedSources) {
        const mode = SOURCE_TO_MULTILINE[src];
        if (mode !== undefined) {
            return mode;
        }
    }
    return 'off';
}
/**
 * Compute the effective multiline mode given the requested mode and
 * the current set of detected sources (updated continuously during streaming).
 */
function effectiveMultilineMode(requested, detectedSources) {
    if (requested !== 'auto-source') {
        return requested;
    }
    return resolveAutoMultiline(detectedSources);
}
