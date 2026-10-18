"use strict";
// Detects common/combined access log format lines and classifies them
// as noise (health checks, static assets, metrics) or signal (error status codes).
//
// Matches formats from nginx, Apache httpd, Caddy, Varnish, Traefik, HAProxy and similar.
// Format: <remote> - <user> [<time>] "<method> <path> HTTP/<ver>" <status> <size> "<ref>" "<ua>" [extra...]
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchAccessLogLine = matchAccessLogLine;
exports.isAccessLogLine = isAccessLogLine;
exports.isAccessLogNoiseLine = isAccessLogNoiseLine;
exports.extractHttpStatusFromLine = extractHttpStatusFromLine;
const ACCESS_LOG_LINE_PATTERN = /^\S+\s+\S+\s+\S+\s+\[.+\]\s+"(?:GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|CONNECT|TRACE)\s+(\S+)\s+HTTP\/\d\.\d"\s+(\d{3})\b/iu;
const ACCESS_LOG_FULL_PATTERN = /^\S+\s+\S+\s+\S+\s+\[.+\]\s+"(?:GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|CONNECT|TRACE)\s+(\S+)\s+HTTP\/\d\.\d"\s+(\d{3})\s+\d+\s+"[^"]*"\s+"([^"]*)"/iu;
// ---- Noise classification patterns ----
const HEALTH_PATH_PATTERN = /\/(?:healthz|readyz|livez|health|ping|status|up)$/iu;
const METRICS_PATH_PATTERN = /\/(?:metrics|metricz)$/iu;
const STATIC_ASSET_PATH_PATTERN = /\.(?:css|js|mjs|cjs|svg|ico|png|jpe?g|gif|webp|woff2?|ttf|eot|otf|map|txt|xml|json|webmanifest|wasm)(?:\?.*)?$/iu;
const ROBOTS_FAVICON_PATH_PATTERN = /\/(?:favicon\.ico|robots\.txt)$/iu;
const KUBE_PROBE_UA_PATTERN = /\bkube-probe\b/iu;
const PROMETHEUS_UA_PATTERN = /\bPrometheus\b/iu;
const INTERNAL_HEALTH_UA_PATTERN = /\b(?:ELB-HealthChecker|GoogleHC|kube-probe|node-fetch|Go-http-client|curl|wget)\b/iu;
function matchAccessLogLine(line) {
    const match = line.match(ACCESS_LOG_FULL_PATTERN);
    if (match === null)
        return null;
    return {
        path: match[1],
        status: parseInt(match[2], 10),
        userAgent: match[3],
    };
}
function isAccessLogLine(line) {
    return ACCESS_LOG_LINE_PATTERN.test(line);
}
function isAccessLogNoiseLine(line) {
    const matched = matchAccessLogLine(line);
    if (matched === null)
        return false;
    // HTTP 5xx are always diagnostic — never treat as noise
    if (matched.status >= 500)
        return false;
    // HTTP 4xx indicate client problems — keep as signal
    if (matched.status >= 400)
        return false;
    // 2xx/3xx on noise endpoints
    if (HEALTH_PATH_PATTERN.test(matched.path))
        return true;
    if (METRICS_PATH_PATTERN.test(matched.path))
        return true;
    if (ROBOTS_FAVICON_PATH_PATTERN.test(matched.path))
        return true;
    if (STATIC_ASSET_PATH_PATTERN.test(matched.path))
        return true;
    // Kube-probe or other health-check user agents
    if (KUBE_PROBE_UA_PATTERN.test(matched.userAgent))
        return true;
    if (INTERNAL_HEALTH_UA_PATTERN.test(matched.userAgent))
        return true;
    // Prometheus scraping UA (path already handled above)
    if (PROMETHEUS_UA_PATTERN.test(matched.userAgent))
        return true;
    return false;
}
function extractHttpStatusFromLine(line) {
    const match = line.match(ACCESS_LOG_LINE_PATTERN);
    if (match === null)
        return 0;
    return parseInt(match[2], 10);
}
