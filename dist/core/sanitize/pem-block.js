"use strict";
// ---- PEM private key block patterns ----
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPemBlockState = createPemBlockState;
exports.maskPemBlock = maskPemBlock;
const PEM_BLOCK_HEADER_PATTERN = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED |)PRIVATE KEY-----/u;
const PEM_BLOCK_FOOTER_PATTERN = /-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED |)PRIVATE KEY-----/u;
function createPemBlockState() {
    return { inside: false };
}
/**
 * Mask PEM private key blocks. Returns the sanitized line for normal use,
 * or null when the line should be dropped (internal PEM body lines).
 */
function maskPemBlock(line, state) {
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
