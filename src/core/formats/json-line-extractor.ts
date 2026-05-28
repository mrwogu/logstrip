const LEVEL_KEYS = ['level', 'severity', 'lvl', 'log_level'];
const MSG_KEYS = ['msg', 'message', 'log', 'text'];
const ERROR_KEYS = ['err', 'error', 'exception'];

export interface ExtractedJsonLog {
  level?: string | number;
  msg?: string;
  errStack?: string;
  raw: Record<string, unknown>;
}

export function extractJsonLog(line: string): ExtractedJsonLog | null {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    if (typeof obj !== 'object' || obj === null) return null;

    const level = LEVEL_KEYS.map((k) => obj[k]).find(
      (v) => v !== undefined,
    ) as string | number | undefined;

    const msg = MSG_KEYS.map((k) => obj[k]).find(
      (v) => typeof v === 'string',
    ) as string | undefined;

    let errStack: string | undefined;
    for (const k of ERROR_KEYS) {
      const v = obj[k];
      if (v && typeof v === 'object' && 'stack' in v) {
        errStack = String((v as { stack: unknown }).stack);
        break;
      }
    }

    return { level, msg, errStack, raw: obj };
  } catch {
    return null;
  }
}

/**
 * Normalize a pino-style numeric level (60=fatal, 50=error, 40=warn, 30=info,
 * 20=debug, 10=trace) to a canonical string. String levels are lowercased
 * as-is. Undefined/missing levels default to "info".
 */
export function normalizeJsonLevel(level: unknown): string {
  if (typeof level === 'number') {
    if (level >= 60) return 'fatal';
    if (level >= 50) return 'error';
    if (level >= 40) return 'warn';
    if (level >= 30) return 'info';
    if (level >= 20) return 'debug';
    return 'trace';
  }
  if (typeof level === 'string') return level.toLowerCase();
  return 'info';
}

/**
 * Score a JSON log line based on its parsed level field.
 *
 * Returns:
 * - `undefined` if the line does not parse as JSON (fall through to standard scoring)
 * - `null` if the line is a JSON info/debug/trace entry without an error stack (drop)
 * - a number (25-100) for keep-worthy JSON lines
 */
export function scoreJsonLine(line: string): number | null | undefined {
  const json = extractJsonLog(line);
  if (!json) return undefined; // not JSON — fall through to regex scoring

  const lvl = normalizeJsonLevel(json.level);

  if (lvl === 'fatal' || lvl === 'error' || lvl === 'critical') {
    return 100;
  }

  if (lvl === 'warn' || lvl === 'warning') {
    return 50;
  }

  // info / debug / trace — drop unless there is an embedded error stack
  if (json.errStack) {
    return 80;
  }

  return null; // drop
}
