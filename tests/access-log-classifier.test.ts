import { describe, expect, it } from 'vitest';
import {
  extractHttpStatusFromLine,
  isAccessLogLine,
  isAccessLogNoiseLine,
  matchAccessLogLine,
} from '../src/core/formats/access-log-classifier';

function nginxAccessLog(
  method: string,
  path: string,
  status: number,
  ua = 'Mozilla/5.0',
): string {
  return `10.40.1.10 - - [16/May/2026:10:12:01 +0000] "${method} ${path} HTTP/1.1" ${status} 1234 "https://example.com" "${ua}" request_id=abc123 upstream=-`;
}

describe('access-log-classifier', () => {
  describe('isAccessLogLine', () => {
    it('recognizes common log format lines', () => {
      expect(
        isAccessLogLine(
          nginxAccessLog('GET', '/api/cart', 200),
        ),
      ).toBe(true);
    });

    it('returns false for non-access-log lines', () => {
      expect(isAccessLogLine('[ERROR] Something failed')).toBe(false);
      expect(isAccessLogLine('')).toBe(false);
      expect(isAccessLogLine('2026/05/16 10:12:04 [error] connect() failed')).toBe(false);
    });

    it('recognizes all common HTTP methods', () => {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'CONNECT', 'TRACE']) {
        expect(
          isAccessLogLine(nginxAccessLog(method, '/api/test', 200)),
        ).toBe(true);
      }
    });
  });

  describe('matchAccessLogLine', () => {
    it('extracts path, status and user-agent', () => {
      const result = matchAccessLogLine(
        nginxAccessLog('GET', '/api/cart', 200, 'CustomBot/1.0'),
      );
      expect(result).toEqual({
        path: '/api/cart',
        status: 200,
        userAgent: 'CustomBot/1.0',
      });
    });

    it('returns null for non-access-log lines', () => {
      expect(matchAccessLogLine('not a log line')).toBeNull();
    });
  });

  describe('isAccessLogNoiseLine', () => {
    it('returns false for non-access-log lines', () => {
      expect(isAccessLogNoiseLine('[ERROR] Something failed')).toBe(false);
    });

    it('returns false for HTTP 5xx lines (server errors are diagnostic)', () => {
      expect(
        isAccessLogNoiseLine(nginxAccessLog('POST', '/api/checkout', 502)),
      ).toBe(false);
      expect(
        isAccessLogNoiseLine(nginxAccessLog('GET', '/api/data', 500)),
      ).toBe(false);
    });

    it('returns false for HTTP 4xx lines (client errors are diagnostic)', () => {
      expect(
        isAccessLogNoiseLine(nginxAccessLog('GET', '/api/user', 404)),
      ).toBe(false);
      expect(
        isAccessLogNoiseLine(nginxAccessLog('POST', '/login', 403)),
      ).toBe(false);
    });

    it('drops health check paths', () => {
      for (const path of ['/healthz', '/readyz', '/livez', '/health', '/ping', '/status', '/up']) {
        expect(isAccessLogNoiseLine(nginxAccessLog('GET', path, 200))).toBe(true);
      }
    });

    it('drops metrics paths', () => {
      expect(
        isAccessLogNoiseLine(nginxAccessLog('GET', '/metrics', 200)),
      ).toBe(true);
      expect(
        isAccessLogNoiseLine(nginxAccessLog('GET', '/metricz', 200)),
      ).toBe(true);
    });

    it('drops static asset paths', () => {
      for (const ext of ['css', 'js', 'mjs', 'cjs', 'svg', 'ico', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'woff', 'woff2', 'ttf', 'eot', 'otf', 'map', 'txt', 'xml', 'webmanifest', 'wasm']) {
        expect(
          isAccessLogNoiseLine(nginxAccessLog('GET', `/static/app.${ext}`, 200)),
        ).toBe(true);
      }
    });

    it('drops static assets with query strings', () => {
      expect(
        isAccessLogNoiseLine(nginxAccessLog('GET', '/bundle.js?v=123', 200)),
      ).toBe(true);
    });

    it('drops favicon.ico and robots.txt', () => {
      expect(
        isAccessLogNoiseLine(nginxAccessLog('GET', '/favicon.ico', 200)),
      ).toBe(true);
      expect(
        isAccessLogNoiseLine(nginxAccessLog('GET', '/robots.txt', 200)),
      ).toBe(true);
    });

    it('drops kube-probe user-agent lines', () => {
      expect(
        isAccessLogNoiseLine(
          nginxAccessLog('GET', '/api/data', 200, 'kube-probe/1.30'),
        ),
      ).toBe(true);
    });

    it('drops ELB-HealthChecker user-agent lines', () => {
      expect(
        isAccessLogNoiseLine(
          nginxAccessLog('GET', '/api/data', 200, 'ELB-HealthChecker/2.0'),
        ),
      ).toBe(true);
    });

    it('drops GoogleHC user-agent lines', () => {
      expect(
        isAccessLogNoiseLine(
          nginxAccessLog('GET', '/api/data', 200, 'GoogleHC/1.0'),
        ),
      ).toBe(true);
    });

    it('drops node-fetch user-agent lines', () => {
      expect(
        isAccessLogNoiseLine(
          nginxAccessLog('GET', '/api/data', 200, 'node-fetch/1.0'),
        ),
      ).toBe(true);
    });

    it('drops Go-http-client user-agent lines', () => {
      expect(
        isAccessLogNoiseLine(
          nginxAccessLog('GET', '/api/data', 200, 'Go-http-client/2.0'),
        ),
      ).toBe(true);
    });

    it('drops curl user-agent lines', () => {
      expect(
        isAccessLogNoiseLine(
          nginxAccessLog('GET', '/api/data', 200, 'curl/7.88.1'),
        ),
      ).toBe(true);
    });

    it('drops wget user-agent lines', () => {
      expect(
        isAccessLogNoiseLine(
          nginxAccessLog('GET', '/api/data', 200, 'Wget/1.21'),
        ),
      ).toBe(true);
    });

    it('drops Prometheus user-agent lines even on non-metrics paths', () => {
      expect(
        isAccessLogNoiseLine(
          nginxAccessLog('GET', '/api/cart', 200, 'Prometheus/2.52.0'),
        ),
      ).toBe(true);
    });

    it('does not drop regular API traffic with browser UAs', () => {
      expect(
        isAccessLogNoiseLine(nginxAccessLog('GET', '/api/cart', 200)),
      ).toBe(false);
      expect(
        isAccessLogNoiseLine(nginxAccessLog('POST', '/api/checkout', 200)),
      ).toBe(false);
    });

    it('does not drop health check paths with 5xx status', () => {
      expect(
        isAccessLogNoiseLine(nginxAccessLog('GET', '/healthz', 500)),
      ).toBe(false);
    });
  });

  describe('extractHttpStatusFromLine', () => {
    it('extracts the HTTP status code from access log lines', () => {
      expect(
        extractHttpStatusFromLine(nginxAccessLog('GET', '/api/cart', 200)),
      ).toBe(200);
      expect(
        extractHttpStatusFromLine(nginxAccessLog('POST', '/api/checkout', 502)),
      ).toBe(502);
      expect(
        extractHttpStatusFromLine(nginxAccessLog('GET', '/missing', 404)),
      ).toBe(404);
    });

    it('returns 0 for non-access-log lines', () => {
      expect(extractHttpStatusFromLine('not a log line')).toBe(0);
    });
  });
});
