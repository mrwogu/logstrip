import {
  SCORE_KEEP_THRESHOLD,
  TFIDF_PENALTY,
  TFIDF_REPEAT_THRESHOLD,
} from '../constants.js';
import type { Aggressiveness } from '../types.js';

const IGNORED_LOG_TAG_PATTERN =
  /\[(?:INFO|DEBUG|TRACE|VERBOSE)\]|"level"\s*:\s*"(?:info|debug|trace|verbose)"/iu;
const IMPORTANT_LOG_TAG_PATTERN = /\[(?:ERROR|WARN|FATAL|CRITICAL|FAIL)\]/iu;
const EXPLICIT_LOG_TAG_PATTERN = /\[[A-Z]+\]/iu;
const STACK_FRAME_PATTERN = /^\s*at\s+.*(?:\(|\s).+:\d+:\d+\)?$/;
const JAVA_STACK_FRAME_PATTERN = /^\s*at\s+[\w$_.<>/]+\([^)]+:\d+\)$/;
const PYTHON_STACK_FRAME_PATTERN =
  /^\s*File\s+"[^"]+",\s+line\s+\d+,\s+in\s+.+$/;
const GO_STACK_FRAME_PATTERN =
  /^\s*(?:(?:[\w.-]+\/)+[\w./-]+|[\w.-]+\.\(\*?[\w.]+\)\.[\w.]+|[\w.-]+\.[A-Z]\w*)\(.*\)$/;
const GO_FILE_FRAME_PATTERN =
  /^\s*(?:\/[^\s]+|[A-Za-z]:[\\/][^\s]+):\d+(?:\s+\+\S+)?$/;
const GO_GOROUTINE_PATTERN = /^\s*goroutine\s+\d+\s+\[.+\]:$/iu;
const PYTHON_TRACEBACK_PATTERN = /^Traceback \(most recent call last\):$/;
const STACK_MORE_PATTERN = /^\s*\.\.\. \d+ more$/;
const GITHUB_ACTIONS_ANNOTATION_PATTERN = /^::(?:error|warning|notice)\b/u;
const GRADLE_FAILURE_PATTERN =
  /\b(?:Execution failed|What went wrong|BUILD FAILED|Task failed with an exception)\b/iu;
const MAKE_ERROR_PATTERN = /^make[:\s*]+/u;
const GO_TEST_FAIL_PATTERN = /---\s*FAIL:/u;
const SYSTEMD_STATUS_PATTERN =
  /\b(?:Failed to start|Failed to load|Failed to listen|Failed to mount|Failed to open|Failed to connect|status=\d+\s+\w+)\b/iu;
const CIRCLECI_STEP_PATTERN = /\b(?:Spin Cancelled|Step failed|job was not approved)\b/iu;
const JENKINS_MARKER_PATTERN = /\[(?:Pipeline|Checks|FCMaker)\]/u;
const AZURE_PIPELINE_PATTERN = /^##vso\[task\.(?:LogIssue|Complete)\b/u;
const TEAMCITY_MARKER_PATTERN = /^##teamcity\[(?:buildProblem|compilationFinished|message)\b/u;
const DIAGNOSTIC_PATTERN =
  /\b(?:Error|Exception|AssertionError|TypeError|ReferenceError|SyntaxError|RangeError|NullPointerException|Unhandled|failed|failure|fatal|panic|refused|timeout|timed\s+out|unreachable|unavailable|disconnected|killed|aborted|crashed|terminated|unauthorized)\b/iu;
const JSON_SEVERITY_PATTERN =
  /"(?:level|severity)"\s*:\s*"(?:fatal|error|critical|warn|warning)"/iu;
const NPM_ERROR_PATTERN = /\b(?:npm|pnpm)\s+ERR!/iu;
const YARN_ERROR_PATTERN = /\byarn\s+error\b/iu;
const SCANNER_FINDING_PATTERN =
  /\b(?:CVE-\d{4}-\d{4,7}|GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}|vulnerabilit(?:y|ies)|severity:\s*(?:critical|high|medium)|(?:critical|high)\s+severity)\b/iu;
const CONTAINER_FAILURE_PATTERN =
  /\b(?:CrashLoopBackOff|ImagePullBackOff|ErrImagePull|OOMKilled|Back[- ]off restarting failed container|failed to pull image|(?:containerd|runc).*?(?:failed|error|panic|timeout|refused)|(?:failed|error|panic|timeout|refused).*?(?:containerd|runc)|rpc error: code = Unknown desc = failed to resolve reference)\b/iu;
const INTERNAL_STACK_PATTERN =
  /(?:node_modules[\\/]|node:internal|internal[\\/]modules|bootstrap_node|[\\/]usr[\\/]lib[\\/]|[\\/]usr[\\/]local[\\/]lib[\\/]|[\\/]usr[\\/]local[\\/]go[\\/]src[\\/]runtime[\\/]|site-packages[\\/]|dist-packages[\\/]|\.venv[\\/]|java\.base[\\/]|jdk\.internal|org\.springframework\.|[\\/]pkg[\\/]mod[\\/]|\.cargo[\\/]registry[\\/])/iu;

const LOW_EXTRA_TAG_PATTERN = /\[(?:NOTICE|STATUS)\]/iu;
const AGGRESSIVE_WARN_PATTERN = /\[(?:WARN|WARNING)\]/iu;
const AGGRESSIVE_WARNING_SIGNAL_PATTERN = DIAGNOSTIC_PATTERN;

export function isIgnoredLogLine(line: string): boolean {
  return IGNORED_LOG_TAG_PATTERN.test(line);
}

export function shouldKeepLine(line: string): boolean {
  if (line.trim().length === 0) {
    return false;
  }

  if (isIgnoredLogLine(line)) {
    return false;
  }

  if (IMPORTANT_LOG_TAG_PATTERN.test(line)) {
    return true;
  }

  if (!EXPLICIT_LOG_TAG_PATTERN.test(line) && looksLikeDiagnosticLine(line)) {
    return true;
  }

  return false;
}

export function looksLikeDiagnosticLine(line: string): boolean {
  return (
    STACK_FRAME_PATTERN.test(line) ||
    JAVA_STACK_FRAME_PATTERN.test(line) ||
    PYTHON_STACK_FRAME_PATTERN.test(line) ||
    GO_STACK_FRAME_PATTERN.test(line) ||
    GO_FILE_FRAME_PATTERN.test(line) ||
    GO_GOROUTINE_PATTERN.test(line) ||
    PYTHON_TRACEBACK_PATTERN.test(line) ||
    STACK_MORE_PATTERN.test(line) ||
    DIAGNOSTIC_PATTERN.test(line) ||
    JSON_SEVERITY_PATTERN.test(line) ||
    NPM_ERROR_PATTERN.test(line) ||
    YARN_ERROR_PATTERN.test(line) ||
    SCANNER_FINDING_PATTERN.test(line) ||
    CONTAINER_FAILURE_PATTERN.test(line) ||
    GITHUB_ACTIONS_ANNOTATION_PATTERN.test(line) ||
    GRADLE_FAILURE_PATTERN.test(line) ||
    MAKE_ERROR_PATTERN.test(line) ||
    GO_TEST_FAIL_PATTERN.test(line) ||
    SYSTEMD_STATUS_PATTERN.test(line) ||
    CIRCLECI_STEP_PATTERN.test(line) ||
    JENKINS_MARKER_PATTERN.test(line) ||
    AZURE_PIPELINE_PATTERN.test(line) ||
    TEAMCITY_MARKER_PATTERN.test(line)
  );
}

export function isInternalStackTraceLine(line: string): boolean {
  if (IMPORTANT_LOG_TAG_PATTERN.test(line)) return false;
  return looksLikeDiagnosticLine(line) && INTERNAL_STACK_PATTERN.test(line);
}

export function estimateTokens(wordCount: number): number {
  return Math.ceil(wordCount * 1.3);
}

export function scoreLineRelevance(
  line: string,
  aggressiveness: Aggressiveness,
  seenCount = 0,
): number {
  if (line.trim().length === 0) return -Infinity;

  if (isIgnoredLogLine(line)) return -Infinity;

  let score = 0;

  if (IMPORTANT_LOG_TAG_PATTERN.test(line)) score += 100;
  if (JSON_SEVERITY_PATTERN.test(line)) score += 80;
  if (SCANNER_FINDING_PATTERN.test(line)) score += 70;
  if (CONTAINER_FAILURE_PATTERN.test(line)) score += 70;
  if (GITHUB_ACTIONS_ANNOTATION_PATTERN.test(line)) score += 70;
  if (GRADLE_FAILURE_PATTERN.test(line)) score += 60;
  if (NPM_ERROR_PATTERN.test(line) || YARN_ERROR_PATTERN.test(line)) score += 60;
  if (DIAGNOSTIC_PATTERN.test(line)) score += 50;
  if (GO_TEST_FAIL_PATTERN.test(line)) score += 50;
  if (MAKE_ERROR_PATTERN.test(line)) score += 50;
  if (SYSTEMD_STATUS_PATTERN.test(line)) score += 50;
  if (CIRCLECI_STEP_PATTERN.test(line)) score += 50;
  if (JENKINS_MARKER_PATTERN.test(line)) score += 40;
  if (AZURE_PIPELINE_PATTERN.test(line)) score += 40;
  if (TEAMCITY_MARKER_PATTERN.test(line)) score += 40;

  if (
    STACK_FRAME_PATTERN.test(line) ||
    JAVA_STACK_FRAME_PATTERN.test(line) ||
    PYTHON_STACK_FRAME_PATTERN.test(line) ||
    GO_STACK_FRAME_PATTERN.test(line) ||
    GO_FILE_FRAME_PATTERN.test(line) ||
    GO_GOROUTINE_PATTERN.test(line) ||
    PYTHON_TRACEBACK_PATTERN.test(line) ||
    STACK_MORE_PATTERN.test(line)
  ) {
    score += 40;
  }

  if (
    aggressiveness === 'aggressive' &&
    AGGRESSIVE_WARN_PATTERN.test(line) &&
    !AGGRESSIVE_WARNING_SIGNAL_PATTERN.test(line)
  ) {
    score = -1;
  }

  if (aggressiveness === 'low' && LOW_EXTRA_TAG_PATTERN.test(line)) {
    score += 30;
  }

  if (seenCount >= TFIDF_REPEAT_THRESHOLD) {
    score -= TFIDF_PENALTY * (seenCount - TFIDF_REPEAT_THRESHOLD + 1);
  }

  return score;
}
