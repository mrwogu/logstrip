/** Minimum candidate length; shorter tokens are too ambiguous to judge. */
export declare const ENTROPY_MIN_TOKEN_LENGTH = 20;
/** Shannon entropy (bits/char) above which a candidate is masked. */
export declare const ENTROPY_SECRET_THRESHOLD = 4.2;
/** Shannon entropy of a string in bits per character. */
export declare function shannonEntropy(value: string): number;
/**
 * Mask random-looking tokens (length >= 20, entropy >= 4.2 bits/char) that
 * survived the vendor-specific secret patterns. Conservative on purpose:
 * false negatives are recoverable, masked source code identifiers are not.
 */
export declare function maskHighEntropyTokens(line: string): string;
