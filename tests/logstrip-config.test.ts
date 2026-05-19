import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadLogStripConfig,
  parseLogStripConfig,
  resolveConfigPath,
  type LogStripCustomConfig,
} from '../src/core/logstrip-config';

const VALID_CONFIG_YAML = `# LogStrip custom config for Acme Corp
sources:
  - name: acme-gateway
    markers:
      - acme-gateway
      - "[ACME-GW]"
  - name: acme-auth
    markers:
      - acme-auth-service
      - "[ACME-AUTH]"

diagnosticPatterns:
  - "ACME_ERROR_\\\\d+"
  - "\\\\bACME-FATAL\\\\b"

ignorePatterns:
  - "\\\\bACME-HEARTBEAT\\\\b"
  - "\\\\bacme-metrics\\\\b"

sanitizePatterns:
  - pattern: "\\\\bACME-USER-\\\\d+\\\\b"
    replacement: "[ACME-USER]"
  - pattern: "acme-tenant/[a-z0-9-]+"
    replacement: "acme-tenant/[ID]"

internalStackPatterns:
  - "/opt/acme/lib/"
`;

const MINIMAL_CONFIG_YAML = `sources:
  - name: internal-tool
    markers: [internal-tool, "[INTL]"]
`;

describe('logstrip-config', () => {
  describe('parseLogStripConfig', () => {
    it('parses a full config with all sections', () => {
      const config = parseLogStripConfig(VALID_CONFIG_YAML);

      expect(config.sources).toHaveLength(2);
      expect(config.sources[0].name).toBe('acme-gateway');
      expect(config.sources[0].markers).toEqual([
        'acme-gateway',
        '[ACME-GW]',
      ]);
      expect(config.sources[1].name).toBe('acme-auth');

      expect(config.diagnosticPatterns).toHaveLength(2);
      expect(config.ignorePatterns).toHaveLength(2);
      expect(config.sanitizePatterns).toHaveLength(2);
      expect(config.sanitizePatterns[0].pattern).toBe(
        '\\bACME-USER-\\d+\\b',
      );
      expect(config.sanitizePatterns[0].replacement).toBe('[ACME-USER]');
      expect(config.internalStackPatterns).toHaveLength(1);
    });

    it('parses a minimal config with inline markers array', () => {
      const config = parseLogStripConfig(MINIMAL_CONFIG_YAML);

      expect(config.sources).toHaveLength(1);
      expect(config.sources[0].name).toBe('internal-tool');
      expect(config.sources[0].markers).toEqual([
        'internal-tool',
        '[INTL]',
      ]);
    });

    it('returns empty config for empty input', () => {
      const config = parseLogStripConfig('');

      expect(config.sources).toHaveLength(0);
      expect(config.diagnosticPatterns).toHaveLength(0);
    });

    it('returns empty config for YAML with no recognized keys', () => {
      const config = parseLogStripConfig('unknownKey:\n  - foo\n');

      expect(config.sources).toHaveLength(0);
    });

    it('ignores sources with no markers', () => {
      const yaml = `sources:
  - name: empty-source
    markers: []
`;
      const config = parseLogStripConfig(yaml);

      expect(config.sources).toHaveLength(0);
    });

    it('ignores sources with no name', () => {
      const yaml = `sources:
  - markers:
      - some-marker
`;
      const config = parseLogStripConfig(yaml);

      expect(config.sources).toHaveLength(0);
    });

    it('ignores sanitize rules with no pattern', () => {
      const yaml = `sanitizePatterns:
  - replacement: "[REDACTED]"
`;
      const config = parseLogStripConfig(yaml);

      expect(config.sanitizePatterns).toHaveLength(0);
    });

    it('handles sanitize rules with missing replacement', () => {
      const yaml = `sanitizePatterns:
  - pattern: "secret-\\\\d+"
`;
      const config = parseLogStripConfig(yaml);

      expect(config.sanitizePatterns).toHaveLength(1);
      expect(config.sanitizePatterns[0].pattern).toBe('secret-\\d+');
      expect(config.sanitizePatterns[0].replacement).toBe('');
    });

    it('parses sanitize rules with flags', () => {
      const yaml = `sanitizePatterns:
  - pattern: "foo"
    replacement: "bar"
    flags: "gi"
`;
      const config = parseLogStripConfig(yaml);

      expect(config.sanitizePatterns[0].flags).toBe('gi');
    });

    it('parses sanitize rules without flags (undefined)', () => {
      const yaml = `sanitizePatterns:
  - pattern: "baz"
    replacement: "qux"
`;
      const config = parseLogStripConfig(yaml);

      expect(config.sanitizePatterns[0].flags).toBeUndefined();
    });
  });

  describe('resolveConfigPath', () => {
    it('returns explicit path when file exists', () => {
      const dir = join(tmpdir(), 'logstrip-config-test-explicit');
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, '.logstrip.yml');
      writeFileSync(filePath, 'sources: []\n', 'utf8');

      const result = resolveConfigPath(filePath);
      expect(result).toBe(filePath);
    });

    it('returns undefined when explicit path does not exist', () => {
      const result = resolveConfigPath('/nonexistent/.logstrip.yml');
      expect(result).toBeUndefined();
    });

    it('auto-detects .logstrip.yml in startDir', () => {
      const dir = join(tmpdir(), 'logstrip-config-test-autodetect');
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, '.logstrip.yml');
      writeFileSync(filePath, 'sources: []\n', 'utf8');

      const result = resolveConfigPath(undefined, dir);
      expect(result).toBe(filePath);
    });

    it('returns undefined when no config found', () => {
      const dir = join(tmpdir(), 'logstrip-config-test-nocfg');
      mkdirSync(dir, { recursive: true });

      const result = resolveConfigPath(undefined, dir);
      expect(result).toBeUndefined();
    });
  });

  describe('loadLogStripConfig', () => {
    it('loads and parses a config file', () => {
      const dir = join(tmpdir(), 'logstrip-config-test-load');
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, '.logstrip.yml');
      writeFileSync(filePath, MINIMAL_CONFIG_YAML, 'utf8');

      const config = loadLogStripConfig(filePath);
      expect(config.sources).toHaveLength(1);
      expect(config.sources[0].name).toBe('internal-tool');
    });

    it('returns empty config when no path resolves', () => {
      const config = loadLogStripConfig('/nonexistent/.logstrip.yml');
      expect(config.sources).toHaveLength(0);
    });

    it('loads config from auto-detected startDir', () => {
      const dir = join(tmpdir(), 'logstrip-config-test-autodetect-load');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, '.logstrip.yml'), MINIMAL_CONFIG_YAML, 'utf8');

      const config = loadLogStripConfig(undefined, dir);
      expect(config.sources).toHaveLength(1);
      expect(config.sources[0].name).toBe('internal-tool');
    });
  });

  describe('parseMinimalYaml edge cases', () => {
    it('parses inline top-level value', () => {
      const yaml = `version: 2
`;
      const config = parseLogStripConfig(yaml);
      // version is not a recognized config key but parseMinimalYaml should handle it
      expect(config.sources).toHaveLength(0);
    });

    it('parses empty inline array', () => {
      const yaml = `sources:
  - name: test
    markers: []
`;
      const config = parseLogStripConfig(yaml);
      // markers is empty → source is filtered out
      expect(config.sources).toHaveLength(0);
    });

    it('parses inline array with quoted items', () => {
      const yaml = `ignorePatterns: ["foo", 'bar']
`;
      const config = parseLogStripConfig(yaml);
      expect(config.ignorePatterns).toEqual(['foo', 'bar']);
    });

    it('parses nested array with multiple properties per object', () => {
      const yaml = `sanitizePatterns:
  - pattern: "foo\\\\d+"
    replacement: "[NUM]"
    flags: "gi"
  - pattern: "bar"
    replacement: "baz"
`;
      const config = parseLogStripConfig(yaml);
      expect(config.sanitizePatterns).toHaveLength(2);
      expect(config.sanitizePatterns[0].flags).toBe('gi');
      expect(config.sanitizePatterns[1].replacement).toBe('baz');
    });

    it('parses boolean and null values', () => {
      const yaml = `diagnosticPatterns:
  - "true"
  - "false"
  - "null"
`;
      const config = parseLogStripConfig(yaml);
      expect(config.diagnosticPatterns).toEqual(['true', 'false', 'null']);
    });

    it('parses unquoted boolean and null values', () => {
      const yaml = `topKey: true
otherKey: false
nullKey: null
tildeKey: ~
`;
      const config = parseLogStripConfig(yaml);
      // These are not config keys but the parser should handle them
      expect(config.sources).toHaveLength(0);
    });

    it('parses inline top-level value', () => {
      const yaml = `someKey: someValue
`;
      const config = parseLogStripConfig(yaml);
      expect(config.sources).toHaveLength(0);
    });

    it('handles inline array with nested brackets', () => {
      const yaml = `ignorePatterns: ["a[b,c]", "d"]
`;
      const config = parseLogStripConfig(yaml);
      expect(config.ignorePatterns).toEqual(['a[b,c]', 'd']);
    });

    it('handles object with multiple sub-arrays', () => {
      const yaml = `sanitizePatterns:
  - pattern: "foo\\\\d+"
    replacement: "[NUM]"
    markers:
      - m1
    flags: "gi"
`;
      const config = parseLogStripConfig(yaml);
      expect(config.sanitizePatterns).toHaveLength(1);
      expect(config.sanitizePatterns[0].flags).toBe('gi');
    });

    it('handles property after empty sub-array key', () => {
      // After "markers:" with no items, next property should flush the empty sub-array
      const yaml = `sanitizePatterns:
  - pattern: "abc"
    replacement: "def"
    emptyProp:
    otherProp: "ghi"
`;
      const config = parseLogStripConfig(yaml);
      expect(config.sanitizePatterns).toHaveLength(1);
      expect(config.sanitizePatterns[0].replacement).toBe('def');
    });

    it('skips indented property line not inside an array object', () => {
      // A line at indent 4+ matching "key: value" but with no currentObj should be ignored
      const yaml = `diagnosticPatterns:
    orphanKey: someValue
  - "valid-pattern"
`;
      const config = parseLogStripConfig(yaml);
      expect(config.diagnosticPatterns).toEqual(['valid-pattern']);
    });

    it('parses YAML ending without trailing newline', () => {
      const yaml = `sources:
  - name: test
    markers:
      - m1`;
      const config = parseLogStripConfig(yaml);
      expect(config.sources).toHaveLength(1);
      expect(config.sources[0].markers).toEqual(['m1']);
    });

    it('handles single-quoted strings preserving backslashes', () => {
      const yaml = `diagnosticPatterns:
  - '\\bFOO\\b'
`;
      const config = parseLogStripConfig(yaml);
      expect(config.diagnosticPatterns).toEqual(['\\bFOO\\b']);
    });

    it('handles trailing comma in inline array', () => {
      const yaml = `ignorePatterns: [a, b,]
`;
      const config = parseLogStripConfig(yaml);
      // Trailing comma creates empty string entry which is still a string
      expect(config.ignorePatterns.length).toBeGreaterThanOrEqual(2);
    });

    it('handles inline array with nested brackets inside', () => {
      // Unquoted nested brackets: [a[b,c], d] — depth tracking needed
      const yaml = `diagnosticPatterns: [a[b,c], d]
`;
      const config = parseLogStripConfig(yaml);
      expect(config.diagnosticPatterns.length).toBe(2);
    });
  });
});
