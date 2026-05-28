export type MultilineMode = 'auto' | 'auto-source' | 'python' | 'node' | 'java' | 'go' | 'rust' | 'off';

const MAX_MULTILINE_GROUP_LINES = 200;
const MAX_MULTILINE_GROUP_BYTES = 200_000;

const INDENTED_PATTERN = /^\s+/u;

export interface ContinuationContext {
  mode: MultilineMode;
  groupLineCount: number;
  groupByteCount: number;
  previousLine: string;
  /**
   * For auto-source mode: the resolved effective mode derived from detected sources.
   * Updated externally when the top detected source changes.
   */
  effectiveMode?: Exclude<MultilineMode, 'auto-source'>;
}

export function createContinuationContext(mode: MultilineMode): ContinuationContext {
  return { mode, groupLineCount: 0, groupByteCount: 0, previousLine: '' };
}

const EXPLICIT_MODES: ReadonlySet<string> = new Set([
  'auto', 'auto-source', 'python', 'node', 'java', 'go', 'rust', 'off',
]);

export function isContinuationLine(line: string, ctx: ContinuationContext): boolean {
  if (ctx.mode === 'off') return false;
  if (ctx.groupLineCount >= MAX_MULTILINE_GROUP_LINES) return false;
  if (ctx.groupByteCount >= MAX_MULTILINE_GROUP_BYTES) return false;

  if (ctx.mode === 'auto-source') {
    return isAutoSourceCont(line, ctx);
  }

  if (ctx.mode === 'java') return isJavaCont(line);
  if (ctx.mode === 'go') return isGoCont(line);
  if (ctx.mode === 'auto') return isAutoCont(line, ctx.previousLine);
  if (!EXPLICIT_MODES.has(ctx.mode)) return false;

  return isCont(line);
}

function isAutoSourceCont(line: string, ctx: ContinuationContext): boolean {
  if (line.trim().length === 0) return false;

  if (ctx.effectiveMode === undefined) {
    return isAutoCont(line, ctx.previousLine);
  }

  if (ctx.effectiveMode === 'java') return isJavaCont(line);
  if (ctx.effectiveMode === 'go') return isGoCont(line);
  if (ctx.effectiveMode === 'off') return false;

  return isCont(line);
}

function isCont(line: string): boolean {
  return line.trim().length > 0 && INDENTED_PATTERN.test(line) && !line.startsWith('    [');
}

function isJavaCont(line: string): boolean {
  if (line.trim().length === 0) return false;
  if (/^Caused\s+by:/iu.test(line)) return true;
  return INDENTED_PATTERN.test(line) && !line.startsWith('    [');
}

function isGoCont(line: string): boolean {
  if (line.trim().length === 0) return false;
  if (/^(?:\t|goroutine\s+\d+\s+\[.+\]:|created\s+by\s)/u.test(line)) return true;
  return /^\t/u.test(line);
}

function isAutoCont(line: string, previousLine: string): boolean {
  if (line.trim().length === 0) return false;
  if (INDENTED_PATTERN.test(line) && !line.startsWith('    [')) return true;
  if (/^Caused\s+by:/iu.test(line)) return true;
  if (/^goroutine\s+\d+\s+\[.+\]:/u.test(line)) return true;
  return false;
}
