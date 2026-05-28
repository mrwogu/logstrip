export interface SourceMarker {
  value: string;
  weight: number;
}

export interface SourceProfile {
  name: string;
  markers: readonly SourceMarker[];
  diagnosticBoostPatterns: readonly RegExp[];
}

const SOURCE_DIAGNOSTIC_BOOST_PATTERNS: Readonly<
  Record<string, readonly RegExp[]>
> = {
  // ── Original 6 ──────────────────────────────────────────────────
  typescript: [/\bTS\d{4}\b/u],
  pytest: [/^E\s+/u, /\bFAILED\b/u],
  nginx: [/\[(?:error|crit|alert|emerg)\]/iu],
  'apache-httpd': [
    /\[(?:error|crit|alert|emerg)\]/iu,
    /\bAH\d{5}\b/u,
    /\b(?:Directory index forbidden|client denied|mod_jk)\b/iu,
  ],
  kubernetes: [/\b(?:BackOff|Failed|ErrImagePull|CrashLoopBackOff)\b/u],
  'github-actions': [/^::(?:error|warning)\b/u],

  // ── Build Tools ──────────────────────────────────────────────────
  gradle: [/\b(?:Execution failed|What went wrong|BUILD FAILED)\b/iu],
  maven: [/\b(?:BUILD FAILURE|Failed to execute goal|Compilation failure)\b/iu],
  bazel: [/\b(?:BUILD FAILED|build did not complete successfully)\b/iu],
  webpack: [/\b(?:Module not found|Can't resolve|Module build failed|BUILD FAILED)\b/iu],
  vite: [/\b(?:Build failed|Transform failed|Internal server error)\b/iu],
  esbuild: [/\b(?:Build failed|error:\s|ERROR:)\b/u],
  rollup: [/\b(?:!\s|Circular dependency|Could not resolve)\b/u],
  cargo: [/\b(?:error\[E\d{4}\]|error: could not compile|could not compile `)/u],
  rustc: [/\berror\[E\d{4}\]\b/u],
  cmake: [/\b(?:CMake Error|CMakeFiles|cmake failed)\b/iu],
  msbuild: [/\b(?:error MSB\d{4}|Build FAILED)\b/iu],
  make: [/\b(?:make: \*\*\*|make\[|Error \d+\])\b/u],
  'go-build': [/\b(?:go: |build failed|cannot find package)\b/iu],

  // ── Package Managers ─────────────────────────────────────────────
  npm: [/\bnpm\s+ERR!/iu],
  pnpm: [/\bpnpm\s+ERR!/iu],
  yarn: [/\byarn\s+error\b/iu],
  pip: [/\b(?:ERROR: Could not find a version|ERROR: No matching distribution)\b/u],
  bundler: [/\b(?:Could not find gem|Bundler::|Gem::ConflictError)\b/u],
  composer: [/\b(?:Composer\\|Installation failed|Root package)\b/u],

  // ── Test Runners ──────────────────────────────────────────────────
  jest: [/\b(?:●\s|Tests:\s+\d+\s+failed|AssertionError:)\b/u],
  vitest: [/\b(?:FAIL\s+|AssertionError:|Test Files\s+\d+\s+failed)\b/u],
  mocha: [/\b(?:AssertionError|Error:) \d+ (?:failing|passing)\b/u],
  'go-test': [/\b---\s*FAIL:/u],
  junit: [/\b(?:Tests run: \d+.*Failures: [1-9]|FAILED)\b/u],
  rspec: [/\b(?:Failures:|expected:|got:)\b/u],
  phpunit: [/\b(?:FAILURES!|Tests: \d+|Assertions: \d+)\b/u],

  // ── Container / Orchestration ────────────────────────────────────
  docker: [/\b(?:Error response from daemon|failed to build|failed to push|manifest.*not found)\b/iu],
  buildkit: [/\b(?:error:|failed to solve|canceled)\b/u],
  containerd: [/\b(?:failed to start container|OCI runtime|runc)\b/iu],
  helm: [/\b(?:Error: UPGRADE FAILED|Error: INSTALLATION FAILED|Error: uninstall|Error: release.*failed)\b/iu],

  // ── IaC ──────────────────────────────────────────────────────────
  terraform: [/\b(?:Error: |Error applying|Terraform.*failed)\b/iu],
  terragrunt: [/\b(?:Error: |Module.*error)\b/iu],
  ansible: [/\b(?:fatal: \[|FAILED!|UNREACHABLE!)\b/u],
  pulumi: [/\b(?:Pulumi\.error|error: update failed|Diagnostics:)\b/iu],
  'aws-cdk': [/\b(?:CdkSynthError|cdk deploy failed|ValidationError|No stack named)\b/iu],

  // ── Databases ────────────────────────────────────────────────────
  postgresql: [/\b(?:FATAL:|ERROR:|PG::|relation.*does not exist)\b/iu],
  mysql: [/\b(?:ERROR \d{4}|Can't connect|Access denied for user)\b/iu],
  redis: [/\b(?:DENIED|Connection refused|ERR |WRONGTYPE|READONLY)\b/u],
  mongodb: [/\b(?:MongoServerSelectionError|MongoNetworkError|not master|NotWritablePrimary)\b/iu],
  kafka: [/\b(?:Broker may not be available|Connection to node.*could not be established|UNKNOWN_TOPIC_OR_PARTITION)\b/iu],
  rabbitmq: [/\b(?:connection refused|broker unreachable|channel error|PRECONDITION_FAILED)\b/iu],
  cockroachdb: [/\b(?:SQLSTATE|restart transaction|RETRY_WRITE_TOO_OLD)\b/iu],

  // ── Web Frameworks (JS/TS) ──────────────────────────────────────
  express: [/\b(?:Error: Cannot find module|TypeError:.*Router|Error: EADDRINUSE|Error: listen EACCES)\b/u],
  fastify: [/\b(?:FST_ERR|fastify error|plugin initialization failed)\b/iu],
  nestjs: [/\b(?:NestError|Nest can't resolve dependencies|Circular dependency detected)\b/iu],
  nextjs: [/\b(?:Error: Cannot resolve dependency|Error: Build failed|Module not found|Error: > Build failed)\b/u],
  nuxt: [/\b(?:Nuxt Build Error|Cannot start nuxt|Fatal error)\b/iu],
  hono: [/\b(?:TypeError: Cannot read properties|HonoError)\b/u],

  // ── ORMs ──────────────────────────────────────────────────────────
  prisma: [/\b(?:P\d{4,5}|PrismaClientKnownRequestError|PrismaClientValidationError|PrismaClientInitializationError)\b/u],
  'drizzle-orm': [/\b(?:DrizzleKitError|drizzle.*error|MigrationError)\b/iu],
  typeorm: [/\b(?:QueryFailedError|EntityMetadataNotFound|ConnectionNotFoundError|DriverPackageNotInstalledError)\b/iu],
  sequelize: [/\b(?:SequelizeConnectionError|SequelizeDatabaseError|SequelizeValidationError)\b/iu],
  knex: [/\b(?:MigrationLockError|KnexTimeoutError|Knex:error)\b/iu],

  // ── Python Frameworks ───────────────────────────────────────────
  django: [/\b(?:django\.core\.exceptions|django\.db\.utils|OperationalError|ImproperlyConfigured)\b/iu],
  fastapi: [/\b(?:fastapi\.exceptions|HTTPException|ValidationError|RequestValidationError)\b/iu],
  flask: [/\b(?:werkzeug\.exceptions|flask\.abort|Internal Server Error)\b/iu],
  celery: [/\b(?:celery\.exceptions|Task.*raised unexpected|WorkerLostError)\b/iu],
  sqlalchemy: [/\b(?:sqlalchemy\.exc\.|OperationalError|IntegrityError|ProgrammingError)\b/iu],

  // ── Linters / Security Scanners ──────────────────────────────────
  eslint: [/\b\d+:\d+\s+error\s|\beslint.*error\b/ui],
  semgrep: [/\b(?:semgrep finding|severity:(?:ERROR|WARNING))\b/iu],
  gitleaks: [/\bsecret detected\b/iu],
  trivy: [/\b(?:CRITICAL|HIGH):\s|CVE-\d{4}-\d{4,7}\b/u],
  snyk: [/\b(?:High severity|Critical severity|introduced by)\b/iu],
  grype: [/\b(?:CRITICAL\s+CVE-|HIGH\s+CVE-|NAME\s+INSTALLED\s+FIXED-IN)\b/u],
  checkov: [/\b(?:CKV_|Checkov.*failed)\b/u],
  bandit: [/\b(?:Issue: \[B\d{3}|Test results:.*issues)\b/u],
  mypy: [/\b(?:mypy: error:|mypy: warning:|Incompatible types|has incompatible type)\b/u],
  ruff: [/\b(?:ruff\s+(?:check|format)|F\d{3,4}|E\d{3,4}|RUF\d{3})\b/u],
  pylint: [/\b(?:pylint\s+|E\d{4}:|W\d{4}:|C\d{4}:|R\d{4}:)\b/u],

  // ── CI/CD Platforms ─────────────────────────────────────────────
  circleci: [/\b(?:Spin Cancelled|Step failed|job was not approved)\b/u],
  jenkins: [/\b(?:\[Pipeline\]\s*\[ERROR\]|Stage .* failed|script returned exit code [1-9])\b/u],
  'gitlab-ci': [/\b(?:ERROR: Job failed|job failed|script returned exit code [1-9])\b/u],
  teamcity: [/\b##teamcity\[(?:buildProblem|compilationFinished)\b/u],
  'azure-pipelines': [/\b##vso\[task\.(?:LogIssue|Complete)\b/u],
  buildkite: [/\b(?:buildkite.*failed|command failed)\b/iu],

  // ── Cloud Providers ─────────────────────────────────────────────
  'aws-lambda': [/\b(?:Task timed out|ERROR Invoke Error|Runtime\.ExitError|Process exited before completing)\b/iu],
  'gcp-cloud-run': [/\b(?:Cloud Run.*failed|Revision.*failed|Container failed to start|Ready condition status)\b/iu],
  'azure-functions': [/\b(?:System\.TimeoutException|FunctionInvocationException|Host threshold exceeded)\b/iu],
  cloudformation: [/\b(?:ROLLBACK_COMPLETE|CREATE_FAILED|UPDATE_FAILED|DELETE_FAILED)\b/u],
  cloudwatch: [/\b(?:Alarm|INSUFFICIENT_DATA|State change)\b/u],
  'aws-ecs': [/\b(?:service.*failed|Task failed|unable to place a task)\b/iu],

  // ── Observability ────────────────────────────────────────────────
  datadog: [/\b(?:datadog ERROR|datadog CRITICAL|datadog WARN)\b/iu],
  sentry: [/\b(?:failed to send event|sentry\.captureException|Error exporting spans)\b/iu],
  prometheus: [/\b(?:target.*down|scrape.*failed|rule evaluation error|Alertmanager)\b/iu],
  grafana: [/\b(?:grafana.*alert|alerting evaluation error|Dashboard.*error|provisioning error)\b/iu],
  loki: [/\b(?:loki.*error|logql.*error|ingester.*failed)\b/iu],
  'newrelic': [/\b(?:NR-\d+|new relic.*error|NewRelic.*error)\b/iu],

  // ── Message Queues ───────────────────────────────────────────────
  'aws-sqs': [/\b(?:SQS.*error|QueueDoesNotExist|ReceiptHandleIsInvalid)\b/iu],
  'gcp-pubsub': [/\b(?:pubsub.*error|DeadlineExceeded|UNAVAILABLE)\b/iu],
  bullmq: [/\b(?:StalledJobError|job.*failed|BullMQ.*error|WaitingChildrenError)\b/iu],

  // ── AI / ML ──────────────────────────────────────────────────────
  'openai-api': [/\b(?:Rate limit exceeded|RateLimitError|context_length_exceeded|invalid_request_error|insufficient_quota)\b/iu],
  ollama: [/\b(?:model not found|Error: |CUDA error|Error: llama)\b/u],
  vllm: [/\b(?:CUDA out of memory|OOM|Error: Failed to load model|tensor parallel)\b/iu],
  langchain: [/\b(?:OutputParserError|LangChain.*error|Chain.*failed|Agent.*error)\b/iu],
  huggingface: [/\b(?:HubConnectionError|ModelNotFoundError|RepositoryNotFoundError|HFValidationError)\b/iu],

  // ── Auth / Identity ─────────────────────────────────────────────
  keycloak: [/\b(?:Failed to authenticate|invalid_grant|unauthorized_client|token_introspection_failed)\b/iu],
  vault: [/\b(?:permission denied|failed to seal|Error making API request|secret is missing)\b/iu],
  clerk: [/\b(?:ClerkAuthenticationError|ClerkAPIError|InvalidSessionError)\b/iu],
  auth0: [/\b(?:Auth0Error|Invalid token|access_denied|unauthorized)\b/iu],

  // ── Logging Libraries ───────────────────────────────────────────
  pino: [/\b(?:pino\.|"level":(?:50|60))\b/u],
  log4j: [/\b(?:org\.apache\.log4j|log4j:ERROR|log4j:WARN)\b/u],
  slf4j: [/\b(?:org\.slf4j|LoggerFactory|Failed to load class)\b/u],
  winston: [/\b(?:winston.*error|winston\.error)\b/iu],

  // ── Cloudflare / Edge ───────────────────────────────────────────
  cloudflare: [/\b(?:cloudflare.*error|cf-ray|Error \d{3,4})\b/iu],
  'cloudflare-workers': [/\b(?:Workers.*error|wrangler.*error|Service bindings error)\b/iu],
  vercel: [/\b(?:vercel.*error|Vercel.*failed|Deployment error)\b/iu],

  // ── Rust frameworks ─────────────────────────────────────────────
  rocket: [/\b(?:Rocket\.error|Rocket has crashed|launch fairing failed)\b/u],
  axum: [/\b(?:axum::|axum error|hyper::Error)\b/u],

  // ── Go frameworks ───────────────────────────────────────────────
  'echo-framework': [/\b(?:echo v4 handler panic|labstack\/echo|echo\.HTTPError)\b/u],
  fiber: [/\b(?:fiber\.Error|fiber\.RequestTimeoutError|fiber v2.*error)\b/u],

  // ── Mobile / Desktop ────────────────────────────────────────────
  'react-native': [/\b(?:Unable to resolve module|bundling failed|Metro error|ReactNativeFirebaseError)\b/u],
  flutter: [/\b(?:flutter.*error|Dart error|Unhandled Exception|FlutterError)\b/iu],
  electron: [/\b(?:electron-builder.*error|Cannot find module 'electron'|Error: electron)\b/u],

  // ── E-commerce / CMS ─────────────────────────────────────────────
  shopify: [/\b(?:ShopifyError|ShopifyAPIError|GraphQL.*error|ShopifyCLI.*error)\b/iu],
  wordpress: [/\b(?:PHP Fatal error:|PHP Parse error:|wp-db\.php|WPDB error)\b/iu],
  drupal: [/\b(?:Drupal\\|PluginNotFoundException|Uncaught PHP Exception)\b/u],
  strapi: [/\b(?:Strapi.*error|Error: Connection refused to database)\b/iu],

  // ── Backup / DR ─────────────────────────────────────────────────
  velero: [/\b(?:VeleroBackupError|BackupStorageLocation|backup failed)\b/iu],
  restic: [/\b(?:ResticRepositoryError|Fatal: unable to open repo|Fatal: |repo already locked)\b/u],
};

export function createSourceProfiles(
  signatures: readonly (readonly [string, readonly string[]])[],
): readonly SourceProfile[] {
  return signatures.map(([name, markers]) => ({
    name,
    markers: markers.map((marker) => ({
      value: marker.toLowerCase(),
      weight: sourceMarkerWeight(marker),
    })),
    diagnosticBoostPatterns: SOURCE_DIAGNOSTIC_BOOST_PATTERNS[name] ?? [],
  }));
}

export function sourceMarkerWeight(marker: string): number {
  const normalized = marker.trim();

  if (normalized.length <= 3) {
    return 6;
  }

  if (normalized.length >= 12 || /[^a-z0-9]/iu.test(normalized)) {
    return 16;
  }

  return 12;
}
