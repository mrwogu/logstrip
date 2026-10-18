/** Remove every ANSI CSI and OSC escape sequence from a line. */
export declare function stripAnsi(line: string): string;
/**
 * Mask credentials in one line: GitHub, Slack, Stripe, npm, Google, Twilio,
 * SendGrid and AWS keys, JWTs, connection-string passwords, Authorization
 * headers, password/token/secret fields, AWS account ids and any other
 * high-entropy token. Identifiers, timestamps, IPs and emails stay as they
 * are. PEM private key blocks span lines and are handled by maskPemBlock.
 */
export declare function maskSecrets(line: string): string;
export declare function sanitizeLine(line: string, preserveIdSuffix?: number): string;
