// ---- PEM private key block patterns ----

const PEM_BLOCK_HEADER_PATTERN =
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED |)PRIVATE KEY-----/u;
const PEM_BLOCK_FOOTER_PATTERN =
  /-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED |)PRIVATE KEY-----/u;

export interface PemBlockState {
  inside: boolean;
}

export function createPemBlockState(): PemBlockState {
  return { inside: false };
}

/**
 * Mask PEM private key blocks. Returns the sanitized line for normal use,
 * or null when the line should be dropped (internal PEM body lines).
 */
export function maskPemBlock(
  line: string,
  state: PemBlockState,
): string | null {
  if (PEM_BLOCK_HEADER_PATTERN.test(line)) {
    state.inside = true;
    return '[PEM PRIVATE KEY REDACTED]';
  }

  if (state.inside) {
    if (PEM_BLOCK_FOOTER_PATTERN.test(line)) {
      state.inside = false;
    }
    return null;
  }

  return line;
}

// A header that ends its line, optionally followed by a closing quote: the
// start of a key block. A sentence or table row that merely names the header
// continues after it.
const PEM_BLOCK_START_PATTERN =
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED |)PRIVATE KEY-----["'\s]*$/u;

/**
 * maskPemBlock for text that is not a log (documents, configuration). Only a
 * header that ends its line opens a block, so a page that names
 * "-----BEGIN PRIVATE KEY-----" in a sentence or a table does not lose
 * everything after it. A whole key on one line (a JSON string with \n
 * escapes) is redacted on the spot instead of opening a block.
 */
export function maskPemBlockInText(
  line: string,
  state: PemBlockState,
): string | null {
  if (state.inside) {
    return maskPemBlock(line, state);
  }

  if (PEM_BLOCK_HEADER_PATTERN.test(line) && PEM_BLOCK_FOOTER_PATTERN.test(line)) {
    return '[PEM PRIVATE KEY REDACTED]';
  }

  if (PEM_BLOCK_START_PATTERN.test(line)) {
    return maskPemBlock(line, state);
  }

  return line;
}
