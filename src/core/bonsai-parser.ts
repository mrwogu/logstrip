import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import {
  type BonsaiCustomConfig,
  type BonsaiSourceSignature,
  loadBonsaiConfig,
} from './bonsai-config.js';

export type Aggressiveness = 'low' | 'medium' | 'high' | 'aggressive';

export interface BonsaiOptions {
  aggressiveness?: Aggressiveness;
  configPath?: string;
}

export interface BonsaiStats {
  inputLines: number;
  outputLines: number;
  inputWords: number;
  outputWords: number;
  inputBytes: number;
  outputBytes: number;
  droppedLines: number;
  duplicateLines: number;
  hiddenInternalStackLines: number;
}

export interface BonsaiResult {
  stats: BonsaiStats;
  inputTokens: number;
  outputTokens: number;
  savedTokens: number;
  savingsPercent: number;
  detectedSources?: readonly string[];
  outputPath?: string;
}

export const INTERNAL_STACK_MARKER = '[... hidden internal library frames ...]';

const AGGRESSIVENESS_LEVELS: readonly Aggressiveness[] = [
  'low',
  'medium',
  'high',
  'aggressive',
];

const IGNORED_LOG_TAG_PATTERN =
  /\[(?:INFO|DEBUG|TRACE|VERBOSE)\]|"level"\s*:\s*"(?:info|debug|trace|verbose)"/i;
const IMPORTANT_LOG_TAG_PATTERN = /\[(?:ERROR|WARN|FATAL|CRITICAL|FAIL)\]/i;
const EXPLICIT_LOG_TAG_PATTERN = /\[[A-Z]+\]/i;
const STACK_FRAME_PATTERN = /^\s*at\s+.*(?:\(|\s).+:\d+:\d+\)?$/;
const JAVA_STACK_FRAME_PATTERN = /^\s*at\s+[\w$_.<>/]+\([^)]+:\d+\)$/;
const PYTHON_STACK_FRAME_PATTERN =
  /^\s*File\s+"[^"]+",\s+line\s+\d+,\s+in\s+.+$/;
const GO_STACK_FRAME_PATTERN =
  /^\s*(?:(?:[\w.-]+\/)+[\w./-]+|[\w.-]+\.\(\*?[\w.]+\)\.[\w.]+|[\w.-]+\.[A-Z]\w*)\(.*\)$/;
const GO_FILE_FRAME_PATTERN =
  /^\s*(?:\/[^\s]+|[A-Za-z]:[\\/][^\s]+):\d+(?:\s+\+\S+)?$/;
const GO_GOROUTINE_PATTERN = /^\s*goroutine\s+\d+\s+\[.+\]:$/i;
const PYTHON_TRACEBACK_PATTERN = /^Traceback \(most recent call last\):$/;
const STACK_MORE_PATTERN = /^\s*\.\.\. \d+ more$/;
const GITHUB_ACTIONS_ANNOTATION_PATTERN = /^::(?:error|warning|notice)\b/u;
const GRADLE_FAILURE_PATTERN =
  /\b(?:Execution failed|What went wrong|BUILD FAILED|Task failed with an exception)\b/i;
const MAKE_ERROR_PATTERN = /^make[:\s*]+/u;
const GO_TEST_FAIL_PATTERN = /---\s*FAIL:/u;
const SYSTEMD_STATUS_PATTERN =
  /\b(?:Failed to start|Failed to load|Failed to listen|Failed to mount|Failed to open|Failed to connect|status=\d+\s+\w+)\b/i;
const CIRCLECI_STEP_PATTERN = /\b(?:Spin Cancelled|Step failed|job was not approved)\b/i;
const JENKINS_MARKER_PATTERN = /\[(?:Pipeline|Checks|FCMaker)\]/u;
const AZURE_PIPELINE_PATTERN = /^##vso\[task\.(?:LogIssue|Complete)\b/u;const TEAMCITY_MARKER_PATTERN = /^##teamcity\[(?:buildProblem|compilationFinished|message)\b/u;
const DIAGNOSTIC_PATTERN =
  /\b(?:Error|Exception|AssertionError|TypeError|ReferenceError|SyntaxError|RangeError|NullPointerException|Unhandled|failed|failure|fatal|panic|refused|timeout|timed\s+out|unreachable|unavailable|disconnected|killed|aborted|crashed|terminated|unauthorized)\b/i;
const JSON_SEVERITY_PATTERN =
  /"(?:level|severity)"\s*:\s*"(?:fatal|error|critical|warn|warning)"/i;
const NPM_ERROR_PATTERN = /\b(?:npm|pnpm)\s+ERR!/i;
const YARN_ERROR_PATTERN = /\byarn\s+error\b/i;
const SCANNER_FINDING_PATTERN =
  /\b(?:CVE-\d{4}-\d{4,7}|GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}|vulnerabilit(?:y|ies)|severity:\s*(?:critical|high|medium)|(?:critical|high)\s+severity)\b/i;
const CONTAINER_FAILURE_PATTERN =
  /\b(?:CrashLoopBackOff|ImagePullBackOff|ErrImagePull|OOMKilled|Back[- ]off restarting failed container|failed to pull image|(?:containerd|runc).*?(?:failed|error|panic|timeout|refused)|(?:failed|error|panic|timeout|refused).*?(?:containerd|runc)|rpc error: code = Unknown desc = failed to resolve reference)\b/i;
const INTERNAL_STACK_PATTERN =
  /(?:node_modules[\\/]|node:internal|internal[\\/]modules|bootstrap_node|[\\/]usr[\\/]lib[\\/]|[\\/]usr[\\/]local[\\/]lib[\\/]|[\\/]usr[\\/]local[\\/]go[\\/]src[\\/]runtime[\\/]|site-packages[\\/]|dist-packages[\\/]|\.venv[\\/]|java\.base[\\/]|jdk\.internal|org\.springframework\.|[\\/]pkg[\\/]mod[\\/]|\.cargo[\\/]registry[\\/])/i;

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const ISO_TIME_PATTERN =
  /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;
const UTC_TIME_PATTERN =
  /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+(?:GMT|UTC)\b/gi;
const COMMON_LOG_TIME_PATTERN =
  /\b\d{1,2}\/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\b/gi;
const NGINX_ERROR_TIME_PATTERN = /\b\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\b/g;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/gu;
const IPV4_WITH_PORT_PATTERN =
  /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}:(?:6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]?\d{1,4})\b/g;
const IPV4_PATTERN =
  /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/g;
const HEX_HASH_PATTERN = /\b(?=[a-f0-9]*\d)(?=[a-f0-9]*[a-f])[a-f0-9]{16,}\b/gi;
const ALPHANUMERIC_HASH_PATTERN =
  /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{24,}\b/g;
const AWS_ACCESS_KEY_PATTERN = /\b(?:AKIA|ABIA|ASIA)[0-9A-Z]{16}\b/g;
const AWS_ARN_ACCOUNT_PATTERN = /arn:aws:[a-z]+:[a-z0-9-]+:(\d{12})/g;

// In sanitizeLine, replace AWS ARN account IDs
// Applied inline below via replace callback
const LOW_EXTRA_TAG_PATTERN = /\[(?:NOTICE|STATUS)\]/i;
const AGGRESSIVE_WARN_PATTERN = /\[(?:WARN|WARNING)\]/i;
const AGGRESSIVE_WARNING_SIGNAL_PATTERN = DIAGNOSTIC_PATTERN;

// Hybrid detection: context window + TF-IDF dampening constants
export const CONTEXT_WINDOW_BEFORE = 3;
export const CONTEXT_WINDOW_AFTER = 2;
export const SCORE_KEEP_THRESHOLD = 40;
export const TFIDF_REPEAT_THRESHOLD = 3;
export const TFIDF_PENALTY = 8;
export const TFIDF_MAP_LIMIT = 50_000;
export const MAX_REPEAT_DELTA_VALUES = 3;

export const LOG_SOURCE_SIGNATURES: ReadonlyArray<
  readonly [source: string, markers: readonly string[]]
> = [
  ['vitest', ['vitest']],
  ['jest', ['jest']],
  ['mocha', ['mocha']],
  ['ava', ['ava test']],
  ['tap', ['tap version', 'node-tap']],
  ['node-test-runner', ['node:test']],
  ['cypress', ['cypress']],
  ['playwright', ['playwright']],
  ['storybook', ['storybook']],
  ['karma', ['karma']],
  ['webpack', ['webpack']],
  ['vite', ['vite']],
  ['rollup', ['rollup']],
  ['esbuild', ['esbuild']],
  ['babel', ['babel']],
  ['swc', ['swc']],
  ['typescript', ['typescript', 'tsc', 'ts2322', 'ts18048']],
  ['eslint', ['eslint']],
  ['prettier', ['prettier']],
  ['rome', ['rome']],
  ['npm', ['npm err!', 'npm warn', 'npm run']],
  ['pnpm', ['pnpm err!', 'pnpm']],
  ['yarn', ['yarn error', 'yarn run']],
  ['bun', ['bun install', 'bun run']],
  ['nx', ['nx ']],
  ['turborepo', ['turbo run', 'turborepo']],
  ['lerna', ['lerna']],
  ['pytest', ['pytest', 'tests/', 'assertionerror: assert']],
  ['keploy', ['keploy']],
  ['testkube', ['testkube']],
  ['python-unittest', ['unittest', 'ran ', 'failed (failures=']],
  ['tox', ['tox -e', 'tox:']],
  ['nox', ['nox >']],
  ['pip', ['pip install', 'pip uninstall']],
  ['pipenv', ['pipenv']],
  ['poetry', ['poetry install', 'poetry lock']],
  ['uv', ['uv pip', 'astral uv']],
  ['django', ['django', 'manage.py']],
  ['flask', ['flask app']],
  ['fastapi', ['fastapi', 'uvicorn']],
  ['gunicorn', ['gunicorn']],
  ['uvicorn', ['uvicorn']],
  ['celery', ['celery']],
  ['airflow', ['airflow']],
  ['maven', ['maven', 'mvn ', 'mojofailureexception']],
  ['gradle', ['gradle', 'task :', 'build failed with an exception']],
  ['bazel', ['bazel', 'build did not complete successfully']],
  ['cmake', ['cmake error', 'cmakefiles']],
  ['ninja-build', ['ninja: build stopped']],
  ['sbt', ['sbt compile', 'sbt run', 'sbt test', 'sbt publish', 'sbt update', '[sbt]']],
  ['ant', ['apache ant', 'build.xml']],
  ['junit', ['junit']],
  ['spring-boot', ['spring', 'springboot']],
  ['logback', ['logback']],
  ['go-test', ['go test', '--- fail:']],
  ['go-build', ['go build', 'go: downloading']],
  ['golangci-lint', ['golangci-lint']],
  ['gin', ['gin-gonic']],
  ['cobra', ['spf13/cobra']],
  ['cargo', ['cargo build', 'cargo test']],
  ['rustc', ['rustc', 'error[e']],
  ['clippy', ['clippy']],
  ['actix', ['actix']],
  ['tokio', ['tokio']],
  ['dotnet', ['dotnet ', 'asp.net']],
  ['msbuild', ['msbuild', 'error msb']],
  ['nuget', ['nuget']],
  ['xunit', ['xunit']],
  ['nunit', ['nunit']],
  ['serilog', ['serilog']],
  ['phpunit', ['phpunit']],
  ['composer', ['composer']],
  ['laravel', ['laravel']],
  ['symfony', ['symfony']],
  ['bundler', ['bundle install', 'bundler']],
  ['rspec', ['rspec']],
  ['rails', ['rails']],
  ['sidekiq', ['sidekiq']],
  ['docker', ['docker', 'dockerfile']],
  ['buildkit', ['buildkit', '#0 [internal]']],
  ['docker-compose', ['docker-compose', 'compose']],
  ['podman', ['podman']],
  ['containerd', ['containerd']],
  ['runc', ['runc']],
  ['kubernetes', ['kubernetes', 'kubectl', 'k8s']],
  ['kubelet', ['kubelet']],
  ['helm', ['helm']],
  ['kustomize', ['kustomize']],
  ['skaffold', ['skaffold']],
  ['tilt', ['tilt up', 'tiltfile']],
  ['openshift', ['openshift', 'oc ']],
  ['concourse', ['concourse', 'fly -t']],
  ['werf', ['werf']],
  ['nomad', ['hashicorp nomad', 'nomad']],
  ['consul', ['hashicorp consul', 'consul']],
  ['istio', ['istio']],
  ['linkerd', ['linkerd']],
  ['cilium', ['cilium']],
  ['calico', ['calico']],
  ['keda', ['keda']],
  ['knative', ['knative']],
  ['openfaas', ['openfaas']],
  ['cert-manager', ['cert-manager', 'cert manager']],
  ['external-dns', ['external-dns', 'external dns']],
  ['sealed-secrets', ['sealed-secrets', 'sealed secrets']],
  ['kyverno', ['kyverno']],
  ['opa-gatekeeper', ['gatekeeper', 'opa gatekeeper']],
  ['argo-rollouts', ['argo rollouts', 'argo-rollouts']],
  ['flagger', ['flagger']],
  ['crossplane', ['crossplane']],
  ['telepresence', ['telepresence']],
  ['k9s', ['k9s']],
  ['stern', ['stern']],
  ['kubescape', ['kubescape']],
  ['tracetest', ['tracetest']],
  ['polaris', ['fairwinds polaris', 'polaris audit']],
  ['kube-bench', ['kube-bench']],
  ['kube-hunter', ['kube-hunter', 'kube hunter']],
  ['envoy', ['envoy']],
  ['github-actions', ['github actions', '##[error]', '::error::']],
  ['gitlab-ci', ['gitlab-ci', 'running with gitlab-runner']],
  ['jenkins', ['jenkins', '[pipeline]']],
  ['argocd', ['argocd', 'argo cd']],
  ['fluxcd', ['fluxcd', 'flux cd']],
  ['renovate', ['renovate bot', 'renovate']],
  ['circleci', ['circleci']],
  ['travis-ci', ['travis ci', 'travis build']],
  ['azure-pipelines', ['azure pipelines', '##vso']],
  ['teamcity', ['teamcity', '##teamcity']],
  ['buildkite', ['buildkite']],
  ['spinnaker', ['spinnaker']],
  ['harness', ['harness']],
  ['armory', ['armory']],
  ['bamboo', ['atlassian bamboo', 'bamboo build']],
  ['appveyor', ['appveyor']],
  ['codefresh', ['codefresh']],
  ['octopus-deploy', ['octopus deploy', 'octopus']],
  ['drone-ci', ['drone.io', 'drone ci']],
  ['tekton', ['tekton', 'taskrun', 'pipelinerun']],
  ['argo-workflows', ['argo workflows', 'workflow failed']],
  ['trivy', ['trivy', 'vulnerability', 'cve-']],
  ['snyk', ['snyk']],
  ['grype', ['grype']],
  ['semgrep', ['semgrep']],
  ['gitleaks', ['gitleaks']],
  ['dependabot', ['dependabot']],
  ['npm-audit', ['npm audit']],
  ['osv-scanner', ['osv-scanner']],
  ['checkov', ['checkov']],
  ['bandit', ['bandit']],
  ['sonarqube', ['sonarqube', 'sonar']],
  ['nginx', ['nginx']],
  ['apache-httpd', ['apache', 'httpd']],
  ['caddy', ['caddy']],
  ['varnish', ['varnish']],
  ['traefik', ['traefik']],
  ['haproxy', ['haproxy']],
  ['postgresql', ['postgres', 'postgresql']],
  ['mysql', ['mysql']],
  ['mariadb', ['mariadb']],
  ['mongodb', ['mongodb', 'mongod']],
  ['redis', ['redis']],
  ['valkey', ['valkey']],
  ['keydb', ['keydb']],
  ['dragonflydb', ['dragonflydb', 'dragonfly']],
  ['memcached', ['memcached']],
  ['aerospike', ['aerospike']],
  ['dynamodb', ['dynamodb']],
  ['cockroachdb', ['cockroachdb']],
  ['scylladb', ['scylladb']],
  ['yugabytedb', ['yugabytedb', 'yugabyte']],
  ['tidb', ['tidb']],
  ['influxdb', ['influxdb']],
  ['timescaledb', ['timescaledb']],
  ['questdb', ['questdb']],
  ['eventstoredb', ['eventstoredb', 'event store db']],
  ['pgbouncer', ['pgbouncer']],
  ['proxysql', ['proxysql']],
  ['vitess', ['vitess']],
  ['cassandra', ['cassandra']],
  ['clickhouse', ['clickhouse']],
  ['opensearch', ['opensearch']],
  ['elasticsearch', ['elasticsearch']],
  ['oracle-db', ['oracle', 'ora-']],
  ['sqlserver', ['sql server', 'mssql']],
  ['db2', ['db2']],
  ['neo4j', ['neo4j']],
  ['kafka', ['kafka']],
  ['aws-kinesis', ['kinesis']],
  ['aws-msk', ['amazon msk', 'aws msk']],
  ['confluent', ['confluent']],
  ['schema-registry', ['schema registry']],
  ['rabbitmq', ['rabbitmq']],
  ['nats', ['nats']],
  ['apache-pulsar', ['pulsar']],
  ['activemq', ['activemq']],
  ['debezium-server', ['debezium server']],
  ['streamsets', ['streamsets']],
  ['bytewax', ['bytewax']],
  ['materialize', ['materialize']],
  ['risingwave', ['risingwave']],
  ['emqx', ['emqx']],
  ['mosquitto', ['mosquitto']],
  ['aws-sqs', ['aws sqs', 'amazon sqs']],
  ['aws-sns', ['aws sns', 'amazon sns']],
  ['gcp-pubsub', ['pub/sub', 'google pubsub', 'gcp pubsub']],
  ['redpanda', ['redpanda']],
  ['zeromq', ['zeromq', '0mq']],
  ['ibm-mq', ['ibm mq', 'websphere mq']],
  ['cloudformation', ['cloudformation']],
  ['cloud-custodian', ['cloud custodian', 'custodian run']],
  ['infracost', ['infracost']],
  ['terraform-cloud', ['terraform cloud']],
  ['terraform-enterprise', ['terraform enterprise']],
  ['terraform', ['terraform']],
  ['terragrunt', ['terragrunt']],
  ['opentofu', ['opentofu']],
  ['atlantis', ['atlantis']],
  ['spacelift', ['spacelift']],
  ['ansible', ['ansible']],
  ['pulumi', ['pulumi']],
  ['packer', ['packer']],
  ['chef', ['chef']],
  ['puppet', ['puppet']],
  ['saltstack', ['saltstack']],
  ['vault', ['vault']],
  ['aws-lambda', ['aws lambda', 'lambda']],
  ['cloudwatch', ['cloudwatch']],
  ['gcp-cloud-run', ['cloud run']],
  ['azure-functions', ['azure functions']],
  ['gcp-cloud-functions', ['cloud functions']],
  ['aws-ecs', ['aws ecs', 'amazon ecs']],
  ['aws-eks', ['aws eks', 'amazon eks']],
  ['aws-fargate', ['fargate']],
  ['aws-cloudfront', ['cloudfront']],
  ['aws-alb', ['application load balancer', 'aws alb']],
  ['aws-api-gateway', ['api gateway', 'execute-api']],
  ['azure-aks', ['azure aks', 'aks cluster']],
  ['azure-app-service', ['azure app service', 'app service']],
  ['gcp-gke', ['google kubernetes engine', 'gke']],
  ['azure-monitor', ['azure monitor']],
  ['cloudflare', ['cloudflare']],
  ['fastly', ['fastly']],
  ['vercel', ['vercel']],
  ['netlify', ['netlify']],
  ['heroku', ['heroku']],
  ['railway', ['railway']],
  ['fly-io', ['fly.io', 'flyctl']],
  ['prometheus', ['prometheus']],
  ['grafana', ['grafana']],
  ['loki', ['loki']],
  ['logstash', ['logstash']],
  ['fluentd', ['fluentd']],
  ['fluent-bit', ['fluent bit', 'fluent-bit']],
  ['graylog', ['graylog']],
  ['splunk', ['splunk']],
  ['kibana', ['kibana']],
  ['zabbix', ['zabbix']],
  ['nagios', ['nagios']],
  ['jaeger', ['jaeger']],
  ['zipkin', ['zipkin']],
  ['honeycomb', ['honeycomb']],
  ['elastic-apm', ['elastic apm']],
  ['datadog', ['datadog']],
  ['newrelic', ['new relic']],
  ['sentry', ['sentry']],
  ['sumologic', ['sumologic']],
  ['logz-io', ['logz.io', 'logz io']],
  ['mezmo', ['mezmo', 'logdna']],
  ['parca', ['parca']],
  ['pixie', ['pixie']],
  ['falco', ['falco']],
  ['aquasec', ['aquasec', 'aqua security']],
  ['wiz', ['wiz']],
  ['tenable', ['tenable']],
  ['prisma-cloud', ['prisma cloud']],
  ['qualys', ['qualys']],
  ['crowdstrike', ['crowdstrike']],
  ['aws-guardduty', ['guardduty']],
  ['aws-security-hub', ['security hub']],
  ['aws-cloudtrail', ['cloudtrail']],
  ['vanta', ['vanta']],
  ['drata', ['drata']],
  ['panther', ['panther']],
  ['falcon-logscale', ['falcon logscale', 'humio']],
  ['owasp-zap', ['owasp zap', 'zap baseline']],
  ['sonatype-nexus', ['sonatype nexus', 'nexus repository']],
  ['jfrog-artifactory', ['artifactory', 'jfrog']],
  ['harbor', ['harbor']],
  ['syslog', ['syslog']],
  ['journald', ['journald', 'systemd']],
  ['hadoop', ['hadoop']],
  ['spark', ['apache spark', 'spark executor']],
  ['flink', ['apache flink', 'flink job']],
  ['kubeflow', ['kubeflow']],
  ['ray', ['ray cluster']],
  ['mlflow', ['mlflow']],
  ['langfuse', ['langfuse']],
  ['langsmith', ['langsmith']],
  ['arize-phoenix', ['arize phoenix', 'phoenix tracing']],
  ['weights-and-biases', ['weights & biases', 'wandb']],
  ['neptune-ai', ['neptune.ai', 'neptune run']],
  ['mlrun', ['mlrun']],
  ['seldon-core', ['seldon core', 'seldon']],
  ['kserve', ['kserve']],
  ['bentoml', ['bentoml']],
  ['triton-inference-server', ['triton inference server', 'nvidia triton']],
  ['feast', ['feast feature store', 'feast apply']],
  ['llamaindex', ['llamaindex']],
  ['haystack', ['deepset haystack', 'haystack pipeline']],
  ['milvus', ['milvus']],
  ['qdrant', ['qdrant']],
  ['weaviate', ['weaviate']],
  ['pinecone', ['pinecone']],
  ['chromadb', ['chromadb', 'chroma db']],
  ['vespa', ['vespa']],
  ['singlestore', ['singlestore', 'memsql']],
  ['dbt', ['dbt run', 'dbt test']],
  ['dagster', ['dagster']],
  ['airbyte', ['airbyte']],
  ['fivetran', ['fivetran']],
  ['stitch-data', ['stitch data']],
  ['kafka-connect', ['kafka connect']],
  ['debezium', ['debezium']],
  ['trino', ['trino']],
  ['presto', ['presto']],
  ['apache-druid', ['apache druid', 'druid coordinator']],
  ['apache-pinot', ['apache pinot', 'pinot controller']],
  ['snowflake', ['snowflake']],
  ['bigquery', ['bigquery']],
  ['redshift', ['redshift']],
  ['azure-synapse', ['azure synapse', 'synapse sql']],
  ['databricks', ['databricks']],
  ['tableau', ['tableau']],
  ['powerbi', ['power bi', 'powerbi']],
  ['metabase', ['metabase']],
  ['superset', ['apache superset', 'superset']],
  ['looker', ['looker']],
  ['qlik', ['qlik']],
  ['mode-analytics', ['mode analytics']],
  ['apache-beam', ['apache beam', 'beam pipeline']],
  ['apache-nifi', ['apache nifi', 'nifi flow']],
  ['meltano', ['meltano']],
  ['hevo-data', ['hevo data']],
  ['matillion', ['matillion']],
  ['talend', ['talend']],
  ['informatica', ['informatica']],
  ['dataform', ['dataform']],
  ['great-expectations', ['great expectations', 'gx checkpoint']],
  ['monte-carlo', ['monte carlo']],
  ['soda-core', ['soda core', 'soda scan']],
  ['apache-hudi', ['apache hudi', 'hudi deltastreamer']],
  ['delta-lake', ['delta lake']],
  ['apache-iceberg', ['apache iceberg', 'iceberg table']],
  ['starrocks', ['starrocks']],
  ['greenplum', ['greenplum']],
  ['teradata', ['teradata']],
  ['supabase', ['supabase']],
  ['firebase', ['firebase']],
  ['hasura', ['hasura']],
  ['gitpod', ['gitpod']],
  ['dynatrace', ['dynatrace']],
  ['appdynamics', ['appdynamics']],
  ['bugsnag', ['bugsnag']],
  ['rollbar', ['rollbar']],
  ['lacework', ['lacework']],
  ['openstack', ['openstack', 'nova', 'neutron']],
  ['oracle-cloud', ['oracle cloud infrastructure', 'oci tenancy']],
  ['alibaba-cloud', ['alibaba cloud', 'aliyun']],
  ['tencent-cloud', ['tencent cloud', 'tke cluster']],
  ['digitalocean', ['digitalocean', 'doctl']],
  ['linode', ['linode']],
  ['minio', ['minio']],
  ['ceph', ['ceph']],
  ['etcd', ['etcd']],
  ['zookeeper', ['zookeeper']],
  ['kong', ['kong gateway', 'kong route']],
  ['apisix', ['apache apisix', 'apisix route']],
  ['keycloak', ['keycloak']],
  ['okta', ['okta']],
  ['auth0', ['auth0']],
  ['launchdarkly', ['launchdarkly']],
  ['unleash', ['unleash']],
  ['splitio', ['split.io', 'splitio']],
  ['flagsmith', ['flagsmith']],
  ['pagerduty', ['pagerduty']],
  ['opsgenie', ['opsgenie']],
  ['victorops', ['victorops']],
  ['statuspage', ['statuspage']],
  ['incident-io', ['incident.io', 'incident io']],
  ['firehydrant', ['firehydrant']],
  ['rootly', ['rootly']],
  ['squadcast', ['squadcast']],
  ['grafana-oncall', ['grafana oncall']],
  ['cloudbees', ['cloudbees']],
  ['jenkins-x', ['jenkins x', 'jenkins-x']],
  ['backstage', ['backstage']],
  ['portainer', ['portainer']],
  ['rancher', ['rancher']],
  ['longhorn', ['longhorn']],
  ['rook-ceph', ['rook-ceph', 'rook ceph']],
  ['temporal', ['temporal']],
  ['prefect', ['prefect']],
  ['camunda', ['camunda']],
  ['zeebe', ['zeebe']],
  ['n8n', ['n8n']],
  ['mulesoft', ['mulesoft']],
  ['boomi', ['boomi']],
  ['apigee', ['apigee']],
  ['gravitee', ['gravitee']],
  ['kong-konnect', ['kong konnect', 'kong-konnect']],
  ['consul-connect', ['consul connect', 'consul-connect']],
  ['boundary', ['hashicorp boundary', 'boundary']],
  ['gremlin', ['gremlin']],
  ['litmuschaos', ['litmuschaos', 'litmus chaos']],
  ['chaos-mesh', ['chaos mesh', 'chaos-mesh']],
  ['steadybit', ['steadybit']],
  ['eventbridge', ['eventbridge']],
  ['aws-step-functions', ['step functions', 'states execution']],
  ['dapr', ['dapr']],
  ['eventarc', ['eventarc']],
  ['workato', ['workato']],
  ['tray-io', ['tray.io', 'tray io']],
  ['k6', ['k6 run', 'k6 cloud']],
  ['gatling', ['gatling']],
  ['locust', ['locust']],
  ['jmeter', ['jmeter']],
  ['artillery', ['artillery']],
  ['vegeta', ['vegeta']],
  ['fortio', ['fortio']],
  ['chaosblade', ['chaosblade']],
  ['salesforce', ['salesforce']],
  ['servicenow', ['servicenow', 'service now']],
  ['jira', ['jira']],
  ['confluence', ['confluence']],
  ['slack', ['slack']],
  ['workday', ['workday']],
  ['netsuite', ['netsuite']],
  ['sap', ['sap']],
  ['zendesk', ['zendesk']],
  ['freshdesk', ['freshdesk']],
  ['hubspot', ['hubspot']],
  ['stripe', ['stripe']],
  ['adyen', ['adyen']],
  ['braintree', ['braintree']],
  ['paypal', ['paypal']],
  ['square', ['square']],
  ['plaid', ['plaid']],
  ['twilio', ['twilio']],
  ['sendgrid', ['sendgrid']],
  ['mailgun', ['mailgun']],
  ['segment', ['segment']],
  ['rudderstack', ['rudderstack']],
  ['opentelemetry', ['opentelemetry', 'otel']],

  // ── Web Frameworks (JS/TS) ──────────────────────────────────────
  ['express', ['express', 'expressjs', 'express server']],
  ['fastify', ['fastify', 'fastify server']],
  ['hapi', ['hapi', '@hapi/hapi']],
  ['koa', ['koa', 'koa server']],
  ['nestjs', ['nestjs', '@nestjs', 'nest.js']],
  ['nextjs', ['next.js', 'nextjs', 'next build', 'next start', 'next dev']],
  ['nuxt', ['nuxt', 'nuxt3', 'nuxt build', 'nuxt generate']],
  ['sveltekit', ['sveltekit', 'svelte kit', 'sveltekit adapter']],
  ['remix', ['remix', '@remix-run', 'remix build']],
  ['astro', ['astro', 'astro build', 'astro dev', 'astro check']],
  ['adonis', ['adonisjs', 'adonis', 'ace make:']],
  ['hono', ['hono', 'honojs', 'hono server']],
  ['deno-runtime', ['deno', 'deno task', 'deno run', 'deno compile']],
  ['elysia', ['elysia', 'elysiajs']],
  ['feathers', ['feathers', 'feathersjs', '@feathersjs']],

  // ── Logging Libraries ────────────────────────────────────────────
  ['pino', ['pino', 'pino pretty', 'pino.info']],
  ['winston', ['winston', 'winston logger']],
  ['bunyan', ['bunyan', 'bunyan logger']],
  ['morgan', ['morgan', 'morgan logger']],
  ['log4js', ['log4js', 'log4js-node']],
  ['log4j', ['log4j', 'org.apache.log4j']],
  ['slf4j', ['slf4j', 'org.slf4j']],
  ['zap-logger', ['zap logger', 'go.uber.org/zap']],
  ['zerolog', ['zerolog', 'rs/zerolog']],
  ['structlog', ['structlog', 'python-structlog']],
  ['loguru', ['loguru', 'loguru.py']],
  ['spdlog', ['spdlog']],

  // ── Mobile Frameworks ────────────────────────────────────────────
  ['react-native', ['react native', 'react-native', 'reactnative']],
  ['flutter', ['flutter', 'flutter test', 'flutter build']],
  ['expo', ['expo', 'expo-cli', 'expo start', 'eas build']],
  ['capacitor', ['capacitor', '@capacitor', 'capacitor run']],
  ['ionic', ['ionic', 'ionic framework', 'ionic cap']],

  // ── Desktop Frameworks ────────────────────────────────────────────
  ['electron', ['electron', 'electron-builder', 'electron-forge']],
  ['tauri', ['tauri', 'tauri app', 'tauri build']],
  ['qt', ['qt framework', 'qwarning', 'qdebug', 'qcritical']],

  // ── CMS Platforms ────────────────────────────────────────────────
  ['wordpress', ['wordpress', 'wp-content', 'wp-admin', 'wp-includes']],
  ['drupal', ['drupal', 'drupal.org']],
  ['strapi', ['strapi', 'strapi start']],
  ['ghost-cms', ['ghost cms', 'ghost blog', 'ghost-cli']],
  ['contentful', ['contentful']],
  ['sanity', ['sanity.io', 'sanity studio', 'sanity start']],
  ['payload', ['payload cms', 'payloadcms', 'payload start']],
  ['directus', ['directus', 'directus start']],
  ['webflow', ['webflow']],

  // ── E-commerce ───────────────────────────────────────────────────
  ['shopify', ['shopify', 'shopify-cli']],
  ['magento', ['magento', 'magento2']],
  ['woocommerce', ['woocommerce']],
  ['bigcommerce', ['bigcommerce']],
  ['medusa', ['medusajs', 'medusa start', 'medusa new']],

  // ── Search Engines ───────────────────────────────────────────────
  ['meilisearch', ['meilisearch', 'meili search', 'meilisearch index']],
  ['typesense', ['typesense', 'typesense server']],
  ['solr', ['solr', 'apache solr', 'solrconfig']],
  ['algolia', ['algolia', 'algolia index']],

  // ── Java App Servers ─────────────────────────────────────────────
  ['tomcat', ['tomcat', 'apache tomcat', 'catalina.start']],
  ['jetty', ['jetty', 'eclipse jetty', 'jetty.server']],
  ['wildfly', ['wildfly', 'jboss', 'jboss-as']],
  ['glassfish', ['glassfish', 'glassfish server']],
  ['websphere', ['websphere', 'ibm websphere', 'was server']],
  ['weblogic', ['weblogic', 'oracle weblogic']],

  // ── Java Frameworks ──────────────────────────────────────────────
  ['micronaut', ['micronaut', 'micronaut startup']],
  ['quarkus', ['quarkus', 'quarkus dev', 'quarkus build']],
  ['vertx', ['vert.x', 'vertx', 'io.vertx']],
  ['helidon', ['helidon', 'helidon se', 'helidon mp']],
  ['jakarta-ee', ['jakarta ee', 'jakarta.ee', 'javax.']],

  // ── Python Lint/Format ──────────────────────────────────────────
  ['ruff', ['ruff', 'ruff check', 'ruff format']],
  ['mypy', ['mypy', 'mypy: error:', 'mypy: warning:']],
  ['pyright', ['pyright', 'pyright -']],
  ['pylint', ['pylint', 'pylint --']],
  ['isort', ['isort', 'isort --']],

  // ── Python Async Frameworks ─────────────────────────────────────
  ['aiohttp', ['aiohttp', 'aiohttp.server']],
  ['sanic', ['sanic', 'sanic server']],
  ['tornado-framework', ['tornado', 'tornado.web']],
  ['twisted', ['twisted', 'twisted.internet']],
  ['scrapy', ['scrapy', 'scrapy crawl', 'scrapy.spider']],

  // ── Go Frameworks ────────────────────────────────────────────────
  ['echo-framework', ['echo lab', 'labstack/echo', 'echo v4']],
  ['fiber', ['fiber', 'gofiber', 'fiber v2']],
  ['chi', ['chi router', 'go-chi', 'chi.middleware']],
  ['buffalo', ['buffalo', 'gobuffalo', 'buffalo dev']],
  ['revel', ['revel', 'revel framework', 'revel run']],
  ['go-kit', ['go-kit', 'go kit', 'go-kit/kit']],
  ['go-micro', ['go-micro', 'go micro', 'micro server']],

  // ── Rust Frameworks ──────────────────────────────────────────────
  ['rocket', ['rocket.rs', 'rocket rust', 'rocket server']],
  ['warp-framework', ['warp filter', 'seanmonstar/warp', 'warp server']],
  ['axum', ['axum', 'tokio-rs/axum', 'axum router']],
  ['tide', ['tide', 'http-rs/tide', 'tide server']],

  // ── Ruby Frameworks ──────────────────────────────────────────────
  ['sinatra', ['sinatra', 'sinatra app']],
  ['hanami', ['hanami', 'hanami server']],
  ['puma', ['puma webserver', 'puma worker', 'puma starting']],
  ['unicorn-rb', ['unicorn worker', 'unicorn master', 'unicorn_rails']],
  ['passenger', ['passenger', 'phusion passenger']],

  // ── ORM / Database Tools ─────────────────────────────────────────
  ['prisma', ['prisma', 'prisma migrate', 'prisma generate', 'prisma db']],
  ['drizzle-orm', ['drizzle-orm', 'drizzle kit', 'drizzle push']],
  ['typeorm', ['typeorm', 'typeorm query', 'typeorm:']],
  ['sequelize', ['sequelize', 'sequelize-cli']],
  ['knex', ['knex', 'knexfile', 'knex migrate']],
  ['flyway', ['flyway', 'flyway migrate', 'flyway validate']],
  ['liquibase', ['liquibase', 'liquibase update']],
  ['alembic', ['alembic', 'alembic upgrade', 'alembic revision']],
  ['sqlalchemy', ['sqlalchemy', 'sqlalchemy.orm']],
  ['mongoose', ['mongoose', 'mongoose:', 'mongoose.connect']],
  ['mikro-orm', ['mikro-orm', 'mikroorm', 'mikro-orm migrate']],
  ['objection', ['objection.js', 'objectionjs']],

  // ── Edge / Serverless Runtimes ────────────────────────────────────
  ['cloudflare-workers', ['cloudflare workers', 'wrangler', 'wrangler dev']],
  ['deno-deploy', ['deno deploy', 'deployctl']],
  ['serverless-framework', ['serverless framework', 'serverless deploy', 'serverless invoke']],
  ['openwhisk', ['openwhisk', 'wsk action']],
  ['nuclio', ['nuclio', 'nuclio function']],

  // ── Real-time / WebSocket ────────────────────────────────────────
  ['socketio', ['socket.io', 'socketio', 'socket.io server']],
  ['pusher', ['pusher', 'pusher channel']],
  ['ably', ['ably', 'ably channel', 'ably realtime']],
  ['livekit', ['livekit', 'livekit-server']],
  ['centrifugo', ['centrifugo', 'centrifugal']],

  // ── GraphQL ──────────────────────────────────────────────────────
  ['apollo-server', ['apollo server', 'apollo-server', 'apollographql']],
  ['graphql-yoga', ['graphql yoga', 'graphql-yoga']],
  ['mercurius', ['mercurius', 'mercurius upload']],
  ['dgraph', ['dgraph', 'dgraph query', 'dgraph ratel']],

  // ── Observability (continued) ────────────────────────────────────
  ['instana', ['instana', 'instana sensor']],
  ['signalfx', ['signalfx', 'signal fx', 'signalfx ingest']],
  ['lightstep', ['lightstep', 'lightstep tracer']],
  ['thanos', ['thanos', 'thanos.io', 'thanos query']],
  ['cortex', ['cortexmetrics', 'cortex metrics', 'cortex ruler']],
  ['victoriametrics', ['victoriametrics', 'victoria metrics', 'vminsert']],
  ['grafana-tempo', ['grafana tempo', 'tempo query', 'tempo-distributor']],

  // ── AI / ML ──────────────────────────────────────────────────────
  ['openai-api', ['openai', 'openai api', 'openai.error']],
  ['huggingface', ['huggingface', 'hugging face', 'huggingface.co']],
  ['ollama', ['ollama', 'ollama run', 'ollama serve']],
  ['vllm', ['vllm', 'vllm serve', 'vllm engine']],
  ['torchserve', ['torchserve', 'torch serve', 'ts torchserve']],
  ['comfyui', ['comfyui', 'comfyui manager']],
  ['stable-diffusion', ['stable diffusion', 'stablediffusion', 'sd-webui']],
  ['deepspeed', ['deepspeed', 'deepspeed runner']],
  ['llama-cpp', ['llama.cpp', 'llama cpp', 'llama-cpp-python']],

  // ── Auth / Identity ──────────────────────────────────────────────
  ['clerk', ['clerk', 'clerk.dev']],
  ['firebase-auth', ['firebase auth', 'firebaseauthentication']],
  ['supabase-auth', ['supabase auth', 'gotrue']],
  ['authelia', ['authelia', 'authelia portal']],
  ['lldap', ['lldap']],
  ['dex-idp', ['dex idp', 'dexidp/dex']],
  ['zitadel', ['zitadel', 'zitadel auth']],

  // ── Secrets / Config Management ──────────────────────────────────
  ['aws-secrets-manager', ['secrets manager', 'aws secretsmanager']],
  ['aws-kms', ['aws kms', 'kms.amazonaws']],
  ['doppler', ['doppler', 'doppler secrets', 'doppler run']],
  ['infisical', ['infisical', 'infisical scan']],
  ['aws-ssm', ['ssm parameter', 'aws ssm', 'amazon ssm']],

  // ── Storage / CDN ────────────────────────────────────────────────
  ['aws-s3', ['s3 bucket', 'aws s3', 'amazon s3', 's3.amazonaws']],
  ['gcs', ['google cloud storage', 'gcs bucket', 'storage.googleapis']],
  ['azure-blob', ['azure blob', 'blob storage', 'blob.core.windows']],
  ['backblaze-b2', ['backblaze b2', 'b2 cloud', 'b2api']],
  ['wasabi', ['wasabi', 'wasabisys']],
  ['akamai', ['akamai', 'akamaihd.net', 'akamai edge']],
  ['imperva', ['imperva', 'imperva waf', 'incapsula']],

  // ── Game Engines ─────────────────────────────────────────────────
  ['unity', ['unity', 'unityengine', 'unityplayer']],
  ['unreal-engine', ['unreal engine', 'unrealengine', 'ue5']],
  ['godot', ['godot engine', 'godot', 'godot project']],
  ['bevy', ['bevy engine', 'bevy', 'bevy_ecs']],

  // ── IoT / Embedded ──────────────────────────────────────────────
  ['platformio', ['platformio', 'platformio.org', 'pio run']],
  ['arduino', ['arduino', 'arduino-cli']],
  ['esphome', ['esphome', 'esphome config']],
  ['home-assistant', ['home assistant', 'homeassistant', 'hassio']],
  ['tasmota', ['tasmota', 'tasmota mqtt']],
  ['openhab', ['openhab', 'openhabian']],

  // ── Networking / VPN ─────────────────────────────────────────────
  ['wireguard', ['wireguard', 'wg0']],
  ['tailscale', ['tailscale', 'tailscale up']],
  ['ngrok', ['ngrok', 'ngrok http']],
  ['cloudflare-tunnel', ['cloudflare tunnel', 'cloudflared']],
  ['zerotier', ['zerotier', 'zerotier-one']],

  // ── Analytics ────────────────────────────────────────────────────
  ['posthog', ['posthog', 'posthog capture']],
  ['amplitude', ['amplitude', 'amplitude identify']],
  ['mixpanel', ['mixpanel', 'mixpanel track']],
  ['heap-analytics', ['heap analytics', 'heap.io', 'heap track']],
  ['plausible', ['plausible', 'plausible analytics']],
  ['matomo', ['matomo', 'piwik']],
  ['countly', ['countly', 'countly server']],

  // ── Email Services ───────────────────────────────────────────────
  ['aws-ses', ['amazon ses', 'aws ses', 'email.amazonaws']],
  ['mailchimp', ['mailchimp', 'mandrill']],
  ['brevo', ['brevo', 'sendinblue']],
  ['postmark', ['postmark', 'postmarkapp']],
  ['resend', ['resend', 'resend.com']],
  ['sparkpost', ['sparkpost', 'sparkpost mail']],

  // ── Databases (more) ────────────────────────────────────────────
  ['surrealdb', ['surrealdb', 'surrealdb start']],
  ['planetscale', ['planetscale', 'pscale', 'planetscale database']],
  ['neon-db', ['neon database', 'neondatabase', 'neon.tech']],
  ['d1-database', ['cloudflare d1', 'd1 database', 'wrangler d1']],
  ['tigerbeetle', ['tigerbeetle', 'tigerbeetle start']],
  ['foundationdb', ['foundationdb', 'foundation db', 'fdbserver']],
  ['apache-geode', ['apache geode', 'geode', 'gfsh']],
  ['orientdb', ['orientdb', 'orientdb server']],
  ['arangodb', ['arangodb', 'arangoimp']],

  // ── Mobile CI/CD ─────────────────────────────────────────────────
  ['bitrise', ['bitrise', 'bitrise.io']],
  ['codemagic', ['codemagic', 'codemagic-cli']],
  ['appcenter', ['app center', 'appcenter', 'appcenter.ms']],
  ['fastlane', ['fastlane', 'fastlane lane']],

  // ── CI/CD (more) ─────────────────────────────────────────────────
  ['dagger', ['dagger', 'dagger.io', 'dagger do']],
  ['woodpecker-ci', ['woodpecker', 'woodpecker-ci', 'woodpecker pipeline']],
  ['agola', ['agola', 'agola run', 'agoladb']],

  // ── Testing (more) ──────────────────────────────────────────────
  ['testcafe', ['testcafe', 'testcafe runner']],
  ['nightwatch', ['nightwatch', 'nightwatchjs', 'nightwatch test']],
  ['webdriverio', ['webdriverio', 'wdio', 'wdio runner']],
  ['selenium', ['selenium', 'selenium webdriver', 'selenium grid']],
  ['cucumber', ['cucumber', 'cucumber-js', 'cucumber test']],
  ['robot-framework', ['robot framework', 'robotframework', 'robot --test']],
  ['behave', ['behave', 'behave bdd']],

  // ── Load Testing (more) ─────────────────────────────────────────
  ['hey', ['rakyll/hey', 'hey -z']],
  ['wrk', ['wg/wrk', 'wrk -t']],

  // ── Documentation ────────────────────────────────────────────────
  ['docusaurus', ['docusaurus', 'docusaurus build', 'docusaurus start']],
  ['mkdocs-material', ['mkdocs-material', 'mkdocs build']],
  ['sphinx', ['sphinx', 'sphinx-build', 'sphinx-autogen']],
  ['mdbook', ['mdbook', 'rust-lang/mdbook', 'mdbook build']],

  // ── Workflow (more) ──────────────────────────────────────────────
  ['kestra', ['kestra', 'kestra flow']],
  ['windmill', ['windmill', 'windmill-dev', 'windmill script']],
  ['inngest', ['inngest', 'inngest function']],
  ['triggerdev', ['trigger.dev', 'triggerdev', 'trigger.dev job']],

  // ── Messaging (more) ────────────────────────────────────────────
  ['bullmq', ['bullmq', 'bull mq', 'bullmq queue']],
  ['bull-redis', ['bull redis', 'bull queue', 'bull.process']],

  // ── Infrastructure (more) ────────────────────────────────────────
  ['aws-cdk', ['aws cdk', 'cdk deploy', 'cdk synth', 'cdk diff']],
  ['cdktf', ['cdktf', 'cdk for terraform', 'cdktf deploy']],
  ['minikube', ['minikube', 'minikube start', 'minikube dashboard']],
  ['kind', ['kind create', 'sigs.k8s.io/kind']],
  ['k3s', ['k3s', 'k3s server', 'k3s agent']],
  ['k3d', ['k3d', 'k3d cluster', 'k3d create']],

  // ── AI Frameworks (continued) ────────────────────────────────────
  ['langchain', ['langchain', 'langchain.py', 'langchain.js']],

  // ── FinOps / Cost ────────────────────────────────────────────────
  ['opencost', ['opencost', 'opencost metrics']],
  ['kubecost', ['kubecost', 'kubecost api']],
  ['aws-cost-explorer', ['cost explorer', 'aws cost']],

  // ── Policy / Governance ──────────────────────────────────────────
  ['opa', ['open policy agent', 'opa eval', 'rego:']],
  ['sentinel', ['sentinel policy', 'hashicorp sentinel']],

  // ── Browser Automation ───────────────────────────────────────────
  ['puppeteer', ['puppeteer', 'puppeteer browser']],
  ['playwright-test', ['playwright test', '@playwright/test']],

  // ── Container Registries (more) ──────────────────────────────────
  ['ecr', ['amazon ecr', 'aws ecr', 'ecr.amazonaws']],
  ['gcr', ['gcr.io', 'google container registry']],
  ['acr', ['azure container registry', 'azurecr.io']],

  // ── Config Management (more) ──────────────────────────────────────
  ['cosign', ['cosign', 'cosign sign', 'cosign verify']],
  ['sbom', ['sbom', 'syft sbom', 'spdx']],
  ['syft', ['syft', 'syft packages']],
  ['scorecard', ['openssf scorecard', 'scorecard', 'oss scorecard']],

  // ── Git Tools ────────────────────────────────────────────────────
  ['gitlab', ['gitlab.com', 'gitlab runner', 'gitlab api']],
  ['bitbucket', ['bitbucket', 'bitbucket-pipelines', 'bitbucket.org']],
  ['pre-commit', ['pre-commit', 'pre-commit run']],
  ['husky', ['husky', 'husky install']],

  // ── Language Runtimes ────────────────────────────────────────────
  ['graalvm', ['graalvm', 'native-image']],
  ['jvm', ['hotspot', 'openjdk', 'java version']],
  ['v8', ['v8 engine', 'v8::']],
  ['cpython', ['cpython', 'python3.1', 'python3.1']],

  // ── Network / DNS ────────────────────────────────────────────────
  ['coredns', ['coredns', 'coredns plugin']],
  ['powerdns', ['powerdns', 'pdns']],
  ['bind9', ['bind9', 'named:', 'isc bind']],

  // ── Service Mesh (more) ──────────────────────────────────────────
  ['aws-app-mesh', ['app mesh', 'aws app mesh']],
  ['consul-service-mesh', ['consul service mesh', 'consul connect proxy']],

  // ── Backup / DR ──────────────────────────────────────────────────
  ['velero', ['velero', 'velero backup', 'velero restore']],
  ['restic', ['restic', 'restic backup', 'restic restore']],
  ['borg', ['borg backup', 'borgmatic']],
];

export const KNOWN_LOG_SOURCES: readonly string[] = LOG_SOURCE_SIGNATURES.map(
  ([source]) => source,
);

function collectDetectedSourceHits(
  line: string,
  hits: Map<string, number>,
  sources: readonly (readonly [string, readonly string[]])[] = LOG_SOURCE_SIGNATURES,
): void {
  const normalized = line.toLowerCase();

  for (const [source, markers] of sources) {
    for (const marker of markers) {
      if (normalized.includes(marker)) {
        hits.set(source, (hits.get(source) ?? 0) + 1);
        break;
      }
    }
  }
}

function rankDetectedSources(
  hits: ReadonlyMap<string, number>,
  limit = 12,
): readonly string[] {
  if (limit <= 0) {
    return [];
  }

  return [...hits.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([source]) => source);
}

export function detectLogSources(
  input: string | readonly string[],
  limit = 12,
): readonly string[] {
  const hits = new Map<string, number>();
  const lines =
    typeof input === 'string' ? input.split(/\r?\n/u) : [...input];

  for (const line of lines) {
    collectDetectedSourceHits(line, hits);
  }

  return rankDetectedSources(hits, limit);
}

export function parseAggressiveness(value: string | undefined): Aggressiveness {
  const normalized = (value ?? 'high').toLowerCase();

  if ((AGGRESSIVENESS_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as Aggressiveness;
  }

  throw new Error(
    `Unsupported aggressiveness "${value}". Expected one of: ${AGGRESSIVENESS_LEVELS.join(', ')}.`,
  );
}

export function sanitizeLine(line: string): string {
  return line
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(UUID_PATTERN, '[ID]')
    .replace(UTC_TIME_PATTERN, '[TIME]')
    .replace(COMMON_LOG_TIME_PATTERN, '[TIME]')
    .replace(NGINX_ERROR_TIME_PATTERN, '[TIME]')
    .replace(ISO_TIME_PATTERN, '[TIME]')
    .replace(IPV4_WITH_PORT_PATTERN, '[IP]:[PORT]')
    .replace(IPV4_PATTERN, '[IP]')
    .replace(HEX_HASH_PATTERN, '[HASH]')
    .replace(ALPHANUMERIC_HASH_PATTERN, '[HASH]')
    .replace(AWS_ACCESS_KEY_PATTERN, '[REDACTED]')
    .replace(AWS_ARN_ACCOUNT_PATTERN, (match, accountId) =>
      match.replace(accountId, '[ACCOUNT]'),
    )
    .replace(/[ \t]+$/u, '');
}

export function createRepeatSignature(line: string): string {
  return tokenizeRepeatLine(line)
    .map((token) => {
      const tokenValue = splitRepeatToken(token);
      return tokenValue === undefined
        ? token
        : `${tokenValue.prefix}[VALUE]`;
    })
    .join(' ');
}

interface RepeatTokenValue {
  prefix: string;
  value: string;
}

interface RepeatDelta {
  prefix: string;
  values: string[];
  hasMoreValues: boolean;
}

interface RepeatGroup {
  firstLine: string;
  firstTokens: string[];
  signature: string;
  deltas: Map<number, RepeatDelta>;
  count: number;
}

function tokenizeRepeatLine(line: string): string[] {
  return line.trim().split(/\s+/u);
}

function splitRepeatToken(token: string): RepeatTokenValue | undefined {
  const separator = token.indexOf('=');

  if (separator <= 0 || separator === token.length - 1) {
    return undefined;
  }

  return {
    prefix: token.slice(0, separator + 1),
    value: token.slice(separator + 1),
  };
}

function createRepeatGroup(line: string): RepeatGroup {
  return {
    firstLine: line,
    firstTokens: tokenizeRepeatLine(line),
    signature: createRepeatSignature(line),
    deltas: new Map<number, RepeatDelta>(),
    count: 1,
  };
}

function addRepeatGroupLine(group: RepeatGroup, line: string): void {
  const tokens = tokenizeRepeatLine(line);

  for (const [index, firstToken] of group.firstTokens.entries()) {
    const firstValue = splitRepeatToken(firstToken);
    const nextValue = splitRepeatToken(tokens[index]);

    if (
      firstValue === undefined ||
      nextValue === undefined ||
      firstValue.prefix !== nextValue.prefix ||
      firstValue.value === nextValue.value
    ) {
      continue;
    }

    const delta = group.deltas.get(index) ?? {
      prefix: firstValue.prefix,
      values: [firstValue.value],
      hasMoreValues: false,
    };

    if (!group.deltas.has(index)) {
      group.deltas.set(index, delta);
    }

    if (delta.values.includes(nextValue.value)) {
      continue;
    }

    if (delta.values.length < MAX_REPEAT_DELTA_VALUES) {
      delta.values.push(nextValue.value);
    } else {
      delta.hasMoreValues = true;
    }
  }

  group.count += 1;
}

function renderRepeatGroup(group: RepeatGroup): string {
  if (group.deltas.size === 0) {
    return group.firstLine;
  }

  const tokens = [...group.firstTokens];

  for (const [index, delta] of group.deltas) {
    const values = delta.hasMoreValues
      ? [...delta.values, '…']
      : delta.values;
    tokens[index] = `${delta.prefix}[${values.join(' | ')}]`;
  }

  return tokens.join(' ');
}

export function shouldKeepLine(line: string): boolean {
  if (line.trim().length === 0) {
    return false;
  }

  if (IGNORED_LOG_TAG_PATTERN.test(line)) {
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

/**
 * Multi-signal relevance score for a single (sanitized) log line.
 * >= SCORE_KEEP_THRESHOLD  → emit immediately
 * 0 to <SCORE_KEEP_THRESHOLD → buffer in context window
 * < 0 or -Infinity         → drop
 */
export function scoreLineRelevance(
  line: string,
  aggressiveness: Aggressiveness,
  seenCount = 0,
): number {
  if (line.trim().length === 0) return -Infinity;

  // Noise tags always drop – callers may short-circuit before this
  if (IGNORED_LOG_TAG_PATTERN.test(line)) return -Infinity;

  let score = 0;

  // High-value signals (additive – a line can match multiple)
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

  // Stack-frame signals
  if (
    STACK_FRAME_PATTERN.test(line) ||
    JAVA_STACK_FRAME_PATTERN.test(line) ||
    PYTHON_STACK_FRAME_PATTERN.test(line) ||
    GO_GOROUTINE_PATTERN.test(line) ||
    PYTHON_TRACEBACK_PATTERN.test(line) ||
    STACK_MORE_PATTERN.test(line)
  ) {
    score += 40;
  }

  // Aggressiveness modifiers
  if (
    aggressiveness === 'aggressive' &&
    AGGRESSIVE_WARN_PATTERN.test(line) &&
    !AGGRESSIVE_WARNING_SIGNAL_PATTERN.test(line)
  ) {
    score = -1; // pure WARN without error keyword → drop
  }

  if (aggressiveness === 'low' && LOW_EXTRA_TAG_PATTERN.test(line)) {
    score += 30;
  }

  // TF-IDF dampening: penalise lines seen many times in this stream
  if (seenCount >= TFIDF_REPEAT_THRESHOLD) {
    score -= TFIDF_PENALTY * (seenCount - TFIDF_REPEAT_THRESHOLD + 1);
  }

  return score;
}

export function buildMergedConfig(
  options: BonsaiOptions = {},
): BonsaiCustomConfig & { mergedSources: readonly (readonly [string, readonly string[]])[] } {
  const config = loadBonsaiConfig(options.configPath);
  const mergedSources: (readonly [string, readonly string[]])[] = [
    ...LOG_SOURCE_SIGNATURES,
  ];

  for (const sig of config.sources) {
    const existing = mergedSources.find(([name]) => name === sig.name);
    if (existing !== undefined) {
      const merged = [...new Set([...existing[1], ...sig.markers])];
      const idx = mergedSources.indexOf(existing);
      mergedSources[idx] = [sig.name, merged] as const;
    } else {
      mergedSources.push([sig.name, sig.markers] as const);
    }
  }

  return { ...config, mergedSources };
}

export async function processLogStream(
  input: NodeJS.ReadableStream,
  output: Writable,
  options: BonsaiOptions = {},
): Promise<BonsaiResult> {
  const aggressiveness = parseAggressiveness(options.aggressiveness);
  const merged = buildMergedConfig(options);

  // Compile custom patterns once per stream
  const customDiagnosticRegexes = merged.diagnosticPatterns.map(
    (p) => new RegExp(p, 'u'),
  );
  const customIgnoreRegexes = merged.ignorePatterns.map(
    (p) => new RegExp(p, 'u'),
  );
  const customInternalStackRegexes = merged.internalStackPatterns.map(
    (p) => new RegExp(p, 'u'),
  );
  const customSanitizeRules = merged.sanitizePatterns.map(
    (r) => ({ regex: new RegExp(r.pattern, r.flags ?? 'gu'), replacement: r.replacement }),
  );

  const stats = createEmptyStats();
  const detectedSourceHits = new Map<string, number>();

  // TF-IDF: frequency map for sanitized lines (bounded for memory safety)
  const seenLines = new Map<string, number>();

  // Context window: ring-buffer of soft-scored lines pending near-error promotion
  const contextBefore: string[] = [];
  let afterContextRemaining = 0;

  const lines = createInterface({ input, crlfDelay: Infinity });
  let previousGroup: RepeatGroup | undefined;
  let hidingInternalStack = false;

  const flushPreviousLine = async (): Promise<void> => {
    if (previousGroup === undefined) {
      return;
    }

    const line =
      previousGroup.count > 1
        ? `[x${previousGroup.count}] ${renderRepeatGroup(previousGroup)}`
        : previousGroup.firstLine;

    if (previousGroup.count > 1) {
      stats.duplicateLines += previousGroup.count - 1;
    }

    await writeOutputLine(output, line, stats);
    previousGroup = undefined;
  };

  const emitCandidate = async (line: string): Promise<void> => {
    const signature = createRepeatSignature(line);

    if (previousGroup?.signature === signature) {
      addRepeatGroupLine(previousGroup, line);
      return;
    }

    await flushPreviousLine();
    previousGroup = createRepeatGroup(line);
  };

  // Flush buffered context lines (retroactive promotion near an error)
  const flushContextBefore = async (): Promise<void> => {
    for (const buffered of contextBefore) {
      await emitCandidate(buffered);
    }

    contextBefore.length = 0;
  };

  for await (const rawLine of lines) {
    const line = String(rawLine);
    collectDetectedSourceHits(line, detectedSourceHits, merged.mergedSources);
    stats.inputLines += 1;
    stats.inputWords += countWords(line);
    stats.inputBytes += Buffer.byteLength(`${line}\n`, 'utf8');

    // Empty lines always dropped; don't disturb context state
    if (line.trim().length === 0) {
      stats.droppedLines += 1;
      continue;
    }

    // Custom ignore patterns (drop matching lines early)
    if (customIgnoreRegexes.some((r) => r.test(line))) {
      stats.droppedLines += 1;
      hidingInternalStack = false;
      continue;
    }

    // Noise tags (INFO/DEBUG/TRACE/VERBOSE) are silently dropped without
    // disturbing afterContextRemaining so that sparse INFO lines between
    // errors do not close the context window prematurely.
    if (IGNORED_LOG_TAG_PATTERN.test(line)) {
      stats.droppedLines += 1;
      hidingInternalStack = false;
      continue;
    }

    let sanitized = sanitizeLine(line);

    // Apply custom sanitize rules
    for (const rule of customSanitizeRules) {
      sanitized = sanitized.replace(rule.regex, rule.replacement);
    }

    // Internal stack-frame collapsing (priority over scoring)
    const isCustomInternalStack =
      customInternalStackRegexes.length > 0 &&
      customInternalStackRegexes.some((r) => r.test(sanitized));
    if (isInternalStackTraceLine(sanitized) || isCustomInternalStack) {
      stats.hiddenInternalStackLines += 1;

      if (!hidingInternalStack) {
        await flushContextBefore();
        await emitCandidate(INTERNAL_STACK_MARKER);
        hidingInternalStack = true;
        afterContextRemaining = 0;
      }

      continue;
    }

    hidingInternalStack = false;

    // TF-IDF: track how many times this sanitized form has appeared.
    let seenCount = (seenLines.get(sanitized) ?? 0) + 1;
    if (seenCount === 1 && seenLines.size >= TFIDF_MAP_LIMIT) {
      seenLines.clear();
      seenCount = 1;
    }

    seenLines.set(sanitized, seenCount);

    // Score the sanitized line (built-in + custom diagnostic patterns)
    let score = scoreLineRelevance(sanitized, aggressiveness, seenCount);

    // Custom diagnostic patterns contribute +50 per match (same as built-in DIAGNOSTIC_PATTERN)
    for (const regex of customDiagnosticRegexes) {
      if (regex.test(sanitized)) {
        score += 50;
        break;
      }
    }

    if (score >= SCORE_KEEP_THRESHOLD) {
      // Hard keep: flush buffered context, emit, open after-context window
      await flushContextBefore();
      await emitCandidate(sanitized);
      afterContextRemaining = CONTEXT_WINDOW_AFTER;
    } else if (afterContextRemaining > 0) {
      // Inside after-context window: emit regardless of score
      await emitCandidate(sanitized);
      afterContextRemaining -= 1;
    } else if (score >= 0) {
      // Soft: buffer in context ring (oldest evicted & counted as dropped)
      if (contextBefore.length >= CONTEXT_WINDOW_BEFORE) {
        contextBefore.shift();
        stats.droppedLines += 1;
      }

      contextBefore.push(sanitized);
    } else {
      // Hard drop (score < 0): negative TF-IDF or aggressive WARN suppression
      stats.droppedLines += 1;
      afterContextRemaining = 0;
    }
  }

  // Context lines left without a triggering error are discarded
  stats.droppedLines += contextBefore.length;
  contextBefore.length = 0;

  await flushPreviousLine();

  const inputTokens = estimateTokens(stats.inputWords);
  const outputTokens = estimateTokens(stats.outputWords);
  const savedTokens = Math.max(inputTokens - outputTokens, 0);
  const savingsPercent =
    inputTokens === 0 ? 0 : Math.round((savedTokens / inputTokens) * 10000) / 100;

  return {
    stats,
    inputTokens,
    outputTokens,
    savedTokens,
    savingsPercent,
    detectedSources: rankDetectedSources(detectedSourceHits),
  };
}

export async function processLogFile(
  inputPath: string,
  outputPath: string,
  options: BonsaiOptions = {},
): Promise<BonsaiResult> {
  if (pathsReferToSameFile(inputPath, outputPath)) {
    throw new Error(
      'Input and output paths must be different; refusing to overwrite the input log',
    );
  }

  const input = createReadStream(inputPath, { encoding: 'utf8' });
  const output = createWriteStream(outputPath, { encoding: 'utf8' });

  try {
    const result = await processLogStream(input, output, options);
    output.end();
    await finished(output);
    return { ...result, outputPath };
  } catch (error) {
    input.destroy();
    output.destroy();
    throw error;
  }
}

export function pathsReferToSameFile(
  inputPath: string,
  outputPath: string,
): boolean {
  return (
    path.resolve(inputPath).toLowerCase() ===
    path.resolve(outputPath).toLowerCase()
  );
}

function createEmptyStats(): BonsaiStats {
  return {
    inputLines: 0,
    outputLines: 0,
    inputWords: 0,
    outputWords: 0,
    inputBytes: 0,
    outputBytes: 0,
    droppedLines: 0,
    duplicateLines: 0,
    hiddenInternalStackLines: 0,
  };
}

function countWords(line: string): number {
  return line.trim().match(/\S+/gu)?.length ?? 0;
}

async function writeOutputLine(
  output: Writable,
  line: string,
  stats: BonsaiStats,
): Promise<void> {
  const rendered = `${line}\n`;
  stats.outputLines += 1;
  stats.outputWords += countWords(line);
  stats.outputBytes += Buffer.byteLength(rendered, 'utf8');

  if (!output.write(rendered)) {
    await once(output, 'drain');
  }
}
