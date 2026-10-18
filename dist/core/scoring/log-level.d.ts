/**
 * Header log levels: the severity word that logging frameworks print in a
 * fixed position near the start of a line, without brackets.
 *
 *   2026-05-16T10:18:07.141Z  INFO 181 --- [app] [exec-3] c.a.Foo : msg   (Spring Boot)
 *   10:24:31.044 [main] DEBUG c.a.Foo - msg                                (logback)
 *   2026-05-16 10:24:31,044 - app.worker - ERROR - msg                     (Python logging)
 *   DEBUG:urllib3.connectionpool:Starting new HTTPS connection             (Python basic)
 *   2026-05-16 10:24:31.044 | INFO     | app.main:run:42 - msg             (loguru)
 *   time=... level=info msg="..."                                          (logfmt)
 *   I0516 10:24:31.011234   12345 server.go:42] msg                        (glog / klog)
 *
 * The bracketed forms ("[INFO]") are handled by the tag patterns in
 * relevance-score.ts. The position rules keep prose that merely contains an
 * uppercase "INFO" or "ERROR" word from being classified.
 */
export type HeaderLogLevel = 'noise' | 'warn' | 'severe';
/**
 * Classify the unbracketed severity word in the header of a log line:
 * `noise` for INFO/DEBUG/TRACE/VERBOSE/FINE*, `warn` for WARN/WARNING and
 * `severe` for ERROR/FATAL/CRITICAL/SEVERE. Returns undefined when the line
 * carries no recognizable header level.
 */
export declare function detectHeaderLogLevel(line: string): HeaderLogLevel | undefined;
