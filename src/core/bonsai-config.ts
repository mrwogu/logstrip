import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface BonsaiSourceSignature {
  name: string;
  markers: readonly string[];
}

export interface BonsaiCustomConfig {
  sources: readonly BonsaiSourceSignature[];
  diagnosticPatterns: readonly string[];
  ignorePatterns: readonly string[];
  sanitizePatterns: readonly SanitizeRule[];
  internalStackPatterns: readonly string[];
}

export interface SanitizeRule {
  pattern: string;
  replacement: string;
  flags?: string;
}

const CONFIG_FILENAME = '.bonsai.yml';

const EMPTY_CONFIG: BonsaiCustomConfig = {
  sources: [],
  diagnosticPatterns: [],
  ignorePatterns: [],
  sanitizePatterns: [],
  internalStackPatterns: [],
};

export function parseBonsaiConfig(content: string): BonsaiCustomConfig {
  const parsed = parseMinimalYaml(content);
  return normalizeConfig(parsed);
}

export function loadBonsaiConfig(
  explicitPath?: string,
  startDir?: string,
): BonsaiCustomConfig {
  const configPath = resolveConfigPath(explicitPath, startDir);
  if (configPath === undefined) return EMPTY_CONFIG;

  const content = readFileSync(configPath, 'utf8');
  return parseBonsaiConfig(content);
}

export function resolveConfigPath(
  explicitPath?: string,
  startDir?: string,
): string | undefined {
  if (explicitPath !== undefined) {
    if (!existsSync(explicitPath)) return undefined;
    return explicitPath;
  }

  const dir = startDir ?? process.cwd();
  const candidate = path.join(dir, CONFIG_FILENAME);
  if (existsSync(candidate)) return candidate;

  return undefined;
}

function normalizeConfig(raw: Record<string, unknown>): BonsaiCustomConfig {
  return {
    sources: normalizeSources(raw.sources),
    diagnosticPatterns: normalizeStringArray(raw.diagnosticPatterns),
    ignorePatterns: normalizeStringArray(raw.ignorePatterns),
    sanitizePatterns: normalizeSanitizeRules(raw.sanitizePatterns),
    internalStackPatterns: normalizeStringArray(raw.internalStackPatterns),
  };
}

function normalizeSources(
  raw: unknown,
): readonly BonsaiSourceSignature[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null,
    )
    .map((entry) => ({
      name: String(entry.name ?? ''),
      markers: normalizeStringArray(entry.markers),
    }))
    .filter((entry) => entry.name !== '' && entry.markers.length > 0);
}

function normalizeStringArray(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

function normalizeSanitizeRules(
  raw: unknown,
): readonly SanitizeRule[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null,
    )
    .map((entry) => {
      const flagsRaw = entry.flags;
      const flags = flagsRaw !== undefined ? String(flagsRaw) : undefined;
      return {
        pattern: String(entry.pattern ?? ''),
        replacement: String(entry.replacement ?? ''),
        flags,
      };
    })
    .filter((entry) => entry.pattern !== '');
}

function parseMinimalYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split(/\r?\n/u);

  // State machine: track which block we are building
  let topKey = '';
  let topValue: unknown = null;
  // For array-of-objects (like sources:)
  let objList: Record<string, unknown>[] | null = null;
  let currentObj: Record<string, unknown> | null = null;
  // For plain arrays (like diagnosticPatterns:)
  let scalarList: unknown[] | null = null;
  // For sub-array inside currentObj (like markers: inside a source)
  let subArrayKey = '';
  let subArray: unknown[] | null = null;

  const flushTop = (): void => {
    if (topKey === '') return;
    // Flush any pending sub-array into the current object
    if (subArrayKey !== '' && subArray !== null && currentObj !== null) {
      currentObj[subArrayKey] = subArray;
    }
    if (objList !== null) {
      result[topKey] = objList;
    } else if (scalarList !== null) {
      result[topKey] = scalarList;
    } else if (topValue !== null) {
      result[topKey] = topValue;
    }
    topKey = '';
    topValue = null;
    objList = null;
    currentObj = null;
    scalarList = null;
    subArrayKey = '';
    subArray = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/u, '').trimEnd();
    if (line.trim().length === 0) continue;

    const indent = rawLine.match(/^(\s*)/u)![1].length;

    // ── Top-level key ──
    const topMatch = line.match(/^([\w-]+):\s*(.*)$/u);
    if (topMatch && indent === 0) {
      flushTop();
      topKey = topMatch[1];
      const inlineVal = topMatch[2].trim();
      if (inlineVal !== '') {
        topValue = parseYamlValue(inlineVal);
      }
      continue;
    }

    // ── Array item: "- value" or "- name: foo" at indent 2 ──
    const arrMatch = line.match(/^(\s{2})-\s+(.*)$/u);
    if (arrMatch) {
      const rest = arrMatch[2];
      // Is this "- name: value" (object in array)?
      const objPropMatch = rest.match(/^([\w-]+):\s*(.*)$/u);
      if (objPropMatch) {
        // Flush sub-array if we were building one
        if (subArrayKey !== '' && subArray !== null && currentObj !== null) {
          currentObj[subArrayKey] = subArray;
          subArrayKey = '';
          subArray = null;
        }
        // Start a new object in the array
        if (objList === null) objList = [];
        currentObj = { [objPropMatch[1]]: parseYamlValue(objPropMatch[2]) };
        objList.push(currentObj);
      } else {
        // Plain scalar array item
        if (scalarList === null) scalarList = [];
        scalarList.push(parseYamlValue(rest));
      }
      continue;
    }

    // ── Sub-array item: "    - value" at indent 4+ ──
    const subArrMatch = line.match(/^(\s{4,})-\s+(.*)$/u);
    if (subArrMatch && currentObj !== null) {
      if (subArray === null) subArray = [];
      subArray.push(parseYamlValue(subArrMatch[2]));
      continue;
    }

    // ── Property inside currentObj: "    key: value" at indent 4+ ──
    const propMatch = line.match(/^(\s{4,})([\w-]+):\s*(.*)$/u);
    if (propMatch && currentObj !== null) {
      // Flush previous sub-array
      if (subArrayKey !== '') {
        if (subArray !== null) {
          currentObj[subArrayKey] = subArray;
        }
      }
      const propKey = propMatch[2];
      const propVal = propMatch[3].trim();
      if (propVal === '') {
        // Property with no inline value → next lines will be sub-array
        subArrayKey = propKey;
        subArray = null;
      } else {
        currentObj[propKey] = parseYamlValue(propVal);
        subArrayKey = '';
        subArray = null;
      }
      continue;
    }
  }

  // Flush final state
  if (subArrayKey !== '' && subArray !== null && currentObj !== null) {
    currentObj[subArrayKey] = subArray;
  }
  flushTop();

  return result;
}

function parseYamlValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;

  // Quoted string
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    const inner = value.slice(1, -1);
    // Double-quoted YAML strings unescape \\ → \ and \" → "
    if (value.startsWith('"')) {
      return inner.replace(/\\\\/gu, '\\').replace(/\\"/gu, '"');
    }
    return inner;
  }

  // Inline array: [a, b, c]
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];
    return splitInlineArray(inner).map((s) => parseYamlValue(s.trim()));
  }

  // Number
  if (/^-?\d+(\.\d+)?$/u.test(value)) {
    return Number(value);
  }

  return value;
}

function splitInlineArray(inner: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let depth = 0;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inQuote !== null) {
      current += ch;
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
    } else if (ch === '[') {
      depth++;
      current += ch;
    } else if (ch === ']') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim() !== '') result.push(current);
  return result;
}
