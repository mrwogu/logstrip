"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentSampler = exports.DEFAULT_CONTENT_SAMPLE_LIMITS = void 0;
exports.isContentSampleFull = isContentSampleFull;
exports.classifyContent = classifyContent;
const constants_js_1 = require("../constants.js");
const format_detector_js_1 = require("../formats/format-detector.js");
const relevance_score_js_1 = require("../scoring/relevance-score.js");
const catalog_js_1 = require("../sources/catalog.js");
const source_profile_js_1 = require("../sources/source-profile.js");
const aho_corasick_js_1 = require("./aho-corasick.js");
exports.DEFAULT_CONTENT_SAMPLE_LIMITS = {
    maxLines: constants_js_1.DEFAULT_CONTENT_SAMPLE_LINES,
    maxBytes: constants_js_1.DEFAULT_CONTENT_SAMPLE_BYTES,
};
const WEAK_LOG_WEIGHT = 0.5;
// ---- Markdown structure ----
const FENCE_PATTERN = /^\s*(?:```|~~~)/u;
const MARKDOWN_STRUCTURE_PATTERNS = [
    // ATX heading: "# Title", "### Sub". "#include" and "##[group]" have no
    // space; TAP comments such as "# tests 3" are log output, not headings.
    /^#{1,6} (?!(?:(?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b|Subtest:))[^\s#]/u,
    // Table row and header separator.
    /^\s*\|.*\|\s*$/u,
    /^\s*:?-{3,}:?\s*\|/u,
];
// ---- Log signals ----
const MONTH_NAMES = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
// The control character is put in with String.fromCharCode so that the pattern
// source holds none, which linters flag in a literal.
const ANSI_ESCAPE_PATTERN = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;?]*[A-Za-z]`, 'u');
// Access log: client IP, HTTP method and a status code. Both anchors are the
// LEFTMOST occurrence (the tempered dots stop at it), so a line that fails the
// last step is not retried from every later IP and method, which made the
// plain "IP.*METHOD.*status" form cubic.
const IPV4_SOURCE = String.raw `\b\d{1,3}(?:\.\d{1,3}){3}\b`;
const HTTP_METHOD_SOURCE = String.raw `\b(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\S`;
const ACCESS_LOG_PATTERN = new RegExp(`^(?:(?!${IPV4_SOURCE}).)*${IPV4_SOURCE}(?:(?!${HTTP_METHOD_SOURCE}).)*${HTTP_METHOD_SOURCE}.*\\b[1-5]\\d{2}\\b`, 'u');
const STRONG_LOG_PATTERNS = [
    // ANSI colour / cursor escapes.
    ANSI_ESCAPE_PATTERN,
    // Timestamps near the start of the line: ISO / RFC 3339, "2024/01/15 10:23:45".
    /^[^'"`]{0,40}?\b\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}:\d{2}/u,
    // Syslog and Apache error log: "Jan 15 10:23:45", "[Mon Jan 15 10:23:45 2024]".
    new RegExp(`^[^'"\`]{0,24}?\\b(?:${MONTH_NAMES})\\s+\\d{1,2}\\s+\\d{2}:\\d{2}:\\d{2}\\b`, 'u'),
    // Common Log Format date: "[15/Jan/2024:10:23:45 +0000]".
    new RegExp(`\\[\\d{2}/(?:${MONTH_NAMES})/\\d{4}:\\d{2}:\\d{2}:\\d{2}`, 'u'),
    // Clock with milliseconds: "10:23:45.123", "10:23:45,123".
    /^[^'"`]{0,40}?\b\d{2}:\d{2}:\d{2}[.,]\d{3}/u,
    // Bare leading clock: "[10:23:45] building", "10:23:45 started".
    /^\s*\[?\d{2}:\d{2}:\d{2}\]?\s/u,
    // Leading epoch seconds or milliseconds.
    /^\s*\[?1\d{9}(?:\d{3})?(?:[.,]\d+)?\]?[\s:|]/u,
    // Bracketed severity tag: "[INFO]", "[error]". "[info](url)" is a link.
    /^[^'"`]{0,40}?\[(?:TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|ERR|FATAL|CRITICAL|SEVERE|VERBOSE|SILLY)\](?![(:])/iu,
    // Upper-case severity word near the start: "ERROR: boom", "INFO  started".
    /^[^'"`]{0,24}?(?:^|[\s|\]])(?:TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|FATAL|CRITICAL|SEVERE)(?::|\s+\S)/u,
    // Compiler style severity: "error: x", "src/a.c:12:5: warning: y".
    /^\s*(?:\S+:\d+(?::\d+)?:\s+)?(?:fatal error|error|warning)(?:\[\w+\])?:\s/u,
    // CI and tool markers at the start of the line.
    /^\s*(?:npm|pnpm)\s+(?:ERR!|WARN|notice|error)\b/u,
    /^\s*yarn\s+(?:error|warn|run|install)\b/u,
    /^\s*::(?:error|warning|notice|debug|group|endgroup|add-mask)\b/u,
    /^\s*##(?:\[(?:group|endgroup|error|warning|command|section|debug)\]|vso\[|teamcity\[)/u,
    /^\s*\[(?:Pipeline|Checks)\]/u,
    /^\s*(?:FAIL|PASS|SKIP|FAILED|PASSED|SKIPPED)\b[: ]/u,
    /^\s*ok\s+\S+\s+[\d.]+s?\b/u,
    /^\s*RUN\s+v\d/u,
    /^\s*Step\s+\d+(?:\/\d+)?\b/u,
    /^\s*make(?:\[\d+\])?:/u,
    /^\s*#\d+\s+(?:\[|DONE|CACHED|\d)/u,
    /^\s*---\s*(?:FAIL|PASS|SKIP):/u,
    /^\s*===\s*(?:RUN|PAUSE|CONT)\b/u,
    /^\s*>\s+Task\s+:/u,
    // npm debug log: "12 verbose cli ...".
    /^\s*\d+\s+(?:silly|verbose|info|http|timing|notice|warn|error)\s/u,
    // TAP output and the "> pkg@1.0.0 script" line npm prints before a script.
    /^\s*(?:not )?ok\s+\d+\b/u,
    /^TAP version\b/u,
    /^\s*1\.\.\d+\s*$/u,
    /^#\s+(?:Subtest:|(?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b)/u,
    /^>\s+(?=\S+@\S)\S+\s+\S/u,
    // Gradle, Cargo, apt, Terraform and pytest output.
    /^\s*(?:\* (?:What went wrong|Try|Exception is):|FAILURE: Build failed|BUILD (?:SUCCESSFUL|FAILED)\b|\d+ actionable tasks?:)/u,
    /^\s*(?:Compiling|Finished|Running|Downloaded|Downloading|Checking)\s+\S+\s+v?\d/u,
    /^\s*-->\s+\S+:\d+|^\s*=\s+(?:note|help):/u,
    /^(?:(?:Get|Hit|Ign):\d+\s|(?:Setting up|Unpacking|Preparing to unpack|Selecting previously unselected package|Processing triggers for)\s|[EW]: \S)/u,
    /\bwill be (?:created|updated in-place|destroyed|replaced)\b|^Plan:\s+\d+ to add|^[\w.[\]"-]+: (?:Creating|Modifying|Destroying|Refreshing state|Still \w+|Creation complete|Modifications complete|Destruction complete)\b/u,
    /^\s*[\u2502\u2577\u2575]/u,
    /^[=_-]{3,} .+ [=_-]{3,}$/u,
    /\[\s*\d{1,3}%\s*\]/u,
    /\bexit(?:ed with)?\s+(?:status|code)[ :=]*\d+\b/iu,
    // Test runner status marks.
    /^\s*[✓✔✗✘✕✖●○⚠❌✅]\s/u,
    // Exception headers: "TypeError: x", "java.lang.IllegalStateException: y".
    /^\s*(?:[\w$]+\.)*(?:[A-Z]\w*)?(?:Error|Exception)(?:\[.*\])?:\s/u,
    // Traceback and crash headers (frames are handled by isStackFrameLine).
    /^\s*(?:Traceback \(most recent call last\)|Caused by:|goroutine \d+ \[|thread '[^']*' panicked at|Exception in thread|panic:|\.\.\. \d+ more$)/u,
    // Process and thread context: "sshd[1234]: ", "[pid 42]", "[http-nio-8080-exec-1]".
    // The name is looked up from the "[" backwards, so a long word with dots in
    // it is not rescanned from every dot.
    /\[(?<=\b[A-Za-z][\w.-]*\[)\d{1,7}\]:\s/u,
    /\[(?:pid|tid)[ :=]*\d+\]/iu,
    /\[(?:main|[\w-]*thread-\d+|[\w-]*exec-\d+|worker[- ]?\d+)\]/iu,
    // Access log: client IP, HTTP method and a status code.
    ACCESS_LOG_PATTERN,
];
// A pretty-printed JSON property. In a test report or scanner export such
// lines mention failures; in a config file they do not.
const JSON_PROPERTY_PATTERN = /^\s*"[^"\n]+"\s*:\s*\S/u;
// A line that is just a call, "t.Errorf(...)". The Go frame pattern in
// isStackFrameLine also matches these, and in source code they are not frames.
const CALL_LINE_PATTERN = /^\s*[\w$.]+\(.*\)\s*;?$/u;
const KEY_VALUE_PAIR_PATTERN = /(?:^|\s)[A-Za-z_][\w.-]*=(?:"[^"]*"|'[^']*'|[^\s"']+)/gu;
// logfmt needs at least this many pairs; a lone "key=value" is an INI / env line.
const LOGFMT_MIN_PAIRS = 2;
// "level=info msg=\"started\" port=8080" without the strict logfmt shape.
const KEY_VALUE_LOG_MIN_PAIRS = 3;
// Source catalog markers that are specific enough to mean something on their
// own. Short markers ("ran ", "nx ") match ordinary words, so they are left out.
const CATALOG_MIN_MARKER_LENGTH = 8;
const CATALOG_MIN_MARKER_WEIGHT = 16;
let catalogAutomaton;
function getCatalogAutomaton() {
    if (catalogAutomaton === undefined) {
        const markers = new Set();
        for (const [, signatures] of catalog_js_1.LOG_SOURCE_SIGNATURES) {
            for (const signature of signatures) {
                const marker = signature.toLowerCase();
                if (marker.length >= CATALOG_MIN_MARKER_LENGTH &&
                    (0, source_profile_js_1.sourceMarkerWeight)(signature) >= CATALOG_MIN_MARKER_WEIGHT) {
                    markers.add(marker);
                }
            }
        }
        catalogAutomaton = (0, aho_corasick_js_1.buildAhoCorasick)(markers);
    }
    return catalogAutomaton;
}
// ---- Text signals ----
const PROSE_SENTENCE_PATTERN = /^\s*(?:[-*+]\s+)?[A-Z][^|]*[.?!]["')\]*]*\s*$/u;
const PROSE_MIN_WORDS = 6;
// Hard-wrapped prose: many plain words, no digits or symbols.
const PLAIN_WORD_PATTERN = /^[A-Za-z][A-Za-z'-]*[,;:.!?)]*$/u;
const WRAPPED_PROSE_MIN_WORDS = 6;
const WRAPPED_PROSE_MIN_PLAIN_RATIO = 0.9;
// Comma separated values: at least three fields and no ", " as in prose.
const CSV_MIN_FIELDS = 3;
const COMMA_SPACE_PATTERN = /,\s/u;
const DIGIT_PATTERN = /\d/u;
const PLAIN_TOKEN_PATTERN = /^\s*[^\s,]+\s*$/u;
// These patterns run on up to CONTENT_LINE_SCAN_LIMIT characters of every
// sampled line, so none of them lets two quantifiers match the same characters
// next to each other ("\s+.+\s+in", "\s*;?\s*$"): on a long run of white space
// that backtracks to a cubic or quadratic number of steps.
const TEXT_PATTERNS = [
    // Markdown: list item, blockquote, link, image, autolink, bold.
    /^\s*(?:[-*+]|\d{1,3}[.)])\s+\S/u,
    /^\s{0,3}>\s{1,2}[A-Z*_[`"'(]/u,
    // The link text has no "[" and the URL is bounded, so a run of "[" does not
    // rescan the rest of the line from every one of them.
    /!?\[[^[\]\n]+\]\([^)\s]{1,1000}\)/u,
    /<https?:\/\/[^>\s]+>/u,
    /\*\*[^*\n]+\*\*/u,
    /^---\s*$/u,
    // Source code: declarations, imports, control flow and punctuation.
    /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:(?:const|let|var)\s[\w${}[\],\s]+(?:=|:|;|$)|function\b|class\s+\w+|interface\s+\w+|enum\s+\w+|abstract\s+class|namespace\s+\w+|type\s+\w+(?:<[^>]*>)?\s*=)/u,
    /^\s*(?:import\s+(?:(?:[\w*${},]+\s+)+from\s+)?['"]|import\s+[\w.*{]|from\s+[\w.]+\s+import\s|export\s+(?:\*|\{)|#\s*(?:include|define|ifdef|ifndef|endif|pragma|undef)\b|using\s+[\w.]+;|package\s+[\w.]+;?\s*$|use\s+[\w:]+(?:(?<=[\w:]::)\{.*\})?;|require\s*\()/u,
    /^\s*(?:(?:pub\s+)?(?:async\s+)?fn|def|func|fun|sub)\s+\w+/u,
    /^\s*(?:public|private|protected|static|final|abstract|override|readonly)\s+\S/u,
    /^\s*(?:elif|else|try|finally|except|catch)\b.*[:{]\s*$/u,
    /^\s*(?:if|for|while|with|switch|catch)\s*\(.*\)\s*(?:\{\s*)?$/u,
    /^\s*(?:if|for|while|with|def|class)\s.+:\s*$/u,
    /^\s*return(?:\s+\S+){0,3}\s*(?:;\s*)?$/u,
    /^\s*(?:raise|assert|del|global|nonlocal|throw|yield|await|defer)\s+\S/u,
    /^\s*(?:attr_\w+|include|extend|require(?:_relative)?|alias_method|module)\s+[:'"A-Z]/u,
    // Lone block keywords: Ruby "end", shell "fi", Python "pass".
    /^\s*(?:end|begin|else|elsif|ensure|then|fi|done|do|esac|endif|endfor|endwhile|endfunction|pass|break|continue|try|finally)\s*(?:;\s*)?$/u,
    /[;{}([]\s*$/u,
    /^\s*[\]})]+[;,]?\s*$/u,
    // Comments and decorators.
    /^\s*(?:\/\/|\/\*|\*\/|\*\s|\*$|"""|''')/u,
    /^\s*[#;](?:\s|$)/u,
    /^\s*@[A-Za-z_][\w.]*(?:\(.*\))?\s*$/u,
    /(?:=>|:=|===|!==|\?\.|\?\?)/u,
    // Continuation lines of a call, import list or literal.
    /^\s+(?:\.\.\.)?[A-Za-z_$][\w$.]*,\s*$/u,
    /^\s*['"`].*['"`][,;]?\s*$/u,
    /^\s*['"][^'"\n]+['"]\s*:\s*\S/u,
    /^\s*[?:]\s+\S/u,
    // A bare call such as "print(x)" or CMake's "project(Foo)".
    /^\s*[A-Za-z_$][\w$.]*\([^()]*\)\s*$/u,
    /<\/?[A-Za-z][\w:-]*(?:\s[^<>]*)?\/?>\s*$/u,
    // HTML at the start of a line.
    /^\s*<\/?(?:!--|!DOCTYPE|[A-Za-z][\w:-]*)(?:\s[^<>]*)?\/?>/u,
    // Configuration: YAML, JSON properties, INI sections, assignments.
    /^(?:-\s+)?[a-z_][\w.-]*:(?:\s+\S|\s*$)/u,
    /^\s+(?:-\s+)?[A-Za-z_][\w.-]*:(?:\s+\S|\s*$)/u,
    JSON_PROPERTY_PATTERN,
    /^\s*\[[A-Za-z][\w .:/-]*\]\s*$/u,
    /^\s*\[.*\],?\s*$/u,
    /^\s*(?:export\s+)?[@$]?[A-Za-z_][\w.[\]'"-]*\s*(?:[-+*/|&^%]|\|\||&&|\?\?|<<|>>)?=\s*[^=\s]/u,
    // Dependency specs: "numpy>=1.24", "requests[socks]==2.31".
    /^\s*[A-Za-z0-9][\w.-]*(?:\[[\w,.-]+\])?\s*(?:===|==|>=|<=|~=|!=|>|<)\s*\d[\w.*+-]*/u,
    // Path and glob lines as in .gitignore or a file list.
    /^\s*!?(?=[\w.*/-]*[/*])[\w.*/-]+\s*$|^\s*\.[\w.-]+\s*$/u,
    // Command line usage: "  -o, --output <path>   Write to path".
    /^\s+(?:-\w,\s+)?--?[A-Za-z][\w-]*(?:[ =]<[^>]+>)?\s{2,}\S/u,
    // SQL.
    /^\s*(?:SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE (?:TABLE|INDEX|VIEW)|ALTER TABLE|DROP TABLE|FROM|WHERE|GROUP BY|ORDER BY|HAVING|(?:LEFT |INNER )?JOIN|LIMIT|VALUES|UNION)\b/u,
    // Shell and Dockerfile.
    /^\s*(?:FROM|RUN|COPY|ADD|CMD|ENTRYPOINT|ENV|ARG|WORKDIR|EXPOSE|USER|LABEL|VOLUME|HEALTHCHECK|ONBUILD|STOPSIGNAL|SHELL|MAINTAINER)\s+\S/u,
    /^\s*(?:#!\/|set\s+-[euxo]|export\s+\w+=|(?:if|elif)\s+\[|for\s+\w+\s+in\s|while\s+(?:read|true|\[)|case\s.+\sin$|source\s+|alias\s+\w+=|echo\s+["'$-]|cd\s+[\w./~"$-]|mkdir\s+-p|\$\()/u,
    /\\$/u,
    /^\s*&&\s/u,
];
// ---- Scoring ----
function matchesAny(patterns, line) {
    for (const pattern of patterns) {
        if (pattern.test(line)) {
            return true;
        }
    }
    return false;
}
function countKeyValuePairs(line) {
    return line.match(KEY_VALUE_PAIR_PATTERN)?.length ?? 0;
}
function splitWords(line) {
    return line.trim().split(/\s+/u);
}
function hasStrongLogSignal(line) {
    if (matchesAny(STRONG_LOG_PATTERNS, line)) {
        return true;
    }
    // The Go frame pattern also matches plain calls such as "t.Errorf(...)".
    if (((0, relevance_score_js_1.isStackFrameLine)(line) && !CALL_LINE_PATTERN.test(line)) ||
        (0, relevance_score_js_1.isInternalStackTraceLine)(line)) {
        return true;
    }
    const format = (0, format_detector_js_1.detectFormat)(line);
    if (format === 'json' || format === 'syslog') {
        return true;
    }
    return format === 'logfmt' && countKeyValuePairs(line) >= LOGFMT_MIN_PAIRS;
}
function isProseSentence(line) {
    return (PROSE_SENTENCE_PATTERN.test(line) &&
        splitWords(line).length >= PROSE_MIN_WORDS);
}
function isWrappedProse(line) {
    const words = splitWords(line);
    if (words.length < WRAPPED_PROSE_MIN_WORDS) {
        return false;
    }
    let plainWords = 0;
    for (const word of words) {
        if (PLAIN_WORD_PATTERN.test(word)) {
            plainWords += 1;
        }
    }
    return plainWords / words.length >= WRAPPED_PROSE_MIN_PLAIN_RATIO;
}
function isCsvRow(line) {
    const fields = line.split(',');
    if (fields.length < 2) {
        return false;
    }
    // Fields with spaces inside ("New York") are fine as long as the line has
    // no ", " as prose does; plain tokens may be padded ("0, 0xc816921f").
    if (fields.length >= CSV_MIN_FIELDS && !COMMA_SPACE_PATTERN.test(line)) {
        return true;
    }
    return (DIGIT_PATTERN.test(line) &&
        fields.every((field) => PLAIN_TOKEN_PATTERN.test(field)));
}
function isDiagnosticJsonProperty(line) {
    return JSON_PROPERTY_PATTERN.test(line) && (0, relevance_score_js_1.looksLikeDiagnosticLine)(line);
}
function hasTextSignal(line) {
    return (matchesAny(TEXT_PATTERNS, line) ||
        isProseSentence(line) ||
        isWrappedProse(line) ||
        isCsvRow(line));
}
function hasWeakLogSignal(line) {
    return ((0, relevance_score_js_1.looksLikeDiagnosticLine)(line) ||
        countKeyValuePairs(line) >= KEY_VALUE_LOG_MIN_PAIRS ||
        (0, aho_corasick_js_1.matchAll)(getCatalogAutomaton(), line.toLowerCase()).size > 0);
}
function classifyLine(line) {
    if (matchesAny(MARKDOWN_STRUCTURE_PATTERNS, line)) {
        return 'text';
    }
    if (hasStrongLogSignal(line) || isDiagnosticJsonProperty(line)) {
        return 'strong-log';
    }
    if (hasTextSignal(line)) {
        return 'text';
    }
    if (hasWeakLogSignal(line)) {
        return 'weak-log';
    }
    return 'neutral';
}
/**
 * True once a sample holds as many non-blank lines, or as many bytes (blank
 * lines included), as the limits allow. Callers stop reading at that point.
 */
function isContentSampleFull(sampledLines, sampledBytes, limits = exports.DEFAULT_CONTENT_SAMPLE_LIMITS) {
    return sampledLines >= limits.maxLines || sampledBytes >= limits.maxBytes;
}
function decideKind(logScore, textLines, sampledLines) {
    if (textLines < constants_js_1.CONTENT_TEXT_MIN_LINES) {
        return 'log';
    }
    if (textLines / sampledLines < constants_js_1.CONTENT_TEXT_MIN_RATIO) {
        return 'log';
    }
    if (logScore / sampledLines > constants_js_1.CONTENT_TEXT_MAX_LOG_RATIO) {
        return 'log';
    }
    return 'text';
}
/**
 * Scores the leading lines of an input one at a time, so a caller that reads
 * a stream can stop as soon as the verdict is settled. classifyContent runs
 * the same sampler over a finished array.
 */
class ContentSampler {
    limits;
    strongLogLines = 0;
    weakLogLines = 0;
    textLines = 0;
    sampledLines = 0;
    sampledBytes = 0;
    // Lines inside a markdown fence are code or pasted output, not evidence
    // about the file. They count as text only once the fence closes, so one
    // stray fence in a log cannot turn the rest of the sample into text.
    insideFence = false;
    fencedLines = 0;
    constructor(limits = exports.DEFAULT_CONTENT_SAMPLE_LIMITS) {
        this.limits = limits;
    }
    /** True once the sample holds as many lines or bytes as the limits allow. */
    isFull() {
        return isContentSampleFull(this.sampledLines, this.sampledBytes, this.limits);
    }
    /** Score one physical line. Lines that arrive after the sample is full are ignored. */
    add(line) {
        if (this.isFull()) {
            return;
        }
        this.sampledBytes += Buffer.byteLength(line, 'utf8') + 1;
        if (line.trim().length === 0) {
            return;
        }
        this.sampledLines += 1;
        const scanned = line.slice(0, constants_js_1.CONTENT_LINE_SCAN_LIMIT);
        if (FENCE_PATTERN.test(scanned)) {
            this.textLines += 1;
            if (this.insideFence) {
                this.textLines += this.fencedLines;
                this.fencedLines = 0;
            }
            this.insideFence = !this.insideFence;
            return;
        }
        if (this.insideFence) {
            this.fencedLines += 1;
            return;
        }
        const verdict = classifyLine(scanned);
        if (verdict === 'strong-log') {
            this.strongLogLines += 1;
        }
        else if (verdict === 'weak-log') {
            this.weakLogLines += 1;
        }
        else if (verdict === 'text') {
            this.textLines += 1;
        }
    }
    /**
     * True once the verdict is 'log' and more lines cannot change it, or is
     * taken to be 'log' because the sample already reads like a log. Only a
     * 'text' verdict needs the whole sample.
     */
    isLogDecided() {
        const logScore = this.logScore();
        // Text needs the log share to stay at or below the ceiling over a sample
        // of at most maxLines lines, so a heavier log count rules text out.
        if (logScore > constants_js_1.CONTENT_TEXT_MAX_LOG_RATIO * this.limits.maxLines) {
            return true;
        }
        // Text needs its share of the sample to reach the minimum ratio, which is
        // out of reach once the lines that cannot turn into text (a pending fence
        // may still do so) outnumber the rest of a full sample.
        const lostToText = this.sampledLines - this.textLines - this.fencedLines;
        if (lostToText > (1 - constants_js_1.CONTENT_TEXT_MIN_RATIO) * this.limits.maxLines) {
            return true;
        }
        // A sample that is mostly log already: decide now. This is the only exit
        // that can differ from the verdict of the full sample, for a text file
        // that opens with a log excerpt.
        return (this.sampledLines >= constants_js_1.CONTENT_EARLY_LOG_MIN_LINES &&
            logScore / this.sampledLines >= constants_js_1.CONTENT_EARLY_LOG_MIN_RATIO);
    }
    /** The classification of the lines added so far. */
    result() {
        return {
            kind: decideKind(this.logScore(), this.textLines, this.sampledLines),
            logLines: this.strongLogLines + this.weakLogLines,
            textLines: this.textLines,
            sampledLines: this.sampledLines,
        };
    }
    // A weak signal (an "error" in a line) is common in code and prose, so it
    // counts for less than a timestamp or a stack frame when text is judged.
    logScore() {
        return this.strongLogLines + this.weakLogLines * WEAK_LOG_WEIGHT;
    }
}
exports.ContentSampler = ContentSampler;
/**
 * Decide whether the leading lines of an input are log output or plain text
 * (prose, markup, source code, configuration, data).
 *
 * Only the first DEFAULT_CONTENT_SAMPLE_LINES non-blank lines, up to
 * DEFAULT_CONTENT_SAMPLE_BYTES, are scored. When the sample does not clearly
 * look like text the result is 'log', so unrecognised formats keep today's
 * behaviour of being compressed.
 */
function classifyContent(lines, limits = exports.DEFAULT_CONTENT_SAMPLE_LIMITS) {
    const sampler = new ContentSampler(limits);
    for (const line of lines) {
        if (sampler.isFull()) {
            break;
        }
        sampler.add(line);
    }
    return sampler.result();
}
