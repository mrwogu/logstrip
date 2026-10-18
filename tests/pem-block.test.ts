import { describe, expect, it } from 'vitest';
import {
  createPemBlockState,
  maskPemBlockInText,
} from '../src/core/logstrip-parser';

const REDACTED = '[PEM PRIVATE KEY REDACTED]';

describe('maskPemBlockInText', () => {
  it.each([
    '-----BEGIN PRIVATE KEY-----',
    '-----BEGIN RSA PRIVATE KEY-----',
    '-----BEGIN EC PRIVATE KEY-----',
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    '-----BEGIN ENCRYPTED PRIVATE KEY-----',
    '    -----BEGIN PRIVATE KEY-----',
    'private_key: |',
  ])('handles the header line %s', (header) => {
    const state = createPemBlockState();

    const masked = maskPemBlockInText(header, state);

    if (header.includes('BEGIN')) {
      expect(masked).toBe(REDACTED);
      expect(state.inside).toBe(true);
    } else {
      expect(masked).toBe(header);
      expect(state.inside).toBe(false);
    }
  });

  it('drops the body and the footer of a block, then resumes', () => {
    const state = createPemBlockState();

    expect(maskPemBlockInText('-----BEGIN RSA PRIVATE KEY-----', state)).toBe(REDACTED);
    expect(maskPemBlockInText('MIIEowIBAAKCAQEAu1SU1LfVLPHC', state)).toBeNull();
    expect(maskPemBlockInText('VTLw7onLRnrq0/IzW7yWR7Qkrm==', state)).toBeNull();
    expect(maskPemBlockInText('-----END RSA PRIVATE KEY-----', state)).toBeNull();
    expect(state.inside).toBe(false);
    expect(maskPemBlockInText('Rotate the key every quarter.', state)).toBe(
      'Rotate the key every quarter.',
    );
  });

  it('opens a block for a header that follows a YAML key and a quote', () => {
    const state = createPemBlockState();

    expect(maskPemBlockInText('private_key: "-----BEGIN PRIVATE KEY-----', state)).toBe(
      REDACTED,
    );
    expect(state.inside).toBe(true);
  });

  it('does not open a block for a table row that names the header', () => {
    const state = createPemBlockState();
    const row =
      '| PEM private key blocks | `[PEM PRIVATE KEY REDACTED]` | `-----BEGIN RSA PRIVATE KEY-----` |';

    expect(maskPemBlockInText(row, state)).toBe(row);
    expect(state.inside).toBe(false);
  });

  it('does not open a block for a sentence that names the header', () => {
    const state = createPemBlockState();
    const sentence = 'A key file starts with `-----BEGIN PRIVATE KEY-----`.';

    expect(maskPemBlockInText(sentence, state)).toBe(sentence);
    expect(state.inside).toBe(false);
    expect(maskPemBlockInText('The next line is ordinary text.', state)).toBe(
      'The next line is ordinary text.',
    );
  });

  it('redacts a whole key on one line without opening a block', () => {
    const state = createPemBlockState();
    const line =
      '"key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0B\\n-----END PRIVATE KEY-----\\n",';

    expect(maskPemBlockInText(line, state)).toBe(REDACTED);
    expect(state.inside).toBe(false);
  });

  it('leaves other lines alone', () => {
    const state = createPemBlockState();

    expect(maskPemBlockInText('plain text', state)).toBe('plain text');
    expect(maskPemBlockInText('-----BEGIN CERTIFICATE-----', state)).toBe(
      '-----BEGIN CERTIFICATE-----',
    );
  });
});
