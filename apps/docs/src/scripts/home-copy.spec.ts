import { describe, expect, it, vi } from 'vitest';
import { copyText } from './home-copy';

describe('copyText', () => {
  it('writes the text to the clipboard and reports it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(copyText('npm i -g logstrip', { writeText })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('npm i -g logstrip');
  });

  it('reports a failure when the clipboard rejects or is missing', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));

    await expect(copyText('x', { writeText })).resolves.toBe('copy failed');
    await expect(copyText('x', undefined)).resolves.toBe('copy failed');
  });
});
