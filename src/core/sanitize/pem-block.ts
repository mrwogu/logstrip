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
