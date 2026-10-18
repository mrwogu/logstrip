export interface PemBlockState {
    inside: boolean;
}
export declare function createPemBlockState(): PemBlockState;
/**
 * Mask PEM private key blocks. Returns the sanitized line for normal use,
 * or null when the line should be dropped (internal PEM body lines).
 */
export declare function maskPemBlock(line: string, state: PemBlockState): string | null;
/**
 * maskPemBlock for text that is not a log (documents, configuration). Only a
 * header that ends its line opens a block, so a page that names
 * "-----BEGIN PRIVATE KEY-----" in a sentence or a table does not lose
 * everything after it. A whole key on one line (a JSON string with \n
 * escapes) is redacted on the spot instead of opening a block.
 */
export declare function maskPemBlockInText(line: string, state: PemBlockState): string | null;
