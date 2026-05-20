import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = resolve(__dirname, '..');
const SRC_DIR = join(ROOT_DIR, 'src');

function listTypeScriptFiles(directory: string): readonly string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...listTypeScriptFiles(path));
    } else if (entry.endsWith('.ts')) {
      files.push(path);
    }
  }

  return files;
}

describe('architecture boundaries', () => {
  it('keeps GitHub Actions dependencies outside core and cli surfaces', () => {
    const forbiddenImport = /from ['"]@actions\//u;
    const protectedFiles = [
      ...listTypeScriptFiles(join(SRC_DIR, 'core')),
      ...listTypeScriptFiles(join(SRC_DIR, 'cli')),
    ];

    for (const file of protectedFiles) {
      expect(readFileSync(file, 'utf8'), relative(ROOT_DIR, file)).not.toMatch(
        forbiddenImport,
      );
    }
  });

  it('keeps the action wrapper as the only @actions integration point', () => {
    const actionImports = listTypeScriptFiles(SRC_DIR)
      .filter((file) => readFileSync(file, 'utf8').includes('@actions/'))
      .map((file) => relative(ROOT_DIR, file));

    expect(actionImports).toEqual(['src/action/index.ts']);
  });
});
