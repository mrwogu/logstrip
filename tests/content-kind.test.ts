import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_EARLY_LOG_MIN_LINES,
  CONTENT_EARLY_LOG_MIN_RATIO,
  CONTENT_LINE_SCAN_LIMIT,
  CONTENT_TEXT_MAX_LOG_RATIO,
  CONTENT_TEXT_MIN_LINES,
  CONTENT_TEXT_MIN_RATIO,
  DEFAULT_CONTENT_SAMPLE_BYTES,
  DEFAULT_CONTENT_SAMPLE_LINES,
} from '../src/core/constants';
import {
  ContentSampler,
  classifyContent,
  isContentSampleFull,
  type ContentClassification,
  type ContentKind,
} from '../src/core/detection/content-kind';

const ROOT_DIR = resolve(__dirname, '..');
const FIXTURES_DIR = join(__dirname, 'fixtures');

function splitLines(text: string): string[] {
  return text.split(/\r?\n/u);
}

function readRepoLines(relativePath: string): string[] {
  return splitLines(readFileSync(join(ROOT_DIR, relativePath), 'utf8'));
}

function listLogFixtures(directory: string): string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.log'))
    .sort()
    .map((name) => join(directory, name));
}

function kindOf(lines: readonly string[]): ContentKind {
  return classifyContent(lines).kind;
}

function classifyLine(line: string): ContentClassification {
  return classifyContent([line]);
}

// ---- Corpus: inline text samples ----

const PROSE_PARAGRAPH = [
  'LogStrip reads a log from a file or from standard input and prints a shorter version of it.',
  'It removes lines that carry no diagnostic value, such as routine startup messages and progress bars.',
  'Repeated errors are folded into a single line with a counter, so that a failing build stays readable.',
  'The result is meant to be pasted into a chat with a language model, where every token counts.',
];

const WRAPPED_PROSE = [
  'The quick brown fox jumps over the lazy dog and keeps running through',
  'the forest until it reaches the river where it stops to drink some water',
  'before it continues on its long journey towards the mountains in the north',
  'where the snow never melts and the wind blows across the frozen lakes all year',
];

const NOTES_TXT = [
  'meeting notes monday',
  'talk to the platform team about the deploy pipeline',
  'ask maria about the budget for next quarter',
  'remember to renew the domain before friday',
  'call the dentist',
  'buy milk and coffee',
];

const DOCKERFILE = [
  '# syntax=docker/dockerfile:1',
  'FROM node:20-alpine AS build',
  'WORKDIR /app',
  'COPY package*.json ./',
  'RUN npm ci --ignore-scripts',
  'COPY . .',
  'RUN npm run build',
  '',
  'FROM node:20-alpine',
  'ENV NODE_ENV=production',
  'COPY --from=build /app/dist ./dist',
  'EXPOSE 3000',
  'USER node',
  'CMD ["node", "dist/index.js"]',
];

const SHELL_SCRIPT = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  '',
  'APP_DIR="${1:-/srv/app}"',
  'cd "$APP_DIR"',
  '',
  'if [ ! -d node_modules ]; then',
  '  npm ci',
  'fi',
  '',
  'for env in staging production; do',
  '  echo "deploying to $env"',
  '  ./scripts/deploy.sh "$env"',
  'done',
];

const HTML_SNIPPET = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '  <head>',
  '    <meta charset="utf-8">',
  '    <title>Dashboard</title>',
  '    <link rel="stylesheet" href="style.css">',
  '  </head>',
  '  <body>',
  '    <div class="container">',
  '      <h1>Hello</h1>',
  '      <p>Welcome back.</p>',
  '    </div>',
  '  </body>',
  '</html>',
];

const CSV_ROWS = [
  'id,name,email,age,city',
  '1,Alice Smith,alice@example.com,34,New York',
  '2,Bob Jones,bob@example.com,28,Chicago',
  '3,Carol White,carol@example.com,41,Boston',
  '4,Dan Brown,dan@example.com,39,Seattle',
];

const JSON_CONFIG = [
  '{',
  '  "name": "my-app",',
  '  "version": "1.2.3",',
  '  "private": true,',
  '  "scripts": {',
  '    "build": "tsc -p tsconfig.json",',
  '    "test": "vitest run"',
  '  },',
  '  "dependencies": {',
  '    "express": "^4.18.2",',
  '    "zod": "^3.22.4"',
  '  }',
  '}',
];

const YAML_CONFIG = [
  'name: ci',
  'on:',
  '  push:',
  '    branches: [main]',
  'jobs:',
  '  test:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '      - run: npm ci',
  '      - run: npm test',
];

const REQUIREMENTS_TXT = [
  'numpy==1.26.4',
  'pandas>=2.0,<3.0',
  'requests[socks]==2.31.0',
  'pytest~=8.0',
];

const CMAKE_LISTS = [
  'cmake_minimum_required(VERSION 3.10)',
  'project(MyApp VERSION 1.0 LANGUAGES CXX)',
  '',
  'set(CMAKE_CXX_STANDARD 17)',
  'add_executable(myapp src/main.cpp src/util.cpp)',
  'target_link_libraries(myapp PRIVATE fmt::fmt)',
];

const ENV_FILE = [
  'DATABASE_URL=postgres://user:pass@localhost:5432/app',
  'REDIS_URL=redis://localhost:6379',
  'LOG_LEVEL=debug',
  'PORT=3000',
];

const GITIGNORE = ['node_modules/', 'dist/', 'coverage/', '*.tgz', '.env', '.DS_Store'];

const PYTHON_SCRIPT = [
  'import os',
  'import sys',
  'from pathlib import Path',
  '',
  '',
  'def main(argv):',
  '    path = Path(argv[1])',
  '    if not path.exists():',
  '        print("missing file")',
  '        return 1',
  '    for line in path.read_text().splitlines():',
  '        print(line.upper())',
  '    return 0',
];

const SQL_QUERY = [
  'SELECT u.id, u.email, COUNT(o.id) AS orders',
  'FROM users u',
  'LEFT JOIN orders o ON o.user_id = u.id',
  "WHERE u.created_at > '2024-01-01'",
  'GROUP BY u.id, u.email',
  'ORDER BY orders DESC',
  'LIMIT 50;',
];

const MARKDOWN_WITH_LOG_EXCERPT = [
  '# Debugging a failed build',
  '',
  'When the build fails, copy the relevant part of the output into the issue.',
  'For example:',
  '',
  '```',
  '2024-01-15 10:23:45.123 [ERROR] request failed',
  '2024-01-15 10:23:46.456 [ERROR] request failed',
  '2024-01-15 10:23:47.789 [ERROR] request failed',
  '2024-01-15 10:23:48.012 [WARN] retrying',
  '```',
  '',
  '- Check the exit code.',
  '- Attach the full log.',
];

const TEXT_SAMPLES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['README.md', readRepoLines('README.md')],
  ['CONTRIBUTING.md', readRepoLines('CONTRIBUTING.md')],
  ['docs/reference/cli.md', readRepoLines('docs/reference/cli.md')],
  ['docs/guides/security.md', readRepoLines('docs/guides/security.md')],
  ['src/core/types.ts', readRepoLines('src/core/types.ts')],
  ['src/cli/index.ts', readRepoLines('src/cli/index.ts')],
  ['src/core/logstrip-parser.ts', readRepoLines('src/core/logstrip-parser.ts')],
  ['.github/workflows/ci.yml', readRepoLines('.github/workflows/ci.yml')],
  ['package.json', readRepoLines('package.json')],
  ['prose paragraph', PROSE_PARAGRAPH],
  ['hard-wrapped prose', WRAPPED_PROSE],
  ['free-form notes', NOTES_TXT],
  ['Dockerfile', DOCKERFILE],
  ['shell script', SHELL_SCRIPT],
  ['HTML snippet', HTML_SNIPPET],
  ['CSV', CSV_ROWS],
  ['JSON config', JSON_CONFIG],
  ['YAML config', YAML_CONFIG],
  ['requirements.txt', REQUIREMENTS_TXT],
  ['CMakeLists.txt', CMAKE_LISTS],
  ['.env file', ENV_FILE],
  ['.gitignore', GITIGNORE],
  ['Python script', PYTHON_SCRIPT],
  ['SQL query', SQL_QUERY],
  ['markdown with a log excerpt in a fence', MARKDOWN_WITH_LOG_EXCERPT],
];

describe('classifyContent: text corpus', () => {
  it.each(TEXT_SAMPLES)('classifies %s as text', (_name, lines) => {
    const result = classifyContent(lines);

    expect(result.kind).toBe('text');
    expect(result.textLines).toBeGreaterThanOrEqual(CONTENT_TEXT_MIN_LINES);
    expect(result.textLines / result.sampledLines).toBeGreaterThanOrEqual(
      CONTENT_TEXT_MIN_RATIO,
    );
  });
});

// ---- Corpus: logs ----

const FIXTURE_FILES = listLogFixtures(FIXTURES_DIR);
const SOURCE_FIXTURE_FILES = listLogFixtures(join(FIXTURES_DIR, 'sources'));

const TINY_LOG = [
  '[INFO] boot ok',
  '[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed',
  '[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed',
];

const PROSE_BANNER_LINES = Array.from(
  { length: 10 },
  (_, index) =>
    `This report line number ${index + 1} was written for people who read the nightly build summary.`,
);

const BANNER_LOG_LINES = Array.from(
  { length: 90 },
  (_, index) =>
    `2024-01-15 10:23:${String(index % 60).padStart(2, '0')}.${String(index).padStart(3, '0')} [${index % 3 === 0 ? 'ERROR' : 'INFO'}] step ${index} finished`,
);

const UNSTRUCTURED_LOGS: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    'apt-get install',
    [
      'Reading package lists... Done',
      'Building dependency tree... Done',
      'The following NEW packages will be installed:',
      '  curl libbrotli1 libcurl4 libnghttp2-14',
      '0 upgraded, 4 newly installed, 0 to remove and 3 not upgraded.',
      'Get:1 http://archive.ubuntu.com/ubuntu jammy/main amd64 libbrotli1 amd64 1.0.9-2build6 [315 kB]',
      'Fetched 1,053 kB in 1s (1,208 kB/s)',
      'Selecting previously unselected package libbrotli1:amd64.',
      'Unpacking libbrotli1:amd64 (1.0.9-2build6) ...',
      'Setting up curl (7.81.0-1ubuntu1.20) ...',
      'E: Unable to locate package nonexistent',
    ],
  ],
  [
    'terraform plan',
    [
      'Terraform will perform the following actions:',
      '',
      '  # aws_instance.web will be created',
      '  + resource "aws_instance" "web" {',
      '      + ami           = "ami-0c55b159cbfafe1f0"',
      '      + instance_type = "t2.micro"',
      '    }',
      '',
      'Plan: 1 to add, 0 to change, 0 to destroy.',
      'aws_instance.web: Creating...',
      'aws_instance.web: Creation complete after 14s [id=i-0abc123]',
    ],
  ],
  [
    'cargo build',
    [
      '   Compiling libc v0.2.150',
      '   Compiling myapp v0.1.0 (/home/user/myapp)',
      'error[E0425]: cannot find value `x` in this scope',
      ' --> src/main.rs:4:20',
      '  |',
      '4 |     println!("{}", x);',
      '  |                    ^ not found in this scope',
      '  = note: `#[warn(unused_variables)]` on by default',
      'error: could not compile `myapp` due to 1 previous error',
    ],
  ],
  [
    'gradle failure',
    [
      '> Task :app:compileJava FAILED',
      '',
      'FAILURE: Build failed with an exception.',
      '',
      '* What went wrong:',
      "Execution failed for task ':app:compileJava'.",
      '> Compilation failed; see the compiler error output for details.',
      '',
      '* Try:',
      '> Run with --stacktrace option to get the stack trace.',
      'BUILD FAILED in 4s',
    ],
  ],
  [
    'pytest session',
    [
      '============================= test session starts ==============================',
      'platform linux -- Python 3.12.1, pytest-8.0.0, pluggy-1.4.0',
      'collected 12 items',
      '',
      'tests/test_a.py ....                                                     [ 33%]',
      'tests/test_b.py ..F.                                                     [ 66%]',
      '=================================== FAILURES ===================================',
      '    def test_create_order(client):',
      '>       response = client.post("/orders", json={"qty": 1})',
      'E       assert 500 == 201',
      'tests/test_b.py:42: AssertionError',
      '========================= 1 failed, 11 passed in 0.52s =========================',
    ],
  ],
  [
    'go test',
    [
      '=== RUN   TestAdd',
      '--- PASS: TestAdd (0.00s)',
      '=== RUN   TestDivide',
      '    calc_test.go:21: expected 2, got 0',
      '--- FAIL: TestDivide (0.00s)',
      'FAIL',
      'exit status 1',
      'FAIL\texample.com/calc\t0.004s',
    ],
  ],
  [
    'node crash with an object dump',
    [
      'node:internal/modules/cjs/loader:1386',
      '  throw err;',
      '  ^',
      "Error: Cannot find module './missing'",
      'Require stack:',
      '- /repo/index.js',
      '    at Function._resolveFilename (node:internal/modules/cjs/loader:1383:15)',
      '    at Function._load (node:internal/modules/cjs/loader:1192:37)',
      '    at Module.require (node:internal/modules/cjs/loader:1463:12) {',
      "  code: 'MODULE_NOT_FOUND',",
      "  requireStack: [ '/repo/index.js' ]",
      '}',
      'Node.js v22.22.0',
    ],
  ],
  [
    'node:test TAP output',
    [
      'TAP version 13',
      '# Subtest: tests',
      'not ok 1 - tests',
      '  ---',
      '  duration_ms: 64.09',
      "  failureType: 'testCodeFailure'",
      '  ...',
      '1..1',
      '# tests 1',
      '# pass 0',
      '# fail 1',
      '# duration_ms 79.12',
    ],
  ],
  [
    'unstructured application output',
    [
      'Starting application server',
      'Loading configuration from /etc/app/config.yaml',
      'Connecting to database',
      'Connection established',
      'Listening on port 3000',
      'Processing background job number 42',
      'Shutting down the application server gracefully',
    ],
  ],
  [
    'npm script echo',
    [
      '> logstrip@1.12.0 build',
      '> tsc -p tsconfig.build.json && node scripts/post-build.js',
      '',
      'src/index.ts(12,5): error TS2322: Type string is not assignable to type number.',
    ],
  ],
];

describe('classifyContent: log corpus', () => {
  it.each(FIXTURE_FILES.map((file) => [file.slice(ROOT_DIR.length + 1), file]))(
    'classifies %s as log',
    (_name, file) => {
      const result = classifyContent(splitLines(readFileSync(file, 'utf8')));

      expect(result.kind).toBe('log');
    },
  );

  it('covers the whole sources fixture directory', () => {
    expect(SOURCE_FIXTURE_FILES.length).toBeGreaterThan(600);
    expect(FIXTURE_FILES.length).toBeGreaterThan(40);

    const failures = SOURCE_FIXTURE_FILES.filter(
      (file) =>
        classifyContent(splitLines(readFileSync(file, 'utf8'))).kind !== 'log',
    );

    expect(failures).toEqual([]);
  });

  it('classifies a tiny 3-line log as log', () => {
    const result = classifyContent(TINY_LOG);

    expect(result.kind).toBe('log');
    expect(result.logLines).toBe(3);
    expect(result.textLines).toBe(0);
    expect(result.sampledLines).toBe(3);
  });

  it('keeps a log that starts with a short prose banner as log', () => {
    const lines = [...PROSE_BANNER_LINES, ...BANNER_LOG_LINES];
    const result = classifyContent(lines);

    expect(result.sampledLines).toBe(100);
    expect(result.textLines).toBeGreaterThanOrEqual(10);
    expect(result.kind).toBe('log');
  });

  it.each(UNSTRUCTURED_LOGS)('classifies %s as log', (_name, lines) => {
    expect(kindOf(lines)).toBe('log');
  });

  it('classifies a pretty-printed JSON test report as log', () => {
    const report = splitLines(
      readFileSync(join(FIXTURES_DIR, 'json-test-report.log'), 'utf8'),
    );

    expect(kindOf(report)).toBe('log');
  });
});

describe('classifyContent: defaults to log when unsure', () => {
  it('returns log with zero counts for empty input', () => {
    expect(classifyContent([])).toEqual({
      kind: 'log',
      logLines: 0,
      textLines: 0,
      sampledLines: 0,
    });
  });

  it('ignores blank and whitespace-only lines', () => {
    expect(classifyContent(['', '   ', '\t', ''])).toEqual({
      kind: 'log',
      logLines: 0,
      textLines: 0,
      sampledLines: 0,
    });
  });

  it('returns log for lines with no recognisable signal', () => {
    const result = classifyContent(['alpha', 'beta', 'gamma', 'delta']);

    expect(result.kind).toBe('log');
    expect(result.sampledLines).toBe(4);
    expect(result.logLines).toBe(0);
    expect(result.textLines).toBe(0);
  });

  it('needs a minimum number of text lines before it says text', () => {
    expect(CONTENT_TEXT_MIN_LINES).toBe(2);
    expect(kindOf(['# Title'])).toBe('log');
    expect(kindOf(['# Title', '## Subtitle'])).toBe('text');
  });

  it('needs text lines to be at least the minimum ratio of the sample', () => {
    const below = ['# Title', '## Subtitle', 'alpha', 'beta', 'gamma', 'delta'];
    const atThreshold = ['# Title', '## Subtitle', 'alpha', 'beta'];

    expect(kindOf(below)).toBe('log');
    expect(kindOf(atThreshold)).toBe('text');
  });

  it('turns a text sample into a log when log lines are too common', () => {
    const headings = Array.from({ length: 17 }, (_, index) => `## Section ${index}`);
    const logs = (count: number): string[] => Array(count).fill('[ERROR] boom');

    // 3 of 20 lines is exactly the allowed ratio; 4 of 21 is over it.
    expect(CONTENT_TEXT_MAX_LOG_RATIO).toBe(0.15);
    expect(kindOf([...headings, ...logs(3)])).toBe('text');
    expect(kindOf([...headings, ...logs(4)])).toBe('log');
  });
});

// ---- Per-line signals ----

// A table of one-line samples is written as text, one case per line:
// "name | text". The text is everything after the first " | ", so it may
// contain more of them. Rows of the same shape in a long array make the file
// read as copy and paste to a duplication detector.
function lineCases(table: string): ReadonlyArray<readonly [string, string]> {
  return table
    .split('\n')
    .filter((row) => row !== '')
    .map((row) => {
      const at = row.indexOf(' | ');
      return [row.slice(0, at), row.slice(at + 3)] as const;
    });
}

const STRONG_LOG_LINES = lineCases(`
ANSI escape | \u001b[31mbuild failed\u001b[0m
ISO timestamp | 2024-01-15T10:23:45.123Z worker started
space separated timestamp | 2024-01-15 10:23:45 something happened
slash date timestamp | 2024/01/15 10:23:45 [notice] 1#1: start worker
syslog timestamp | Jan 15 10:23:45 host sshd[812]: Accepted publickey
apache error timestamp | [Mon Jan 15 10:23:45.123456 2024] [core:notice] AH00094
common log format date | host - - [15/Jan/2024:10:23:45 +0000] "x" 200 12
clock with milliseconds | build step finished at 10:23:45.123
bare leading clock | [10:23:45] Starting build
epoch seconds | 1700000000 request served
epoch milliseconds in brackets | [1700000000123] tick
bracketed severity | [INFO] boot ok
lower-case bracketed severity | [error] upstream timed out
upper-case severity with colon | ERROR: boom
upper-case severity word | INFO  Starting service
python logging prefix | WARNING:root:disk almost full
compiler error | error: expected ';' before '}' token
compiler warning with location | src/main.c:12:5: warning: unused variable 'x'
rust error code | error[E0425]: cannot find value \`x\` in this scope
npm error | npm ERR! code ELIFECYCLE
npm warning | npm WARN deprecated foo@1.0.0: use bar
yarn error | yarn error Command failed with exit code 1.
github actions annotation | ::error::Something broke
github actions group | ##[group]Run npm ci
azure pipelines command | ##vso[task.logissue type=error]failed
jenkins pipeline marker | [Pipeline] sh
jest FAIL |  FAIL  tests/a.test.ts
jest PASS | PASS src/a.test.ts (1.2 s)
go test ok | ok  \texample.com/pkg\t0.004s
vitest RUN banner |  RUN  v1.0.0 /repo
docker step | Step 3/10 : RUN npm ci
make directory | make[1]: Entering directory '/home/user/proj'
buildkit step | #5 [2/6] RUN npm ci
go test failure | --- FAIL: TestFoo (0.00s)
go test run | === RUN   TestFoo
gradle task | > Task :app:compileJava
npm debug log | 12 verbose cli /usr/bin/node /usr/bin/npm
test status mark | ✓ renders the page
TAP ok | ok 1 - adds numbers
TAP not ok | not ok 2 - subtracts numbers
TAP version | TAP version 13
TAP plan | 1..4
TAP summary | # tests 4
TAP subtest | # Subtest: math
npm script header | > logstrip@1.12.0 build
gradle failure summary | * What went wrong:
gradle build result | BUILD FAILED in 4s
gradle task count | 2 actionable tasks: 2 executed
cargo compiling | Compiling serde v1.0.193
rustc location |  --> src/main.rs:4:20
rustc note |   = note: \`#[warn(unused_variables)]\` on by default
apt fetch | Get:1 http://archive.ubuntu.com/ubuntu jammy/main amd64 curl
apt setup | Setting up curl (7.81.0-1ubuntu1.20) ...
apt error | E: Unable to locate package foo
terraform plan action |   # aws_instance.web will be created
terraform plan summary | Plan: 1 to add, 0 to change, 0 to destroy.
terraform progress | aws_instance.web: Creating...
terraform error box | │ Error: creating S3 Bucket
pytest banner | ============================= test session starts ==============================
progress percentage | tests/test_b.py ..F.                      [ 66%]
exit status | process exited with code 1
exception header | TypeError: Cannot read properties of undefined
qualified exception header | java.lang.IllegalStateException: boom
bare error header | Error: connect ECONNREFUSED 127.0.0.1:5432
python traceback | Traceback (most recent call last):
caused by | Caused by: java.io.IOException: disk full
go goroutine | goroutine 1 [running]:
rust panic | thread 'main' panicked at src/main.rs:2:5:
java thread exception | Exception in thread "main" java.lang.Error
go panic | panic: runtime error: index out of range
elided frames | ... 12 more
syslog process tag | sshd[812]: Accepted publickey for deploy
pid bracket | worker [pid 4521] ready
thread bracket | [http-nio-8080-exec-1] handled request
access log | 10.0.0.1 - - "GET /health HTTP/1.1" 200 12
javascript frame |     at Object.<anonymous> (/repo/src/a.js:10:5)
java frame |     at com.example.Foo.bar(Foo.java:42)
python frame |   File "/repo/a.py", line 3, in main
internal library path | Error in node_modules/foo/lib/index.js while loading
json log line | {"level":"info","msg":"started"}
syslog record | <34>1 2024-01-15T10:23:45Z host app - - - hello
logfmt record | level=info msg=started port=8080
two-pair logfmt record | level=info msg=started
json property that mentions a failure |       "status": "failed",
`);

const TEXT_LINES = lineCases(`
markdown heading | ## Installation
markdown table row | | Flag | Meaning |
markdown table separator | --- | ---
markdown bullet | - first point
markdown numbered item | 2. Run the tests
markdown blockquote | > Note that this is a quote.
markdown link | See [the guide](https://example.com/guide) for details
markdown image | ![logo](assets/logo.svg)
markdown autolink | Docs live at <https://example.com/docs>
markdown bold | Use **strict mode** everywhere
markdown rule | ---
const declaration | const answer = 42;
export function | export function run(): void {
class declaration | class Parser extends Base {
interface declaration | interface Options
type alias | export type Mode = "a" | "b";
es import | import { readFile } from 'node:fs';
python import | from pathlib import Path
c include | #include <stdio.h>
rust use | use std::collections::HashMap;
python def | def main(argv):
rust fn | pub fn run() -> Result<()> {
access modifier |   public static void main(String[] args) {
else branch | } else {
if statement |   if (value === undefined) {
python if |     if not path.exists():
return statement |     return result;
raise statement |         raise ValueError(message)
ruby attr |     attr_reader :options
lone end |   end
semicolon ending | let total = 0;
lone closing brace |   }
lone closing bracket with comma | ],
slash comment |   // keep the sample small
block comment line |  * @returns the kind
hash comment |     # explain the next step
decorator | @Component({ selector: "app" })
arrow function | const add = (a, b) => a + b
import list entry |   createReadStream,
string literal entry |   'low', 'medium', 'high',
quoted key |   'max-tokens': { type: 'string' },
ternary continuation |       ? parsed.values.config
bare call | print(value)
html tag | <div class="container">
html closing tag | </section>
yaml key | site_name: LogStrip
yaml list item | - name: checkout
indented yaml key |   runs-on: ubuntu-latest
json property |   "version": "1.2.3",
ini section | [database]
array literal line |   ['ava', ['ava test']],
assignment | timeout = 30
env assignment | LOG_LEVEL=debug
dependency spec | numpy>=1.24
path line | node_modules/
glob line | *.tgz
dotfile line | .DS_Store
cli usage line |   -o, --output <path>   Write the result to path
sql select | SELECT id, email FROM users
dockerfile instruction | COPY package*.json ./
shebang | #!/usr/bin/env bash
shell strict mode | set -euo pipefail
shell for loop | for file in *.log; do
shell continuation |     --no-cache \\
shell chained command |     && npm run build
prose sentence | The parser keeps the first sample of every stream in memory.
hard-wrapped prose | before it continues on its long journey towards the mountains in the north
csv row | a,b,c,d
padded csv row | 0, 0xc816921f
`);

describe('classifyContent: log signals', () => {
  it.each(STRONG_LOG_LINES)('treats %s as a log line', (_name, line) => {
    const result = classifyLine(line);

    expect(result.logLines).toBe(1);
    expect(result.textLines).toBe(0);
  });

  it('does not take a bracketed word followed by a link target for a severity tag', () => {
    expect(classifyLine('[info](https://example.com/info)')).toMatchObject({
      logLines: 0,
      textLines: 1,
    });
  });

  it('ignores log shapes inside a quoted string in source code', () => {
    const result = classifyLine("  expect(level('[ERROR] boom')).toBe('error');");

    expect(result.logLines).toBe(0);
    expect(result.textLines).toBe(1);
  });

  it('does not take a lone key=value pair for logfmt', () => {
    expect(classifyLine('PORT=3000')).toMatchObject({ logLines: 0, textLines: 1 });
  });

  it('does not take a Go style call for a stack frame', () => {
    expect(classifyLine('foo.Run(0x1, 0x2)')).toMatchObject({
      logLines: 0,
      textLines: 1,
    });
  });
});

describe('classifyContent: text signals', () => {
  it.each(TEXT_LINES)('treats %s as a text line', (_name, line) => {
    const result = classifyLine(line);

    expect(result.textLines).toBe(1);
    expect(result.logLines).toBe(0);
  });

  it('does not take a JSON property without a diagnostic word for a log line', () => {
    expect(classifyLine('  "name": "my-app",')).toMatchObject({
      logLines: 0,
      textLines: 1,
    });
  });

  it('does not take a two-field line with letters only for CSV', () => {
    // "yes, no" would otherwise look like a two-token CSV row.
    expect(classifyLine('yes, no')).toMatchObject({ logLines: 0, textLines: 0 });
  });

  it('does not take a short sentence for prose', () => {
    expect(classifyLine('Build done.')).toMatchObject({ logLines: 0, textLines: 0 });
  });

  it('does not take a long line with many symbols for wrapped prose', () => {
    const line = 'one two three four five six seven eight nine ten 11 12 13 14 15 16';

    expect(classifyLine(line)).toMatchObject({ logLines: 0, textLines: 0 });
  });
});

describe('classifyContent: weak log signals', () => {
  const WEAK_LOG_LINES: ReadonlyArray<readonly [string, string]> = [
    ['diagnostic word', 'OutOfMemoryError happened'],
    ['several key=value pairs', 'start a=1 b="x y" c=3'],
    ['source catalog marker', 'golangci-lint run ./...'],
  ];

  it.each(WEAK_LOG_LINES)('treats %s as a log line', (_name, line) => {
    expect(classifyLine(line)).toMatchObject({ logLines: 1, textLines: 0 });
  });

  it('does not match short, ambiguous catalog markers', () => {
    expect(classifyLine('the nx binary ran fine')).toMatchObject({
      logLines: 0,
      textLines: 0,
    });
  });

  it('counts a weak signal for half of a strong one when text is judged', () => {
    const text = Array.from({ length: 16 }, (_, index) => `## Section ${index}`);
    const weak = 'OutOfMemoryError happened';

    // Two weak lines weigh 1 of 18 lines (0.056); four weigh 2 of 20 (0.1);
    // six weigh 3 of 22 (0.136); eight weigh 4 of 24 (0.167).
    expect(kindOf([...text, weak, weak])).toBe('text');
    expect(kindOf([...text, ...Array(6).fill(weak)])).toBe('text');
    expect(kindOf([...text, ...Array(8).fill(weak)])).toBe('log');
  });

  it('reports weak and strong lines together in logLines', () => {
    const result = classifyContent(['[ERROR] boom', 'OutOfMemoryError happened', '# Title']);

    expect(result.logLines).toBe(2);
    expect(result.textLines).toBe(1);
  });
});

// ---- Markdown fences ----

describe('classifyContent: markdown fences', () => {
  it('counts the lines of a closed fence as text', () => {
    const result = classifyContent(['```', 'alpha', 'beta', 'gamma', '```']);

    expect(result.textLines).toBe(5);
    expect(result.logLines).toBe(0);
    expect(result.kind).toBe('text');
  });

  it('does not score the log lines inside a fence', () => {
    const result = classifyContent([
      '~~~',
      '[ERROR] boom',
      '[ERROR] bang',
      '~~~',
    ]);

    expect(result.logLines).toBe(0);
    expect(result.textLines).toBe(4);
  });

  it('leaves the lines after an unclosed fence undecided', () => {
    const result = classifyContent([
      '```',
      'alpha',
      '[ERROR] boom',
      'beta',
    ]);

    expect(result.textLines).toBe(1);
    expect(result.logLines).toBe(0);
    expect(result.sampledLines).toBe(4);
    expect(result.kind).toBe('log');
  });

  it('keeps a log with one stray fence a log', () => {
    const lines = [
      ...BANNER_LOG_LINES.slice(0, 20),
      '```',
      ...BANNER_LOG_LINES.slice(20, 60),
    ];

    expect(kindOf(lines)).toBe('log');
  });

  it('reopens a fence after it closed', () => {
    const result = classifyContent(['```', 'a', '```', 'b', '```', 'c', 'd', '```']);

    expect(result.textLines).toBe(7);
    expect(result.sampledLines).toBe(8);
  });
});

// ---- Sampling ----

describe('classifyContent: sample caps', () => {
  const textLine = (index: number): string => `## Heading ${index}`;
  const logLine = (index: number): string => `[ERROR] failure ${index}`;

  it('uses the documented defaults', () => {
    expect(DEFAULT_CONTENT_SAMPLE_LINES).toBe(100);
    expect(DEFAULT_CONTENT_SAMPLE_BYTES).toBe(256 * 1024);
    expect(CONTENT_LINE_SCAN_LIMIT).toBe(2000);
  });

  it('scores only the first 100 non-blank lines', () => {
    const textFirst = [
      ...Array.from({ length: 100 }, (_, index) => textLine(index)),
      ...Array.from({ length: 500 }, (_, index) => logLine(index)),
    ];
    const logFirst = [
      ...Array.from({ length: 100 }, (_, index) => logLine(index)),
      ...Array.from({ length: 500 }, (_, index) => textLine(index)),
    ];

    expect(classifyContent(textFirst)).toEqual({
      kind: 'text',
      logLines: 0,
      textLines: 100,
      sampledLines: 100,
    });
    expect(classifyContent(logFirst)).toEqual({
      kind: 'log',
      logLines: 100,
      textLines: 0,
      sampledLines: 100,
    });
  });

  it('does not count blank lines against the line cap', () => {
    const lines = Array.from({ length: 100 }, (_, index) => [textLine(index), '']).flat();

    expect(classifyContent(lines).sampledLines).toBe(100);
  });

  it('stops at the byte cap when lines are large', () => {
    const lineBytes = 10_003;
    const lines = Array.from({ length: 60 }, () => `# ${'x'.repeat(10_000)}`);
    const expected = Math.ceil(DEFAULT_CONTENT_SAMPLE_BYTES / lineBytes);

    const result = classifyContent(lines);

    expect(result.sampledLines).toBe(expected);
    expect(expected).toBeLessThan(60);
    expect(result.kind).toBe('text');
  });

  it('counts blank lines against the byte cap', () => {
    const lines = Array.from({ length: DEFAULT_CONTENT_SAMPLE_BYTES + 10 }, () => '');
    lines.push(textLine(0));

    expect(classifyContent(lines).sampledLines).toBe(0);
  });

  it('measures bytes, not characters', () => {
    const wide = `# ${'é'.repeat(5000)}`;
    const lines = Array.from({ length: 60 }, () => wide);
    const lineBytes = Buffer.byteLength(wide, 'utf8') + 1;

    expect(classifyContent(lines).sampledLines).toBe(
      Math.ceil(DEFAULT_CONTENT_SAMPLE_BYTES / lineBytes),
    );
  });

  it('accepts custom limits', () => {
    const lines = Array.from({ length: 50 }, (_, index) => textLine(index));

    expect(classifyContent(lines, { maxLines: 5, maxBytes: 1_000_000 }).sampledLines).toBe(5);
    // "## Heading N" is 13 bytes with its newline, so 39 bytes hold three lines.
    expect(classifyContent(lines, { maxLines: 50, maxBytes: 39 }).sampledLines).toBe(3);
  });

  it('only scores the first part of a very long line', () => {
    const longLine = `${'x'.repeat(CONTENT_LINE_SCAN_LIMIT)} [ERROR] boom`;

    expect(classifyLine(longLine)).toMatchObject({ logLines: 0, textLines: 0 });
    expect(classifyLine(`[ERROR] ${'x'.repeat(5000)}`)).toMatchObject({ logLines: 1 });
  });

  it('survives pathological lines without stalling', () => {
    const units = ['a', ' ', 'a.', '[', '(', ', ', '=', 'a=', '/', 'a/', '"', '1:'];
    const lines = units.map((unit) => unit.repeat(5000));
    const started = performance.now();

    classifyContent(lines);

    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe('isContentSampleFull', () => {
  it('is full at the line cap or the byte cap', () => {
    expect(isContentSampleFull(99, 10)).toBe(false);
    expect(isContentSampleFull(100, 10)).toBe(true);
    expect(isContentSampleFull(10, DEFAULT_CONTENT_SAMPLE_BYTES - 1)).toBe(false);
    expect(isContentSampleFull(10, DEFAULT_CONTENT_SAMPLE_BYTES)).toBe(true);
  });

  it('honours custom limits', () => {
    expect(isContentSampleFull(3, 0, { maxLines: 3, maxBytes: 10 })).toBe(true);
    expect(isContentSampleFull(2, 9, { maxLines: 3, maxBytes: 10 })).toBe(false);
    expect(isContentSampleFull(2, 10, { maxLines: 3, maxBytes: 10 })).toBe(true);
  });
});

// ---- ContentSampler ----

describe('ContentSampler', () => {
  const logLine = '[ERROR] request failed';
  const textLine = '## Section';
  const weakLine = 'OutOfMemoryError happened';

  function fill(sampler: ContentSampler, lines: readonly string[]): ContentSampler {
    for (const line of lines) {
      sampler.add(line);
    }
    return sampler;
  }

  it('gives the same result as classifyContent on the same lines', () => {
    for (const [, lines] of TEXT_SAMPLES) {
      const sampler = fill(new ContentSampler(), lines);

      expect(sampler.result()).toEqual(classifyContent(lines));
    }
  });

  it('ignores lines added after the sample is full', () => {
    const sampler = fill(new ContentSampler({ maxLines: 2, maxBytes: 1000 }), [
      textLine,
      textLine,
      logLine,
      logLine,
    ]);

    expect(sampler.isFull()).toBe(true);
    expect(sampler.result()).toMatchObject({ sampledLines: 2, logLines: 0 });
  });

  it('is not decided before anything was added', () => {
    expect(new ContentSampler().isLogDecided()).toBe(false);
  });

  it('needs the minimum number of lines before the log share decides', () => {
    expect(CONTENT_EARLY_LOG_MIN_LINES).toBe(8);
    expect(CONTENT_EARLY_LOG_MIN_RATIO).toBe(0.6);
    const sampler = new ContentSampler();

    fill(sampler, Array(CONTENT_EARLY_LOG_MIN_LINES - 1).fill(logLine));
    expect(sampler.isLogDecided()).toBe(false);

    sampler.add(logLine);
    expect(sampler.isLogDecided()).toBe(true);
  });

  it('decides on a log share of 60 percent but not below it', () => {
    const below = fill(new ContentSampler(), [
      ...Array(4).fill(logLine),
      ...Array(4).fill(textLine),
    ]);
    const atShare = fill(new ContentSampler(), [
      ...Array(6).fill(logLine),
      ...Array(4).fill(textLine),
    ]);

    expect(below.isLogDecided()).toBe(false);
    expect(atShare.isLogDecided()).toBe(true);
  });

  it('weighs weak log lines at half when judging the share', () => {
    // Twelve weak lines weigh six: 6 of 12 is 0.5, short of 0.6.
    const sampler = fill(new ContentSampler(), Array(12).fill(weakLine));

    expect(sampler.isLogDecided()).toBe(false);
  });

  it('decides once the log count exceeds what a text verdict allows', () => {
    const atCeiling = fill(new ContentSampler(), [
      ...Array(15).fill(logLine),
      ...Array(30).fill(textLine),
    ]);
    const overCeiling = fill(new ContentSampler(), [
      ...Array(16).fill(logLine),
      ...Array(30).fill(textLine),
    ]);

    expect(atCeiling.isLogDecided()).toBe(false);
    expect(overCeiling.isLogDecided()).toBe(true);
  });

  it('decides once text can no longer reach its minimum share', () => {
    const atLimit = fill(new ContentSampler(), Array(50).fill('alpha'));
    const pastLimit = fill(new ContentSampler(), Array(51).fill('alpha'));

    expect(atLimit.isLogDecided()).toBe(false);
    expect(pastLimit.isLogDecided()).toBe(true);
  });

  it('keeps lines of an open fence out of the lost count', () => {
    const sampler = fill(new ContentSampler(), ['```', ...Array(60).fill('alpha')]);

    expect(sampler.isLogDecided()).toBe(false);
  });

  it('counts the lines of a closed fence as text again', () => {
    const sampler = fill(new ContentSampler(), [
      '```',
      ...Array(60).fill('alpha'),
      '```',
    ]);

    expect(sampler.isLogDecided()).toBe(false);
    expect(sampler.result().textLines).toBe(62);
  });

  it('scales every exit with the sample size', () => {
    const limits = { maxLines: 20, maxBytes: 1_000_000 };
    const overCeiling = fill(new ContentSampler(limits), [
      logLine,
      textLine,
      textLine,
      logLine,
      textLine,
      textLine,
      logLine,
      textLine,
      textLine,
      logLine,
    ]);
    const lost = fill(new ContentSampler(limits), Array(11).fill('alpha'));

    // 0.15 x 20 = 3 log lines allowed; 0.5 x 20 = 10 lines may be lost.
    expect(overCeiling.isLogDecided()).toBe(true);
    expect(lost.isLogDecided()).toBe(true);
  });
});
