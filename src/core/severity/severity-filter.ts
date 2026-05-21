export type SeverityLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  fatal: 5, error: 4, warn: 3, info: 2, debug: 1, trace: 0,
};

const SEVERITY_PATTERNS: Array<{ level: SeverityLevel; regex: RegExp }> = [
  { level: 'fatal', regex: /\[FATAL\]|"level"\s*:\s*"fatal"|Severity:\s*FATAL|\bFATAL\b/iu },
  { level: 'error', regex: /\[ERROR\]|"level"\s*:\s*"error"|Severity:\s*ERROR|\bERROR\b/iu },
  { level: 'warn',  regex: /\[WARN(?:ING)?\]|"level"\s*:\s*"warn(?:ing)?"|Severity:\s*WARN/i },
  { level: 'info',  regex: /\[INFO\]|"level"\s*:\s*"info"|\bINFO\b/iu },
  { level: 'debug', regex: /\[DEBUG\]|"level"\s*:\s*"debug"|\bDEBUG\b/iu },
  { level: 'trace', regex: /\[TRACE\]|"level"\s*:\s*"trace"|\bTRACE\b/iu },
];

export const VALID_SEVERITY_LEVELS: readonly string[] = [
  'fatal', 'error', 'warn', 'info', 'debug', 'trace',
];

export function parseSeverityLevel(value: string): SeverityLevel {
  const normalized = value.toLowerCase();
  if (VALID_SEVERITY_LEVELS.includes(normalized)) {
    return normalized as SeverityLevel;
  }
  throw new Error(
    `Unsupported severity level: ${value}. Valid values: ${VALID_SEVERITY_LEVELS.join(', ')}`,
  );
}

export function inferSeverity(line: string): SeverityLevel | undefined {
  for (const { level, regex } of SEVERITY_PATTERNS) {
    if (regex.test(line)) return level;
  }
  return undefined;
}

export function passesSeverityFilter(line: string, minLevel: SeverityLevel): boolean {
  const lineLevel = inferSeverity(line);
  if (lineLevel === undefined) return true;
  return SEVERITY_ORDER[lineLevel] >= SEVERITY_ORDER[minLevel];
}
