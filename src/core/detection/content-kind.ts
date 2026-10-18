import {
  CONTENT_EARLY_LOG_MIN_LINES,
  CONTENT_EARLY_LOG_MIN_RATIO,
  CONTENT_LINE_SCAN_LIMIT,
  CONTENT_TEXT_MAX_LOG_RATIO,
  CONTENT_TEXT_MIN_LINES,
  CONTENT_TEXT_MIN_RATIO,
  DEFAULT_CONTENT_SAMPLE_BYTES,
  DEFAULT_CONTENT_SAMPLE_LINES,
} from '../constants.js';
import { detectFormat } from '../formats/format-detector.js';
import {
  isInternalStackTraceLine,
  isStackFrameLine,
  looksLikeDiagnosticLine,
} from '../scoring/relevance-score.js';
import { LOG_SOURCE_SIGNATURES } from '../sources/catalog.js';
import { sourceMarkerWeight } from '../sources/source-profile.js';
import { buildAhoCorasick, matchAll, type AhoCorasick } from './aho-corasick.js';

// ---- Content classification: log or plain text? ----
//
// LogStrip scores every line of its input as noise or signal. That is right
// for build and server logs and destructive for everything else: a README,
// a YAML config or a source file loses most of its lines. This module looks
// at the head of the input and decides which of the two it is dealing with.
//
// Each sampled non-blank line gets one verdict, checked in this order:
//
//   1. markdown structure (heading, table)       -> text
//   2. strong log signal, or a JSON property
//      that mentions a failure                   -> log
//   3. text signal (prose, code, config, ...)    -> text
//   4. weak log signal (diagnostic words, ...)   -> log, counted at half weight
//   5. anything else                             -> neutral
//
// Markdown structure goes first because a log line never starts with "## " or
// "| a | b |". Strong log signals (timestamps, severity tags, stack frames)
// beat the looser text shapes, so "ERROR: something failed." stays a log
// line even though it also reads like a sentence. Weak log signals (an
// "error" somewhere in the line) come after the text shapes, otherwise every
// sentence about errors in a document would count as log output.
//
// The sample is text only when text-like lines dominate and log-like lines
// are rare. Everything else, including inputs with no recognisable signal at
// all, is a log: that keeps the compression behaviour for unknown formats.
//
// The thresholds in constants.ts were tuned against the fixtures in
// tests/fixtures plus a wide set of READMEs, configs and source files, not
// by feel: tests/content-kind.test.ts keeps both sides of that corpus.

export type ContentKind = 'log' | 'text';

export interface ContentClassification {
  kind: ContentKind;
  /** Sampled lines that look like log output. */
  logLines: number;
  /** Sampled lines that look like prose, markup, code or configuration. */
  textLines: number;
  /** Non-blank lines that were scored (log, text and undecided ones). */
  sampledLines: number;
}

export interface ContentSampleLimits {
  maxLines: number;
  maxBytes: number;
}

export const DEFAULT_CONTENT_SAMPLE_LIMITS: ContentSampleLimits = {
  maxLines: DEFAULT_CONTENT_SAMPLE_LINES,
  maxBytes: DEFAULT_CONTENT_SAMPLE_BYTES,
};

const WEAK_LOG_WEIGHT = 0.5;

type LineVerdict = 'strong-log' | 'weak-log' | 'text' | 'neutral';

// ---- Markdown structure ----

const FENCE_PATTERN = /^\s*(?:```|~~~)/u;
const MARKDOWN_STRUCTURE_PATTERNS: readonly RegExp[] = [
  // ATX heading: "# Title", "### Sub". "#include" and "##[group]" have no
  // space; TAP comments such as "# tests 3" are log output, not headings.
  /^#{1,6} (?!(?:(?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b|Subtest:))[^\s#]/u,
  // Table row and header separator.
  /^\s*\|.*\|\s*$/u,
  /^\s*:?-{3,}:?\s*\|/u,
];

// ---- Log signals ----

const MONTH_NAMES = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';

const STRONG_LOG_PATTERNS: readonly RegExp[] = [
  // ANSI colour / cursor escapes.
  /\u001b\[[0-9;?]*[A-Za-z]/u,

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
  /^>\s+\S+@\S+\s+\S/u,
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
  /\b[A-Za-z][\w.-]*\[\d{1,7}\]:\s/u,
  /\[(?:pid|tid)[ :=]*\d+\]/iu,
  /\[(?:main|[\w-]*thread-\d+|[\w-]*exec-\d+|worker[- ]?\d+)\]/iu,

  // Access log: client IP, HTTP method and a status code.
  /\b\d{1,3}(?:\.\d{1,3}){3}\b.*\b(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\S+.*\b[1-5]\d{2}\b/u,
];

// A pretty-printed JSON property. In a test report or scanner export such
// lines mention failures; in a config file they do not.
const JSON_PROPERTY_PATTERN = /^\s*"[^"\n]+"\s*:\s*\S/u;

// A line that is just a call, "t.Errorf(...)". The Go frame pattern in
// isStackFrameLine also matches these, and in source code they are not frames.
const CALL_LINE_PATTERN = /^\s*[\w$.]+\(.*\)\s*;?$/u;

const KEY_VALUE_PAIR_PATTERN =
  /(?:^|\s)[A-Za-z_][\w.-]*=(?:"[^"]*"|'[^']*'|[^\s"']+)/gu;
// logfmt needs at least this many pairs; a lone "key=value" is an INI / env line.
const LOGFMT_MIN_PAIRS = 2;
// "level=info msg=\"started\" port=8080" without the strict logfmt shape.
const KEY_VALUE_LOG_MIN_PAIRS = 3;

// Source catalog markers that are specific enough to mean something on their
// own. Short markers ("ran ", "nx ") match ordinary words, so they are left out.
const CATALOG_MIN_MARKER_LENGTH = 8;
const CATALOG_MIN_MARKER_WEIGHT = 16;

let catalogAutomaton: AhoCorasick | undefined;

function getCatalogAutomaton(): AhoCorasick {
  if (catalogAutomaton === undefined) {
    const markers = new Set<string>();
    for (const [, signatures] of LOG_SOURCE_SIGNATURES) {
      for (const signature of signatures) {
        const marker = signature.toLowerCase();
        if (
          marker.length >= CATALOG_MIN_MARKER_LENGTH &&
          sourceMarkerWeight(signature) >= CATALOG_MIN_MARKER_WEIGHT
        ) {
          markers.add(marker);
        }
      }
    }
    catalogAutomaton = buildAhoCorasick(markers);
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

const TEXT_PATTERNS: readonly RegExp[] = [
  // Markdown: list item, blockquote, link, image, autolink, bold.
  /^\s*(?:[-*+]|\d{1,3}[.)])\s+\S/u,
  /^\s{0,3}>\s{1,2}[A-Z*_[`"'(]/u,
  /!?\[[^\]\n]+\]\([^)\s]+\)/u,
  /<https?:\/\/[^>\s]+>/u,
  /\*\*[^*\n]+\*\*/u,
  /^---\s*$/u,

  // Source code: declarations, imports, control flow and punctuation.
  /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:(?:const|let|var)\s+[\w${}[\],\s]+(?:=|:|;|$)|function\b|class\s+\w+|interface\s+\w+|enum\s+\w+|abstract\s+class|namespace\s+\w+|type\s+\w+(?:<[^>]*>)?\s*=)/u,
  /^\s*(?:import\s+(?:[\w*${},\s]+\s+from\s+)?['"]|import\s+[\w.*{]|from\s+[\w.]+\s+import\s|export\s+(?:\*|\{)|#\s*(?:include|define|ifdef|ifndef|endif|pragma|undef)\b|using\s+[\w.]+;|package\s+[\w.]+;?\s*$|use\s+[\w:]+(?:::\{.*\})?;|require\s*\()/u,
  /^\s*(?:(?:pub\s+)?(?:async\s+)?fn|def|func|fun|sub)\s+\w+/u,
  /^\s*(?:public|private|protected|static|final|abstract|override|readonly)\s+\S/u,
  /^\s*(?:elif|else|try|finally|except|catch)\b.*[:{]\s*$/u,
  /^\s*(?:if|for|while|with|switch|catch)\s*\(.*\)\s*\{?\s*$/u,
  /^\s*(?:if|for|while|with|def|class)\s+.+:\s*$/u,
  /^\s*return(?:\s+\S+){0,3}\s*;?\s*$/u,
  /^\s*(?:raise|assert|del|global|nonlocal|throw|yield|await|defer)\s+\S/u,
  /^\s*(?:attr_\w+|include|extend|require(?:_relative)?|alias_method|module)\s+[:'"A-Z]/u,
  // Lone block keywords: Ruby "end", shell "fi", Python "pass".
  /^\s*(?:end|begin|else|elsif|ensure|then|fi|done|do|esac|endif|endfor|endwhile|endfunction|pass|break|continue|try|finally)\s*;?\s*$/u,
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
  /^\s*(?:#!\/|set\s+-[euxo]|export\s+\w+=|(?:if|elif)\s+\[|for\s+\w+\s+in\s|while\s+(?:read|true|\[)|case\s+.+\s+in$|source\s+|alias\s+\w+=|echo\s+["'$-]|cd\s+[\w./~"$-]|mkdir\s+-p|\$\()/u,
  /\\$/u,
  /^\s*&&\s/u,
];

// ---- Scoring ----

function matchesAny(patterns: readonly RegExp[], line: string): boolean {
  for (const pattern of patterns) {
    if (pattern.test(line)) {
      return true;
    }
  }
  return false;
}

function countKeyValuePairs(line: string): number {
  return line.match(KEY_VALUE_PAIR_PATTERN)?.length ?? 0;
}

function splitWords(line: string): string[] {
  return line.trim().split(/\s+/u);
}

function hasStrongLogSignal(line: string): boolean {
  if (matchesAny(STRONG_LOG_PATTERNS, line)) {
    return true;
  }
  // The Go frame pattern also matches plain calls such as "t.Errorf(...)".
  if (
    (isStackFrameLine(line) && !CALL_LINE_PATTERN.test(line)) ||
    isInternalStackTraceLine(line)
  ) {
    return true;
  }
  const format = detectFormat(line);
  if (format === 'json' || format === 'syslog') {
    return true;
  }
  return format === 'logfmt' && countKeyValuePairs(line) >= LOGFMT_MIN_PAIRS;
}

function isProseSentence(line: string): boolean {
  return (
    PROSE_SENTENCE_PATTERN.test(line) &&
    splitWords(line).length >= PROSE_MIN_WORDS
  );
}

function isWrappedProse(line: string): boolean {
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

function isCsvRow(line: string): boolean {
  const fields = line.split(',');
  if (fields.length < 2) {
    return false;
  }
  // Fields with spaces inside ("New York") are fine as long as the line has
  // no ", " as prose does; plain tokens may be padded ("0, 0xc816921f").
  if (fields.length >= CSV_MIN_FIELDS && !COMMA_SPACE_PATTERN.test(line)) {
    return true;
  }
  return (
    DIGIT_PATTERN.test(line) &&
    fields.every((field) => PLAIN_TOKEN_PATTERN.test(field))
  );
}

function isDiagnosticJsonProperty(line: string): boolean {
  return JSON_PROPERTY_PATTERN.test(line) && looksLikeDiagnosticLine(line);
}

function hasTextSignal(line: string): boolean {
  return (
    matchesAny(TEXT_PATTERNS, line) ||
    isProseSentence(line) ||
    isWrappedProse(line) ||
    isCsvRow(line)
  );
}

function hasWeakLogSignal(line: string): boolean {
  return (
    looksLikeDiagnosticLine(line) ||
    countKeyValuePairs(line) >= KEY_VALUE_LOG_MIN_PAIRS ||
    matchAll(getCatalogAutomaton(), line.toLowerCase()).size > 0
  );
}

function classifyLine(line: string): LineVerdict {
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
export function isContentSampleFull(
  sampledLines: number,
  sampledBytes: number,
  limits: ContentSampleLimits = DEFAULT_CONTENT_SAMPLE_LIMITS,
): boolean {
  return sampledLines >= limits.maxLines || sampledBytes >= limits.maxBytes;
}

function decideKind(
  logScore: number,
  textLines: number,
  sampledLines: number,
): ContentKind {
  if (textLines < CONTENT_TEXT_MIN_LINES) {
    return 'log';
  }
  if (textLines / sampledLines < CONTENT_TEXT_MIN_RATIO) {
    return 'log';
  }
  if (logScore / sampledLines > CONTENT_TEXT_MAX_LOG_RATIO) {
    return 'log';
  }
  return 'text';
}

/**
 * Scores the leading lines of an input one at a time, so a caller that reads
 * a stream can stop as soon as the verdict is settled. classifyContent runs
 * the same sampler over a finished array.
 */
export class ContentSampler {
  private strongLogLines = 0;
  private weakLogLines = 0;
  private textLines = 0;
  private sampledLines = 0;
  private sampledBytes = 0;
  // Lines inside a markdown fence are code or pasted output, not evidence
  // about the file. They count as text only once the fence closes, so one
  // stray fence in a log cannot turn the rest of the sample into text.
  private insideFence = false;
  private fencedLines = 0;

  constructor(
    private readonly limits: ContentSampleLimits = DEFAULT_CONTENT_SAMPLE_LIMITS,
  ) {}

  /** True once the sample holds as many lines or bytes as the limits allow. */
  isFull(): boolean {
    return isContentSampleFull(this.sampledLines, this.sampledBytes, this.limits);
  }

  /** Score one physical line. Lines that arrive after the sample is full are ignored. */
  add(line: string): void {
    if (this.isFull()) {
      return;
    }
    this.sampledBytes += Buffer.byteLength(line, 'utf8') + 1;
    if (line.trim().length === 0) {
      return;
    }
    this.sampledLines += 1;
    const scanned = line.slice(0, CONTENT_LINE_SCAN_LIMIT);

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
    } else if (verdict === 'weak-log') {
      this.weakLogLines += 1;
    } else if (verdict === 'text') {
      this.textLines += 1;
    }
  }

  /**
   * True once the verdict is 'log' and more lines cannot change it, or is
   * taken to be 'log' because the sample already reads like a log. Only a
   * 'text' verdict needs the whole sample.
   */
  isLogDecided(): boolean {
    const logScore = this.logScore();
    // Text needs the log share to stay at or below the ceiling over a sample
    // of at most maxLines lines, so a heavier log count rules text out.
    if (logScore > CONTENT_TEXT_MAX_LOG_RATIO * this.limits.maxLines) {
      return true;
    }
    // Text needs its share of the sample to reach the minimum ratio, which is
    // out of reach once the lines that cannot turn into text (a pending fence
    // may still do so) outnumber the rest of a full sample.
    const lostToText = this.sampledLines - this.textLines - this.fencedLines;
    if (lostToText > (1 - CONTENT_TEXT_MIN_RATIO) * this.limits.maxLines) {
      return true;
    }
    // A sample that is mostly log already: decide now. This is the only exit
    // that can differ from the verdict of the full sample, for a text file
    // that opens with a log excerpt.
    return (
      this.sampledLines >= CONTENT_EARLY_LOG_MIN_LINES &&
      logScore / this.sampledLines >= CONTENT_EARLY_LOG_MIN_RATIO
    );
  }

  /** The classification of the lines added so far. */
  result(): ContentClassification {
    return {
      kind: decideKind(this.logScore(), this.textLines, this.sampledLines),
      logLines: this.strongLogLines + this.weakLogLines,
      textLines: this.textLines,
      sampledLines: this.sampledLines,
    };
  }

  // A weak signal (an "error" in a line) is common in code and prose, so it
  // counts for less than a timestamp or a stack frame when text is judged.
  private logScore(): number {
    return this.strongLogLines + this.weakLogLines * WEAK_LOG_WEIGHT;
  }
}

/**
 * Decide whether the leading lines of an input are log output or plain text
 * (prose, markup, source code, configuration, data).
 *
 * Only the first DEFAULT_CONTENT_SAMPLE_LINES non-blank lines, up to
 * DEFAULT_CONTENT_SAMPLE_BYTES, are scored. When the sample does not clearly
 * look like text the result is 'log', so unrecognised formats keep today's
 * behaviour of being compressed.
 */
export function classifyContent(
  lines: readonly string[],
  limits: ContentSampleLimits = DEFAULT_CONTENT_SAMPLE_LIMITS,
): ContentClassification {
  const sampler = new ContentSampler(limits);
  for (const line of lines) {
    if (sampler.isFull()) {
      break;
    }
    sampler.add(line);
  }
  return sampler.result();
}
