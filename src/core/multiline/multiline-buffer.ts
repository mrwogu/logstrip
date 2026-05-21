export type MultilineMode = 'auto' | 'python' | 'node' | 'java' | 'go' | 'rust' | 'off';

const MAX_MULTILINE_GROUP_LINES = 200;
const MAX_MULTILINE_GROUP_BYTES = 200_000;

const INDENTED_PATTERN = /^\s+/u;

export function createContinuationContext(mode: MultilineMode): ContinuationContext {
  return { mode, groupLineCount: 0, groupByteCount: 0, previousLine: '' };
}

interface ContinuationContext {
  mode: MultilineMode;
  groupLineCount: number;
  groupByteCount: number;
  previousLine: string;
}

export function isContinuationLine(line: string, ctx: ContinuationContext): boolean {
  if (ctx.mode === 'off') return false;
  if (ctx.groupLineCount >= MAX_MULTILINE_GROUP_LINES) return false;
  if (ctx.groupByteCount >= MAX_MULTILINE_GROUP_BYTES) return false;

  switch (ctx.mode) {
    case 'python': return isCont(line);
    case 'node': return isCont(line);
    case 'java': return isJavaCont(line);
    case 'go': return isGoCont(line);
    case 'rust': return isCont(line);
    case 'auto': return isAutoCont(line, ctx.previousLine);
    default: return false;
  }
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
