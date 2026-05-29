/**
 * Minimal Aho-Corasick multi-pattern matcher.
 *
 * Finds, in a single O(text length) pass, the set of patterns that occur as
 * substrings of a text. Used by the source detector to replace thousands of
 * per-marker `String.includes` scans per line with one automaton traversal.
 *
 * Matching is performed over UTF-16 code units, matching `String.includes`
 * semantics exactly; all source markers are ASCII so results are identical.
 */

interface AcNode {
  next: Map<string, number>;
  fail: number;
  outputs: string[];
}

export interface AhoCorasick {
  nodes: AcNode[];
  isEmpty: boolean;
}

function createNode(): AcNode {
  return { next: new Map<string, number>(), fail: 0, outputs: [] };
}

export function buildAhoCorasick(patterns: Iterable<string>): AhoCorasick {
  const nodes: AcNode[] = [createNode()];
  let hasPattern = false;

  for (const pattern of patterns) {
    if (pattern.length === 0) {
      continue;
    }
    hasPattern = true;
    let node = 0;
    for (let i = 0; i < pattern.length; i += 1) {
      const ch = pattern[i];
      let nxt = nodes[node].next.get(ch);
      if (nxt === undefined) {
        nxt = nodes.length;
        nodes.push(createNode());
        nodes[node].next.set(ch, nxt);
      }
      node = nxt;
    }
    nodes[node].outputs.push(pattern);
  }

  const queue: number[] = [];
  for (const child of nodes[0].next.values()) {
    nodes[child].fail = 0;
    queue.push(child);
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    for (const [ch, child] of nodes[current].next) {
      let f = nodes[current].fail;
      while (f !== 0 && !nodes[f].next.has(ch)) {
        f = nodes[f].fail;
      }
      const candidate = nodes[f].next.get(ch);
      nodes[child].fail = candidate ?? 0;
      nodes[child].outputs.push(...nodes[nodes[child].fail].outputs);
      queue.push(child);
    }
  }

  return { nodes, isEmpty: !hasPattern };
}

export function matchAll(ac: AhoCorasick, text: string): Set<string> {
  const found = new Set<string>();
  if (ac.isEmpty) {
    return found;
  }

  let node = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    while (node !== 0 && !ac.nodes[node].next.has(ch)) {
      node = ac.nodes[node].fail;
    }
    node = ac.nodes[node].next.get(ch) ?? 0;
    for (const out of ac.nodes[node].outputs) {
      found.add(out);
    }
  }

  return found;
}
