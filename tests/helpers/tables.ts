// Test tables written as text blocks. "@@ name" starts a group and every other
// line is one row, written with JSON string escapes so tabs, ANSI bytes and
// quotes are explicit. Pair rows carry " => " between their two sides.
export type LineGroup = readonly [name: string, lines: readonly string[]];
export type PairGroup<R> = readonly [name: string, rows: ReadonlyArray<readonly [string, R]>];

const GROUP_PREFIX = '@@ ';
const PAIR_SEPARATOR = ' => ';

function unescapeRow(text: string): string {
  return JSON.parse(`"${text}"`) as string;
}

function rawGroups(block: string): ReadonlyArray<readonly [string, readonly string[]]> {
  const groups: Array<[string, string[]]> = [];
  for (const line of block.replace(/^\n/u, '').replace(/\n[ \t]*$/u, '').split('\n')) {
    if (line.startsWith(GROUP_PREFIX)) {
      groups.push([line.slice(GROUP_PREFIX.length), []]);
      continue;
    }
    const group = groups[groups.length - 1];
    if (group === undefined) throw new Error(`row before the first group: ${line}`);
    group[1].push(line);
  }
  return groups;
}

export function lineGroups(block: string): readonly LineGroup[] {
  return rawGroups(block).map(([name, lines]) => [name, lines.map(unescapeRow)]);
}

export function pairGroups<R>(block: string, right: (text: string) => R): ReadonlyArray<PairGroup<R>> {
  return rawGroups(block).map(([name, lines]) => [
    name,
    lines.map((line) => {
      const at = line.indexOf(PAIR_SEPARATOR);
      if (at === -1) throw new Error(`pair row without separator: ${line}`);
      return [unescapeRow(line.slice(0, at)), right(unescapeRow(line.slice(at + PAIR_SEPARATOR.length)))];
    }),
  ]);
}
