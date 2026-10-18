"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectHeaderLogLevel = detectHeaderLogLevel;
// Timestamp shapes that may precede the level: ISO / slash dates with an
// optional time, bare time of day, month-name syslog time, and the [TIME]
// placeholder left by the sanitizer.
const TIMESTAMPED_LEVEL_PATTERN = /^\s*[[(]?(?:\d{4}[-/.]\d{2}[-/.]\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|\s?UTC|\s?GMT|\s?[+-]\d{2}:?\d{2})?)?|\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s{1,2}\d{1,2}\s\d{2}:\d{2}:\d{2}|\[TIME\])[\])]?(?:\s+[^\s=]+){0,3}?\s+(INFO|DEBUG|TRACE|VERBOSE|FINE|FINER|FINEST|WARN|WARNING|ERROR|FATAL|CRITICAL|SEVERE)(?=[\s:|\]]|$)/u;
// Level word first, optionally behind one [thread] tag: "INFO: msg",
// "DEBUG:urllib3...", "ERROR     boom", "INFO | msg".
const LEVEL_FIRST_PATTERN = /^\s*(?:\[[^\]\s]{1,40}\]\s+)?(INFO|DEBUG|TRACE|VERBOSE|FINE|FINER|FINEST|ERROR|FATAL|CRITICAL|SEVERE)(?=[\s:|]|$)/u;
// winston / rustup / .NET console logger style: "info: msg", "dbug: msg".
const LOWERCASE_NOISE_PREFIX_PATTERN = /^\s*(?:info|debug|trace|verbose|dbug|trce):\s/u;
// Python's basic logging format "WARNING:root:msg". A bare "WARNING: msg" is
// left alone because CLI tools print boilerplate warnings that way.
const PYTHON_BASIC_WARN_PATTERN = /^\s*WARN(?:ING)?:[\w.-]+:/u;
const LOGFMT_LEVEL_PATTERN = /(?:^|\s)(?:level|lvl|severity|loglevel)=["']?(info|debug|trace|verbose|warn|warning|error|fatal|critical|panic)["']?(?=\s|$)/iu;
// glog / klog: a level letter and the month-day, then a time or [TIME].
const GLOG_PATTERN = /^([IWEF])\d{4}\s(?:\d{2}:\d{2}:\d{2}(?:\.\d+)?|\[TIME\])\s/u;
const LEVEL_CLASS = {
    info: 'noise',
    debug: 'noise',
    trace: 'noise',
    verbose: 'noise',
    fine: 'noise',
    finer: 'noise',
    finest: 'noise',
    warn: 'warn',
    warning: 'warn',
    error: 'severe',
    fatal: 'severe',
    critical: 'severe',
    severe: 'severe',
    panic: 'severe',
};
const GLOG_LEVEL_CLASS = {
    I: 'noise',
    W: 'warn',
    E: 'severe',
    F: 'severe',
};
/**
 * Classify the unbracketed severity word in the header of a log line:
 * `noise` for INFO/DEBUG/TRACE/VERBOSE/FINE*, `warn` for WARN/WARNING and
 * `severe` for ERROR/FATAL/CRITICAL/SEVERE. Returns undefined when the line
 * carries no recognizable header level.
 */
function detectHeaderLogLevel(line) {
    const timestamped = TIMESTAMPED_LEVEL_PATTERN.exec(line);
    if (timestamped !== null) {
        return LEVEL_CLASS[timestamped[1].toLowerCase()];
    }
    const levelFirst = LEVEL_FIRST_PATTERN.exec(line);
    if (levelFirst !== null) {
        return LEVEL_CLASS[levelFirst[1].toLowerCase()];
    }
    if (LOWERCASE_NOISE_PREFIX_PATTERN.test(line)) {
        return 'noise';
    }
    if (PYTHON_BASIC_WARN_PATTERN.test(line)) {
        return 'warn';
    }
    const glog = GLOG_PATTERN.exec(line);
    if (glog !== null) {
        return GLOG_LEVEL_CLASS[glog[1]];
    }
    const logfmt = LOGFMT_LEVEL_PATTERN.exec(line);
    if (logfmt !== null) {
        return LEVEL_CLASS[logfmt[1].toLowerCase()];
    }
    return undefined;
}
