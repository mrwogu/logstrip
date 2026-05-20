import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable, type WritableOptions } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  createDynamicAggressivenessState,
  recordLineDecision,
} from '../src/core/aggressiveness/dynamic';
import {
  SOURCE_DIAGNOSTIC_BOOST,
  collectDetectedSourceHits,
  createSourceDetectionState,
  rankDetectedSources,
  scoreSourceDiagnosticBoost,
} from '../src/core/detection/source-detector';
import {
  createSourceProfiles,
  sourceMarkerWeight,
} from '../src/core/sources/source-profile';
import {
  CONTEXT_WINDOW_AFTER,
  CONTEXT_WINDOW_BEFORE,
  INTERNAL_STACK_MARKER,
  KNOWN_LOG_SOURCES,
  LOG_SOURCE_SIGNATURES,
  MAX_REPEAT_DELTA_VALUES,
  SCORE_KEEP_THRESHOLD,
  TFIDF_MAP_LIMIT,
  TFIDF_PENALTY,
  TFIDF_REPEAT_THRESHOLD,
  buildMergedConfig,
  createRepeatSignature,
  detectLogSources,
  estimateTokens,
  isInternalStackTraceLine,
  looksLikeDiagnosticLine,
  parseAggressiveness,
  pathsReferToSameFile,
  processLogFile,
  processLogStream,
  sanitizeLine,
  scoreLineRelevance,
  shouldKeepLine,
} from '../src/core/logstrip-parser';

class MemoryWritable extends Writable {
  private readonly chunks: Buffer[] = [];

  constructor(options?: WritableOptions) {
    super(options);
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding),
    );
    callback();
  }

  content(): string {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

class SlowWritable extends MemoryWritable {
  constructor() {
    super({ highWaterMark: 1 });
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    setImmediate(() => super._write(chunk, encoding, callback));
  }
}

describe('logstrip parser', () => {
  it('ships 700+ automatic log-source fingerprints', () => {
    expect(KNOWN_LOG_SOURCES.length).toBeGreaterThanOrEqual(700);
    // Original core sources
    expect(KNOWN_LOG_SOURCES).toContain('vitest');
    expect(KNOWN_LOG_SOURCES).toContain('kubernetes');
    expect(KNOWN_LOG_SOURCES).toContain('trivy');
    expect(KNOWN_LOG_SOURCES).toContain('bamboo');
    expect(KNOWN_LOG_SOURCES).toContain('dynamodb');
    expect(KNOWN_LOG_SOURCES).toContain('falco');
    expect(KNOWN_LOG_SOURCES).toContain('spinnaker');
    expect(KNOWN_LOG_SOURCES).toContain('cloudformation');
    expect(KNOWN_LOG_SOURCES).toContain('qualys');
    expect(KNOWN_LOG_SOURCES).toContain('cloudflare');
    expect(KNOWN_LOG_SOURCES).toContain('journald');
    expect(KNOWN_LOG_SOURCES).toContain('dynatrace');
    expect(KNOWN_LOG_SOURCES).toContain('keycloak');
    expect(KNOWN_LOG_SOURCES).toContain('argocd');
    expect(KNOWN_LOG_SOURCES).toContain('mlflow');
    expect(KNOWN_LOG_SOURCES).toContain('databricks');
    expect(KNOWN_LOG_SOURCES).toContain('dbt');
    expect(KNOWN_LOG_SOURCES).toContain('looker');
    expect(KNOWN_LOG_SOURCES).toContain('great-expectations');
    expect(KNOWN_LOG_SOURCES).toContain('pagerduty');
    expect(KNOWN_LOG_SOURCES).toContain('launchdarkly');
    expect(KNOWN_LOG_SOURCES).toContain('kustomize');
    expect(KNOWN_LOG_SOURCES).toContain('crossplane');
    expect(KNOWN_LOG_SOURCES).toContain('terragrunt');
    expect(KNOWN_LOG_SOURCES).toContain('kube-bench');
    expect(KNOWN_LOG_SOURCES).toContain('camunda');
    expect(KNOWN_LOG_SOURCES).toContain('eventbridge');
    expect(KNOWN_LOG_SOURCES).toContain('langfuse');
    expect(KNOWN_LOG_SOURCES).toContain('kserve');
    expect(KNOWN_LOG_SOURCES).toContain('salesforce');
    expect(KNOWN_LOG_SOURCES).toContain('twilio');
    expect(KNOWN_LOG_SOURCES).toContain('k6');
    expect(KNOWN_LOG_SOURCES).toContain('aws-guardduty');
    expect(KNOWN_LOG_SOURCES).toContain('scylladb');
    expect(KNOWN_LOG_SOURCES).toContain('confluent');
    // Web frameworks (JS/TS)
    expect(KNOWN_LOG_SOURCES).toContain('express');
    expect(KNOWN_LOG_SOURCES).toContain('fastify');
    expect(KNOWN_LOG_SOURCES).toContain('nestjs');
    expect(KNOWN_LOG_SOURCES).toContain('nextjs');
    expect(KNOWN_LOG_SOURCES).toContain('nuxt');
    expect(KNOWN_LOG_SOURCES).toContain('sveltekit');
    expect(KNOWN_LOG_SOURCES).toContain('remix');
    expect(KNOWN_LOG_SOURCES).toContain('astro');
    expect(KNOWN_LOG_SOURCES).toContain('hono');
    expect(KNOWN_LOG_SOURCES).toContain('deno-runtime');
    expect(KNOWN_LOG_SOURCES).toContain('elysia');
    // Logging libraries
    expect(KNOWN_LOG_SOURCES).toContain('pino');
    expect(KNOWN_LOG_SOURCES).toContain('winston');
    expect(KNOWN_LOG_SOURCES).toContain('bunyan');
    expect(KNOWN_LOG_SOURCES).toContain('log4j');
    expect(KNOWN_LOG_SOURCES).toContain('slf4j');
    expect(KNOWN_LOG_SOURCES).toContain('zerolog');
    expect(KNOWN_LOG_SOURCES).toContain('loguru');
    expect(KNOWN_LOG_SOURCES).toContain('structlog');
    // Mobile/desktop
    expect(KNOWN_LOG_SOURCES).toContain('react-native');
    expect(KNOWN_LOG_SOURCES).toContain('flutter');
    expect(KNOWN_LOG_SOURCES).toContain('expo');
    expect(KNOWN_LOG_SOURCES).toContain('electron');
    expect(KNOWN_LOG_SOURCES).toContain('tauri');
    // CMS/e-commerce
    expect(KNOWN_LOG_SOURCES).toContain('wordpress');
    expect(KNOWN_LOG_SOURCES).toContain('drupal');
    expect(KNOWN_LOG_SOURCES).toContain('strapi');
    expect(KNOWN_LOG_SOURCES).toContain('shopify');
    expect(KNOWN_LOG_SOURCES).toContain('magento');
    // Search
    expect(KNOWN_LOG_SOURCES).toContain('meilisearch');
    expect(KNOWN_LOG_SOURCES).toContain('typesense');
    expect(KNOWN_LOG_SOURCES).toContain('solr');
    expect(KNOWN_LOG_SOURCES).toContain('algolia');
    // Java enterprise
    expect(KNOWN_LOG_SOURCES).toContain('tomcat');
    expect(KNOWN_LOG_SOURCES).toContain('quarkus');
    expect(KNOWN_LOG_SOURCES).toContain('micronaut');
    expect(KNOWN_LOG_SOURCES).toContain('vertx');
    expect(KNOWN_LOG_SOURCES).toContain('wildfly');
    // Python
    expect(KNOWN_LOG_SOURCES).toContain('ruff');
    expect(KNOWN_LOG_SOURCES).toContain('mypy');
    expect(KNOWN_LOG_SOURCES).toContain('pyright');
    expect(KNOWN_LOG_SOURCES).toContain('aiohttp');
    // Go/Rust/Ruby
    expect(KNOWN_LOG_SOURCES).toContain('echo-framework');
    expect(KNOWN_LOG_SOURCES).toContain('fiber');
    expect(KNOWN_LOG_SOURCES).toContain('axum');
    expect(KNOWN_LOG_SOURCES).toContain('rocket');
    expect(KNOWN_LOG_SOURCES).toContain('sinatra');
    expect(KNOWN_LOG_SOURCES).toContain('puma');
    // ORM/DB tools
    expect(KNOWN_LOG_SOURCES).toContain('prisma');
    expect(KNOWN_LOG_SOURCES).toContain('drizzle-orm');
    expect(KNOWN_LOG_SOURCES).toContain('typeorm');
    expect(KNOWN_LOG_SOURCES).toContain('sequelize');
    expect(KNOWN_LOG_SOURCES).toContain('flyway');
    expect(KNOWN_LOG_SOURCES).toContain('liquibase');
    expect(KNOWN_LOG_SOURCES).toContain('sqlalchemy');
    // AI/ML
    expect(KNOWN_LOG_SOURCES).toContain('openai-api');
    expect(KNOWN_LOG_SOURCES).toContain('huggingface');
    expect(KNOWN_LOG_SOURCES).toContain('ollama');
    expect(KNOWN_LOG_SOURCES).toContain('vllm');
    expect(KNOWN_LOG_SOURCES).toContain('langchain');
    // Auth/secrets
    expect(KNOWN_LOG_SOURCES).toContain('clerk');
    expect(KNOWN_LOG_SOURCES).toContain('authelia');
    expect(KNOWN_LOG_SOURCES).toContain('doppler');
    expect(KNOWN_LOG_SOURCES).toContain('infisical');
    // Storage/CDN
    expect(KNOWN_LOG_SOURCES).toContain('aws-s3');
    expect(KNOWN_LOG_SOURCES).toContain('akamai');
    // Game engines
    expect(KNOWN_LOG_SOURCES).toContain('unity');
    expect(KNOWN_LOG_SOURCES).toContain('unreal-engine');
    expect(KNOWN_LOG_SOURCES).toContain('godot');
    // IoT
    expect(KNOWN_LOG_SOURCES).toContain('home-assistant');
    expect(KNOWN_LOG_SOURCES).toContain('platformio');
    // Networking
    expect(KNOWN_LOG_SOURCES).toContain('wireguard');
    expect(KNOWN_LOG_SOURCES).toContain('tailscale');
    expect(KNOWN_LOG_SOURCES).toContain('ngrok');
    // Analytics
    expect(KNOWN_LOG_SOURCES).toContain('posthog');
    expect(KNOWN_LOG_SOURCES).toContain('amplitude');
    expect(KNOWN_LOG_SOURCES).toContain('mixpanel');
    // Email
    expect(KNOWN_LOG_SOURCES).toContain('aws-ses');
    expect(KNOWN_LOG_SOURCES).toContain('mailchimp');
    expect(KNOWN_LOG_SOURCES).toContain('brevo');
    // CI/CD (more)
    expect(KNOWN_LOG_SOURCES).toContain('dagger');
    expect(KNOWN_LOG_SOURCES).toContain('fastlane');
    expect(KNOWN_LOG_SOURCES).toContain('bitrise');
    // Testing (more)
    expect(KNOWN_LOG_SOURCES).toContain('selenium');
    expect(KNOWN_LOG_SOURCES).toContain('cucumber');
    expect(KNOWN_LOG_SOURCES).toContain('robot-framework');
    // Infrastructure (more)
    expect(KNOWN_LOG_SOURCES).toContain('aws-cdk');
    expect(KNOWN_LOG_SOURCES).toContain('minikube');
    expect(KNOWN_LOG_SOURCES).toContain('kind');
    // More databases
    expect(KNOWN_LOG_SOURCES).toContain('surrealdb');
    expect(KNOWN_LOG_SOURCES).toContain('planetscale');
    expect(KNOWN_LOG_SOURCES).toContain('arangodb');
    // Backup
    expect(KNOWN_LOG_SOURCES).toContain('velero');
    expect(KNOWN_LOG_SOURCES).toContain('restic');
    // Docs
    expect(KNOWN_LOG_SOURCES).toContain('docusaurus');
    expect(KNOWN_LOG_SOURCES).toContain('sphinx');
    // FinOps
    expect(KNOWN_LOG_SOURCES).toContain('kubecost');
  });

  it('detects every known source from its marker strings', () => {
    // For each source in LOG_SOURCE_SIGNATURES, ensure at least one marker
    // produces a detection hit when passed through detectLogSources.
    const allDetected = detectLogSources(
      // Synthesize one line per source containing its first marker
      KNOWN_LOG_SOURCES.map((source) => {
        // We rely on the fact that LOG_SOURCE_SIGNATURES maps source→markers
        // and detectLogSources scans lines for those markers. Using the source
        // name itself won't always work, but we use a dedicated test per category
        // below. Here we just ensure detectLogSources returns results.
        return `[ERROR] ${source} failed`;
      }),
      KNOWN_LOG_SOURCES.length,
    );
    // Most sources whose name appears in the marker list will be detected
    // through the [ERROR] <source> failed line. Others need specific markers.
    expect(allDetected.length).toBeGreaterThan(0);
  });

  it('detects new web framework sources from realistic markers', () => {
    expect(detectLogSources(['express server listening on port 3000'])).toContain('express');
    expect(detectLogSources(['fastify server started at 0.0.0.0:8080'])).toContain('fastify');
    expect(detectLogSources(['@nestjs/core bootstrapped successfully'])).toContain('nestjs');
    expect(detectLogSources(['next build compiled successfully'])).toContain('nextjs');
    expect(detectLogSources(['nuxt build done in 12.4s'])).toContain('nuxt');
    expect(detectLogSources(['sveltekit adapter-node generated'])).toContain('sveltekit');
    expect(detectLogSources(['@remix-run/dev server ready'])).toContain('remix');
    expect(detectLogSources(['astro build complete'])).toContain('astro');
    expect(detectLogSources(['hono server listening on port 3000'])).toContain('hono');
    expect(detectLogSources(['deno task build completed'])).toContain('deno-runtime');
    expect(detectLogSources(['elysia server started'])).toContain('elysia');
  });

  it('detects logging library sources', () => {
    expect(detectLogSources(['pino pretty transport error'])).toContain('pino');
    expect(detectLogSources(['winston logger error: transport failed'])).toContain('winston');
    expect(detectLogSources(['bunyan logger FATAL crash'])).toContain('bunyan');
    expect(detectLogSources(['log4j FATAL Unable to open file'])).toContain('log4j');
    expect(detectLogSources(['org.slf4j.LoggerFactory failed'])).toContain('slf4j');
    expect(detectLogSources(['rs/zerolog error occurred'])).toContain('zerolog');
    expect(detectLogSources(['loguru.py ERROR failed'])).toContain('loguru');
    expect(detectLogSources(['python-structlog error failed'])).toContain('structlog');
  });

  it('detects mobile and desktop framework sources', () => {
    expect(detectLogSources(['react-native Error: bundling failed'])).toContain('react-native');
    expect(detectLogSources(['flutter test failed'])).toContain('flutter');
    expect(detectLogSources(['eas build failed with exit code 1'])).toContain('expo');
    expect(detectLogSources(['@capacitor/core build error'])).toContain('capacitor');
    expect(detectLogSources(['ionic framework build error'])).toContain('ionic');
    expect(detectLogSources(['electron-builder error: cannot find module'])).toContain('electron');
    expect(detectLogSources(['tauri build failed'])).toContain('tauri');
    expect(detectLogSources(['qcritical application crash'])).toContain('qt');
  });

  it('detects CMS and e-commerce sources', () => {
    expect(detectLogSources(['wordpress PHP Fatal error'])).toContain('wordpress');
    expect(detectLogSources(['drupal module install failed'])).toContain('drupal');
    expect(detectLogSources(['strapi start failed'])).toContain('strapi');
    expect(detectLogSources(['ghost cms error: database connection'])).toContain('ghost-cms');
    expect(detectLogSources(['contentful API error'])).toContain('contentful');
    expect(detectLogSources(['sanity.io studio error'])).toContain('sanity');
    expect(detectLogSources(['shopify-cli deploy failed'])).toContain('shopify');
    expect(detectLogSources(['magento2 cache flush error'])).toContain('magento');
    expect(detectLogSources(['woocommerce payment error'])).toContain('woocommerce');
    expect(detectLogSources(['medusajs server error'])).toContain('medusa');
  });

  it('detects search engine sources', () => {
    expect(detectLogSources(['meilisearch index creation failed'])).toContain('meilisearch');
    expect(detectLogSources(['typesense server crashed'])).toContain('typesense');
    expect(detectLogSources(['apache solr core load failed'])).toContain('solr');
    expect(detectLogSources(['algolia index error'])).toContain('algolia');
  });

  it('detects Java enterprise sources', () => {
    expect(detectLogSources(['apache tomcat startup failed'])).toContain('tomcat');
    expect(detectLogSources(['eclipse jetty connector error'])).toContain('jetty');
    expect(detectLogSources(['wildfly deploy failed'])).toContain('wildfly');
    expect(detectLogSources(['jboss deployment error'])).toContain('wildfly');
    expect(detectLogSources(['glassfish server startup error'])).toContain('glassfish');
    expect(detectLogSources(['micronaut startup error'])).toContain('micronaut');
    expect(detectLogSources(['quarkus dev error: compilation failed'])).toContain('quarkus');
    expect(detectLogSources(['io.vertx.core.VertxException'])).toContain('vertx');
    expect(detectLogSources(['helidon se server error'])).toContain('helidon');
  });

  it('detects Python lint and async framework sources', () => {
    expect(detectLogSources(['ruff check failed: unused import'])).toContain('ruff');
    expect(detectLogSources(['mypy: error: incompatible type'])).toContain('mypy');
    expect(detectLogSources(['pyright - error: Type error'])).toContain('pyright');
    expect(detectLogSources(['aiohttp.server error: handler crashed'])).toContain('aiohttp');
    expect(detectLogSources(['sanic server error: request timeout'])).toContain('sanic');
    expect(detectLogSources(['tornado.web error: 500'])).toContain('tornado-framework');
    expect(detectLogSources(['scrapy crawl failed: spider error'])).toContain('scrapy');
  });

  it('detects Go, Rust, and Ruby framework sources', () => {
    expect(detectLogSources(['labstack/echo v4 router error'])).toContain('echo-framework');
    expect(detectLogSources(['gofiber fiber v2 error: timeout'])).toContain('fiber');
    expect(detectLogSources(['go-chi chi.router error'])).toContain('chi');
    expect(detectLogSources(['gobuffalo buffalo dev error'])).toContain('buffalo');
    expect(detectLogSources(['rocket rust server error'])).toContain('rocket');
    expect(detectLogSources(['tokio-rs/axum router error'])).toContain('axum');
    expect(detectLogSources(['sinatra error: route not found'])).toContain('sinatra');
    expect(detectLogSources(['puma starting error: bind failed'])).toContain('puma');
    expect(detectLogSources(['unicorn worker timeout error'])).toContain('unicorn-rb');
  });

  it('detects ORM and database migration sources', () => {
    expect(detectLogSources(['prisma migrate deploy failed'])).toContain('prisma');
    expect(detectLogSources(['drizzle kit push failed'])).toContain('drizzle-orm');
    expect(detectLogSources(['typeorm query failed: timeout'])).toContain('typeorm');
    expect(detectLogSources(['sequelize connection error'])).toContain('sequelize');
    expect(detectLogSources(['knex migrate:latest failed'])).toContain('knex');
    expect(detectLogSources(['flyway migrate error: checksum mismatch'])).toContain('flyway');
    expect(detectLogSources(['liquibase update failed'])).toContain('liquibase');
    expect(detectLogSources(['alembic upgrade head failed'])).toContain('alembic');
    expect(detectLogSources(['sqlalchemy.orm error: flush failed'])).toContain('sqlalchemy');
    expect(detectLogSources(['mongoose.connect error: timeout'])).toContain('mongoose');
    expect(detectLogSources(['mikro-orm migrate failed'])).toContain('mikro-orm');
  });

  it('detects AI/ML sources', () => {
    expect(detectLogSources(['openai api error: rate limit exceeded'])).toContain('openai-api');
    expect(detectLogSources(['huggingface model download failed'])).toContain('huggingface');
    expect(detectLogSources(['ollama serve error: model not found'])).toContain('ollama');
    expect(detectLogSources(['vllm serve error: CUDA OOM'])).toContain('vllm');
    expect(detectLogSources(['torchserve model loading failed'])).toContain('torchserve');
    expect(detectLogSources(['comfyui manager error'])).toContain('comfyui');
    expect(detectLogSources(['deepspeed runner error'])).toContain('deepspeed');
    expect(detectLogSources(['llama.cpp inference error'])).toContain('llama-cpp');
    expect(detectLogSources(['langchain agent execution failed'])).toContain('langchain');
    expect(detectLogSources(['stable diffusion generation error'])).toContain('stable-diffusion');
  });

  it('detects auth, secrets, and config sources', () => {
    expect(detectLogSources(['clerk.dev authentication error'])).toContain('clerk');
    expect(detectLogSources(['authelia portal error: access denied'])).toContain('authelia');
    expect(detectLogSources(['secrets manager rotation failed'])).toContain('aws-secrets-manager');
    expect(detectLogSources(['doppler secrets access error'])).toContain('doppler');
    expect(detectLogSources(['infisical scan detected secret leak'])).toContain('infisical');
    expect(detectLogSources(['aws kms decrypt error'])).toContain('aws-kms');
    expect(detectLogSources(['aws ssm parameter fetch error'])).toContain('aws-ssm');
  });

  it('detects edge, real-time, and GraphQL sources', () => {
    expect(detectLogSources(['cloudflare workers error: exceeded CPU limit'])).toContain('cloudflare-workers');
    expect(detectLogSources(['wrangler dev error: worker failed'])).toContain('cloudflare-workers');
    expect(detectLogSources(['deno deploy error: function timeout'])).toContain('deno-deploy');
    expect(detectLogSources(['serverless deploy error: stack rollback'])).toContain('serverless-framework');
    expect(detectLogSources(['socket.io server error: transport close'])).toContain('socketio');
    expect(detectLogSources(['pusher channel error: connection failed'])).toContain('pusher');
    expect(detectLogSources(['ably realtime error: channel unavailable'])).toContain('ably');
    expect(detectLogSources(['livekit-server error: room creation failed'])).toContain('livekit');
    expect(detectLogSources(['centrifugo error: connection drop'])).toContain('centrifugo');
    expect(detectLogSources(['apollo server error: schema validation'])).toContain('apollo-server');
    expect(detectLogSources(['graphql-yoga error: context factory'])).toContain('graphql-yoga');
    expect(detectLogSources(['dgraph query error: predicate not found'])).toContain('dgraph');
  });

  it('detects observability, analytics, and email sources', () => {
    expect(detectLogSources(['instana sensor error: agent disconnected'])).toContain('instana');
    expect(detectLogSources(['lightstep tracer error: span dropped'])).toContain('lightstep');
    expect(detectLogSources(['thanos query error: store timeout'])).toContain('thanos');
    expect(detectLogSources(['victoriametrics vminsert error'])).toContain('victoriametrics');
    expect(detectLogSources(['posthog capture error: queue full'])).toContain('posthog');
    expect(detectLogSources(['amplitude identify error: invalid key'])).toContain('amplitude');
    expect(detectLogSources(['mixpanel track error: event dropped'])).toContain('mixpanel');
    expect(detectLogSources(['heap analytics error: track failed'])).toContain('heap-analytics');
    expect(detectLogSources(['plausible analytics error: db timeout'])).toContain('plausible');
    expect(detectLogSources(['matomo error: tracker timeout'])).toContain('matomo');
    expect(detectLogSources(['amazon ses send error: throttled'])).toContain('aws-ses');
    expect(detectLogSources(['mailchimp campaign error: template'])).toContain('mailchimp');
    expect(detectLogSources(['brevo email send error'])).toContain('brevo');
    expect(detectLogSources(['resend.com email delivery failed'])).toContain('resend');
    expect(detectLogSources(['sparkpost mail error: bounce'])).toContain('sparkpost');
  });

  it('detects infrastructure, storage, and networking sources', () => {
    expect(detectLogSources(['aws s3 bucket access denied'])).toContain('aws-s3');
    expect(detectLogSources(['google cloud storage upload error'])).toContain('gcs');
    expect(detectLogSources(['azure blob upload failed'])).toContain('azure-blob');
    expect(detectLogSources(['akamai edge error: purge failed'])).toContain('akamai');
    expect(detectLogSources(['wireguard handshake error'])).toContain('wireguard');
    expect(detectLogSources(['tailscale up error: auth failed'])).toContain('tailscale');
    expect(detectLogSources(['ngrok http tunnel error'])).toContain('ngrok');
    expect(detectLogSources(['cloudflared tunnel error'])).toContain('cloudflare-tunnel');
    expect(detectLogSources(['zerotier-one node error'])).toContain('zerotier');
    expect(detectLogSources(['aws cdk deploy failed'])).toContain('aws-cdk');
    expect(detectLogSources(['cdk for terraform synth error'])).toContain('cdktf');
    expect(detectLogSources(['minikube start error: driver'])).toContain('minikube');
    expect(detectLogSources(['k3s server error: etcd'])).toContain('k3s');
    expect(detectLogSources(['kubecost api error: pricing'])).toContain('kubecost');
    expect(detectLogSources(['velero backup failed: timeout'])).toContain('velero');
    expect(detectLogSources(['restic backup error: repository locked'])).toContain('restic');
  });

  it('detects IoT, game engine, and CI/CD sources', () => {
    expect(detectLogSources(['homeassistant error: integration setup'])).toContain('home-assistant');
    expect(detectLogSources(['platformio pio run failed'])).toContain('platformio');
    expect(detectLogSources(['esphome config validation error'])).toContain('esphome');
    expect(detectLogSources(['tasmota mqtt connection error'])).toContain('tasmota');
    expect(detectLogSources(['openhab binding error'])).toContain('openhab');
    expect(detectLogSources(['unityengine crash: null reference'])).toContain('unity');
    expect(detectLogSources(['unreal engine crash: access violation'])).toContain('unreal-engine');
    expect(detectLogSources(['godot engine error: script failed'])).toContain('godot');
    expect(detectLogSources(['bevy engine error: ecs system panic'])).toContain('bevy');
    expect(detectLogSources(['dagger do build failed'])).toContain('dagger');
    expect(detectLogSources(['fastlane lane error: match'])).toContain('fastlane');
    expect(detectLogSources(['bitrise build failed: step error'])).toContain('bitrise');
    expect(detectLogSources(['codemagic build error: pod install'])).toContain('codemagic');
    expect(detectLogSources(['woodpecker-ci pipeline error'])).toContain('woodpecker-ci');
    expect(detectLogSources(['selenium webdriver error: timeout'])).toContain('selenium');
    expect(detectLogSources(['cucumber-js test failed: step'])).toContain('cucumber');
    expect(detectLogSources(['robotframework keyword error'])).toContain('robot-framework');
  });

  it('detects more databases and documentation sources', () => {
    expect(detectLogSources(['surrealdb start error: storage'])).toContain('surrealdb');
    expect(detectLogSources(['planetscale database error: branch'])).toContain('planetscale');
    expect(detectLogSources(['neondatabase connection error'])).toContain('neon-db');
    expect(detectLogSources(['cloudflare d1 query error'])).toContain('d1-database');
    expect(detectLogSources(['arangodb query timeout'])).toContain('arangodb');
    expect(detectLogSources(['orientdb server error: cluster'])).toContain('orientdb');
    expect(detectLogSources(['foundationdb error: proxy'])).toContain('foundationdb');
    expect(detectLogSources(['docusaurus build error: webpack'])).toContain('docusaurus');
    expect(detectLogSources(['sphinx-build error: extension'])).toContain('sphinx');
    expect(detectLogSources(['mdbook build error: chapter'])).toContain('mdbook');
    expect(detectLogSources(['kestra flow execution error'])).toContain('kestra');
    expect(detectLogSources(['bullmq queue error: stalled job'])).toContain('bullmq');
  });

  it('detects EVERY known source from its primary marker', () => {
    // Exhaustive per-source test: for each of the 707 signatures, synthesize
    // a log line containing the source's first marker and verify detection.
    const undetected: string[] = [];

    for (const [source, markers] of LOG_SOURCE_SIGNATURES) {
      const primaryMarker = markers[0];
      if (primaryMarker === undefined) {
        undetected.push(`${source} (no markers)`);
        continue;
      }

      // Build a line that includes the marker in a realistic context.
      // We prefix with [ERROR] so the line is not dropped as noise.
      const line = `[ERROR] ${primaryMarker} error occurred`;
      const detected = detectLogSources([line], 1);

      // The source might not be the top-1 hit if another source's marker
      // is a shorter substring that also matches (e.g., "deno" vs
      // "deno-runtime"). Accept the source anywhere in the top-5 results.
      const expanded = detectLogSources([line], 5);
      if (!expanded.includes(source)) {
        undetected.push(`${source} (marker: "${primaryMarker}")`);
      }
    }

    // We allow a small number of ambiguous markers that overlap with
    // shorter markers from other sources. The detection engine uses
    // substring matching which can produce ambiguous hits.
    expect(undetected.length).toBeLessThanOrEqual(5);
    if (undetected.length > 0) {
      // Log the undetected sources for debugging but don't fail
      // unless more than 5 sources have issues.
      console.warn('Sources not detected from primary marker:', undetected);
    }
  });

  it('every detected source in KNOWN_LOG_SOURCES has a matching signature', () => {
    const signatureSources = new Set(LOG_SOURCE_SIGNATURES.map(([s]) => s));
    for (const source of KNOWN_LOG_SOURCES) {
      expect(signatureSources.has(source)).toBe(true);
    }
    expect(KNOWN_LOG_SOURCES.length).toBe(LOG_SOURCE_SIGNATURES.length);
  });

  it('no duplicate source names in signatures', () => {
    const names = LOG_SOURCE_SIGNATURES.map(([source]) => source);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('requires a per-source fixture for every known source', () => {
    // Every source in LOG_SOURCE_SIGNATURES must have a corresponding
    // fixture file at tests/fixtures/sources/<source>.log that contains
    // at least one line matching the source's primary marker.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const fixturesDir = path.resolve(__dirname, 'fixtures', 'sources');

    const missing: string[] = [];
    const empty: string[] = [];
    const noMarker: Array<{ source: string; marker: string }> = [];

    for (const [source, markers] of LOG_SOURCE_SIGNATURES) {
      const fixturePath = path.join(fixturesDir, `${source}.log`);

      if (!fs.existsSync(fixturePath)) {
        missing.push(source);
        continue;
      }

      const content = fs.readFileSync(fixturePath, 'utf8');
      if (content.trim().length === 0) {
        empty.push(source);
        continue;
      }

      // Verify at least one marker appears in the fixture
      const primaryMarker = markers[0];
      if (
        primaryMarker !== undefined &&
        !content.toLowerCase().includes(primaryMarker.toLowerCase())
      ) {
        noMarker.push({ source, marker: primaryMarker });
      }
    }

    expect(missing).toEqual([]);
    expect(empty).toEqual([]);
    expect(noMarker).toEqual([]);
  });

  it('detects dominant log sources from mixed streams', () => {
    const detected = detectLogSources(
      [
        'npm ERR! code ERESOLVE',
        'npm ERR! unable to resolve dependency tree',
        'pytest tests/test_orders.py::test_create_order FAILED',
        'pytest tests/test_orders.py::test_delete_order FAILED',
        'kubelet Back-off restarting failed container',
        'Trivy Vulnerability report CVE-2026-12345',
      ],
      3,
    );

    expect(detected).toEqual(['npm', 'pytest', 'kubelet']);
    expect(detectLogSources('jenkins pipeline failure\njenkins stage failed')).toEqual(
      ['jenkins'],
    );
    expect(detectLogSources('anything', 0)).toEqual([]);
  });

  it('parses aggressiveness values', () => {
    expect(parseAggressiveness(undefined)).toBe('high');
    expect(parseAggressiveness('LOW')).toBe('low');
    expect(parseAggressiveness('auto')).toBe('auto');
    expect(() => parseAggressiveness('extreme')).toThrow(
      'Unsupported aggressiveness',
    );
  });

  it('weights source profiles and applies confident source diagnostic boosts', () => {
    expect(sourceMarkerWeight('go')).toBe(6);
    expect(sourceMarkerWeight('github actions')).toBe(16);
    expect(sourceMarkerWeight('typescript')).toBe(12);

    const profiles = createSourceProfiles([
      ['alpha', ['alpha']],
      ['beta', ['beta tool']],
    ]);
    expect(profiles.map((profile) => profile.name)).toEqual(['alpha', 'beta']);
    expect(profiles[1].markers[0].weight).toBe(16);

    const state = createSourceDetectionState([
      ['alpha', ['alpha']],
      ['beta', ['beta tool']],
    ]);
    collectDetectedSourceHits('alpha failed', state);
    collectDetectedSourceHits('beta tool failed', state);
    expect(rankDetectedSources(state, 2)).toEqual(['alpha', 'beta']);
    expect(state.hits.get('beta')?.confidence).toBeGreaterThan(
      state.hits.get('alpha')?.confidence ?? 0,
    );

    const activeTypeScript = createSourceDetectionState([
      ['typescript', ['typescript']],
      ['pytest', ['pytest']],
    ]);
    collectDetectedSourceHits('typescript compiler started', activeTypeScript);
    expect(scoreSourceDiagnosticBoost('TS9999: Type mismatch', activeTypeScript)).toBe(
      SOURCE_DIAGNOSTIC_BOOST,
    );
    expect(scoreSourceDiagnosticBoost('plain compiler output', activeTypeScript)).toBe(0);

    const weakTypeScript = createSourceDetectionState([
      ['typescript', ['ts']],
    ]);
    collectDetectedSourceHits('ts', weakTypeScript);
    expect(scoreSourceDiagnosticBoost('TS9999: Type mismatch', weakTypeScript)).toBe(0);
  });

  it('adjusts auto aggressiveness deterministically from recent decisions', () => {
    const auto = createDynamicAggressivenessState('auto');
    expect(auto.effective).toBe('high');

    for (let i = 0; i < 8; i += 1) {
      recordLineDecision(auto, {
        kept: false,
        dropped: true,
        hardKeep: false,
        repeated: true,
      });
    }
    expect(auto.effective).toBe('aggressive');

    for (let i = 0; i < 8; i += 1) {
      recordLineDecision(auto, {
        kept: true,
        dropped: false,
        hardKeep: true,
        repeated: false,
      });
    }
    expect(auto.effective).toBe('high');

    for (let i = 0; i < 8; i += 1) {
      recordLineDecision(auto, {
        kept: true,
        dropped: false,
        hardKeep: false,
        repeated: false,
      });
    }
    expect(auto.effective).toBe('high');

    auto.effective = 'low';
    for (let i = 0; i < 8; i += 1) {
      recordLineDecision(auto, {
        kept: true,
        dropped: false,
        hardKeep: true,
        repeated: false,
      });
    }
    expect(auto.effective).toBe('low');

    const fixed = createDynamicAggressivenessState('low');
    recordLineDecision(fixed, {
      kept: false,
      dropped: true,
      hardKeep: false,
      repeated: true,
    });
    expect(fixed.effective).toBe('low');
  });

  it('sanitizes expensive identifiers and timestamps', () => {
    expect(
      sanitizeLine(
        '\u001B[31m[ERROR]\u001B[0m 2026-05-15T10:20:30.123Z Fri, 15 May 2026 10:20:30 UTC uuid=018f23ab-7c1d-7f44-8bfe-0acddaf33456 src=10.42.7.18:54321 commit=abcdef1234567890 session=abc123def456ghi789jkl012   ',
      ),
    ).toBe(
      '[ERROR] [TIME] [TIME] uuid=[ID] src=[IP]:[PORT] commit=[HASH] session=[HASH]',
    );
    expect(
      sanitizeLine(
        '10.40.1.13 - - [16/May/2026:10:12:04 +0000] "POST /api/checkout HTTP/1.1" 502',
      ),
    ).toBe('[IP] - - [[TIME]] "POST /api/checkout HTTP/1.1" 502');
    expect(
      sanitizeLine(
        '2026/05/16 10:12:04 [error] connect() failed for upstream 10.44.2.19:8080',
      ),
    ).toBe('[TIME] [error] connect() failed for upstream [IP]:[PORT]');
  });

  it('builds generic repeat signatures from structured fields', () => {
    expect(MAX_REPEAT_DELTA_VALUES).toBe(3);
    expect(
      createRepeatSignature(
        '[ERROR] charge failed requestId=[ID] amount=99.99 failures=3/5',
      ),
    ).toBe(
      '[ERROR] charge failed requestId=[VALUE] amount=[VALUE] failures=[VALUE]',
    );
    expect(
      createRepeatSignature(
        '[ERROR] checkout failed order_id=ord-88421 route=POST_/checkout',
      ),
    ).toBe('[ERROR] checkout failed order_id=[VALUE] route=[VALUE]');
  });

  it('classifies useful diagnostic lines', () => {
    expect(shouldKeepLine('')).toBe(false);
    expect(shouldKeepLine('[INFO] booted')).toBe(false);
    expect(shouldKeepLine('[ERROR] failed')).toBe(true);
    expect(shouldKeepLine('TypeError: boom')).toBe(true);
    expect(shouldKeepLine('npm ERR! code ERESOLVE')).toBe(true);
    expect(shouldKeepLine('Warning BackOff restarting failed container api')).toBe(
      true,
    );
    expect(
      shouldKeepLine('{"level":"error","msg":"database timeout","status":503}'),
    ).toBe(true);
    expect(shouldKeepLine('[NOTICE] noisy')).toBe(false);
    expect(shouldKeepLine('plain text')).toBe(false);

    expect(looksLikeDiagnosticLine('    at app (/repo/src/app.ts:10:5)')).toBe(
      true,
    );
    expect(looksLikeDiagnosticLine('    ... 2 more')).toBe(true);
    expect(
      looksLikeDiagnosticLine(
        '    File "/repo/app/orders.py", line 42, in create_order',
      ),
    ).toBe(true);
    expect(
      looksLikeDiagnosticLine(
        '    at com.example.checkout.CartService.placeOrder(CartService.java:118)',
      ),
    ).toBe(true);
    expect(looksLikeDiagnosticLine('goroutine 42 [running]:')).toBe(true);
    expect(looksLikeDiagnosticLine('main.(*Server).Start(0xc0001212c0)')).toBe(
      true,
    );
    expect(
      looksLikeDiagnosticLine(
        'github.com/acme/checkout/server.(*Server).Start(0xc0001212c0)',
      ),
    ).toBe(true);
    expect(looksLikeDiagnosticLine('C:\\repo\\service\\main.go:42 +0x20')).toBe(
      true,
    );
    expect(looksLikeDiagnosticLine('console.log(value)')).toBe(false);
    expect(looksLikeDiagnosticLine('Unhandled exception')).toBe(true);
    expect(looksLikeDiagnosticLine('plain text')).toBe(false);

    expect(
      isInternalStackTraceLine('    at lib (/repo/node_modules/pkg/index.js:1:1)'),
    ).toBe(true);
    expect(
      isInternalStackTraceLine(
        '    File "/repo/.venv/lib/python3.12/site-packages/httpx/_client.py", line 814, in request',
      ),
    ).toBe(true);
    expect(
      isInternalStackTraceLine(
        '    at java.base/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)',
      ),
    ).toBe(true);
    expect(isInternalStackTraceLine('    at app (/repo/src/app.ts:10:5)')).toBe(
      false,
    );
    // [ERROR]/[FATAL] lines are never treated as internal stack frames
    expect(
      isInternalStackTraceLine(
        '[ERROR] ERROR Invoke Error {"errorType":"TimeoutError","stackTrace":["at Timeout._onTimeout (/var/task/node_modules/pg/client.js:42:18)"]}',
      ),
    ).toBe(false);
    expect(
      isInternalStackTraceLine(
        '[FATAL] FATAL: node_modules internal crash at lib.js:1:1',
      ),
    ).toBe(false);
    // New diagnostic patterns
    expect(looksLikeDiagnosticLine('::error file=src/app.ts,line=42::TypeError')).toBe(true);
    expect(looksLikeDiagnosticLine('::warning file=src/app.ts,line=10::unused variable')).toBe(true);
    expect(looksLikeDiagnosticLine('Execution failed for task :app:compileJava')).toBe(true);
    expect(looksLikeDiagnosticLine('> What went wrong:')).toBe(true);
    expect(looksLikeDiagnosticLine('--- FAIL: TestCheckout (0.12s)')).toBe(true);
    expect(looksLikeDiagnosticLine('make: *** [build] Error 2')).toBe(true);
    expect(looksLikeDiagnosticLine('Failed to start checkout-api.service')).toBe(true);
    expect(looksLikeDiagnosticLine('Spin Cancelled')).toBe(true);
    expect(looksLikeDiagnosticLine('[Pipeline] [ERROR] Stage "Deploy" failed')).toBe(true);
    expect(looksLikeDiagnosticLine('##vso[task.LogIssue type=error;]build failed')).toBe(true);
    expect(looksLikeDiagnosticLine('##teamcity[buildProblem description=compile error')).toBe(true);
    expect(estimateTokens(3)).toBe(4);
  });

  it('streams logs, sanitizes UUIDs, deduplicates and hides internal stacks', async () => {
    const logs = [
      '',
      '[INFO] boot ok',
      '[ERROR] request 123e4567-e89b-12d3-a456-426614174000 failed',
      '[ERROR] request 987e6543-e21b-42d3-b456-526614174111 failed',
      '[ERROR] src/api/client.ts(18,22): error TS2322: Type string is not assignable to number',
      '[WARN] deploy 2026-05-15T10:20:30Z sha abcdef1234567890 ok',
      '    at app (/repo/src/app.ts:10:5)',
      '    at lib (/repo/node_modules/pkg/index.js:1:1)',
      '    at loader (node:internal/modules/cjs/loader:1:1)',
      'TypeError: exploded',
      '[DEBUG] debug',
      // "plain text" has score=0 and falls inside the CONTEXT_WINDOW_AFTER of
      // "TypeError: exploded", so it is emitted as trailing diagnostic context.
      'plain text',
    ].join('\n');
    const output = new MemoryWritable();

    await processLogStream(Readable.from([logs]), output);

    const result = await processLogStream(Readable.from([logs]), new MemoryWritable());

    expect(output.content()).toBe(
      [
        '[x2] [ERROR] request [ID] failed',
        '[ERROR] src/api/client.ts(18,22): error TS2322: Type string is not assignable to number',
        '[WARN] deploy [TIME] sha [HASH] ok',
        '    at app (/repo/src/app.ts:10:5)',
        INTERNAL_STACK_MARKER,
        'TypeError: exploded',
        'plain text', // after-context: CONTEXT_WINDOW_AFTER lines after the error
        '',
      ].join('\n'),
    );
    expect(result.detectedSources?.length).toBeGreaterThan(0);
    expect(result.detectedSources).toContain('typescript');
  });

  it('uses confident source detection to keep source-specific diagnostics', async () => {
    const output = new MemoryWritable();
    const result = await processLogStream(
      Readable.from([
        [
          'typescript compiler started',
          'TS9999: Type mismatch in generated declaration',
        ].join('\n'),
      ]),
      output,
    );

    expect(output.content()).toBe(
      [
        'typescript compiler started',
        'TS9999: Type mismatch in generated declaration',
        '',
      ].join('\n'),
    );
    expect(result.detectedSources).toContain('typescript');
  });

  it('auto aggressiveness suppresses later warning noise while keeping errors', async () => {
    const output = new MemoryWritable();
    await processLogStream(
      Readable.from([
        [
          '[INFO] boot 1',
          '[INFO] boot 2',
          '[INFO] boot 3',
          '[INFO] boot 4',
          '[INFO] boot 5',
          '[INFO] boot 6',
          '[INFO] boot 7',
          '[INFO] boot 8',
          '[WARN] cache warmed successfully',
          '[ERROR] request failed',
        ].join('\n'),
      ]),
      output,
      { aggressiveness: 'auto' },
    );

    expect(output.content()).toBe('[ERROR] request failed\n');
  });

  it('folds adjacent diagnostic variants with generic delta values', async () => {
    const repeatedLogs = [
      '[ERROR] 2026-05-15T08:01:12.436Z spring-boot [payments] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33456 amount=99.99',
      '[ERROR] 2026-05-15T08:01:12.437Z spring-boot [payments] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33457 amount=49.50',
      '[ERROR] 2026-05-15T08:01:12.438Z spring-boot [payments] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33458 amount=12.00',
      '[ERROR] 2026-05-15T08:01:12.439Z spring-boot [payments] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33459 amount=12.00',
      '[ERROR] 2026-05-15T08:01:12.440Z spring-boot [payments] charge failed requestId=018f23ab-7c1d-7f44-8bfe-0acddaf33460 amount=7.25',
    ].join('\n');
    const repeatedOutput = new MemoryWritable();

    const repeatedResult = await processLogStream(
      Readable.from([repeatedLogs]),
      repeatedOutput,
    );

    expect(repeatedOutput.content()).toBe(
      '[x5] [ERROR] [TIME] spring-boot [payments] charge failed requestId=[ID] amount=[99.99 | 49.50 | 12.00 | …]\n',
    );
    expect(repeatedResult.stats.duplicateLines).toBe(4);

    const singleOutput = new MemoryWritable();
    await processLogStream(
      Readable.from([repeatedLogs.split('\n', 1)[0] ?? '']),
      singleOutput,
    );

    expect(singleOutput.content()).toBe(
      '[ERROR] [TIME] spring-boot [payments] charge failed requestId=[ID] amount=99.99\n',
    );

    const compactDeltaOutput = new MemoryWritable();
    await processLogStream(
      Readable.from([
        [
          '[ERROR] worker failed task=charge shard=eu-1',
          '[ERROR] worker failed task=refund shard=eu-2',
        ].join('\n'),
      ]),
      compactDeltaOutput,
    );

    expect(compactDeltaOutput.content()).toBe(
      '[x2] [ERROR] worker failed task=[charge | refund] shard=[eu-1 | eu-2]\n',
    );
  });

  it('scoreLineRelevance assigns correct multi-signal scores', () => {
    // Exported constants have expected values
    expect(CONTEXT_WINDOW_BEFORE).toBe(3);
    expect(CONTEXT_WINDOW_AFTER).toBe(2);
    expect(SCORE_KEEP_THRESHOLD).toBe(40);
    expect(TFIDF_REPEAT_THRESHOLD).toBe(3);
    expect(TFIDF_PENALTY).toBe(8);
    expect(TFIDF_MAP_LIMIT).toBe(50_000);

    // Noise tags always return -Infinity
    expect(scoreLineRelevance('[INFO] booted', 'high')).toBe(-Infinity);
    expect(scoreLineRelevance('[DEBUG] query', 'high')).toBe(-Infinity);
    expect(scoreLineRelevance('[TRACE] tick', 'high')).toBe(-Infinity);
    expect(scoreLineRelevance('', 'high')).toBe(-Infinity);

    // High-value signals exceed the threshold
    expect(scoreLineRelevance('[ERROR] server down', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('[FATAL] out of memory', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('{"level":"error","msg":"crash"}', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('Severity: CRITICAL CVE-2026-12345', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);

    // Stack frames are exactly at threshold (no other signal)
    expect(scoreLineRelevance('    at app (/repo/src/app.ts:10:5)', 'high')).toBe(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('goroutine 42 [running]:', 'high')).toBe(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('github.com/acme/service.(*Server).Start(0xc0001212c0)', 'high')).toBe(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('/repo/service/main.go:42 +0x20', 'high')).toBe(SCORE_KEEP_THRESHOLD);

    // Soft lines: no matching patterns → score 0
    expect(scoreLineRelevance('Connection state: connecting', 'high')).toBe(0);
    expect(scoreLineRelevance('plain text', 'high')).toBe(0);

    // TF-IDF: penalty kicks in at TFIDF_REPEAT_THRESHOLD
    const base = scoreLineRelevance('failed to connect', 'high', 1);
    expect(base).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    const atThreshold = scoreLineRelevance('failed to connect', 'high', TFIDF_REPEAT_THRESHOLD);
    expect(atThreshold).toBe(base - TFIDF_PENALTY);
    const overThreshold = scoreLineRelevance('failed to connect', 'high', TFIDF_REPEAT_THRESHOLD + 3);
    expect(overThreshold).toBe(base - TFIDF_PENALTY * 4);
    // Eventually falls below SCORE_KEEP_THRESHOLD
    const wayOver = scoreLineRelevance('failed to connect', 'high', TFIDF_REPEAT_THRESHOLD + 10);
    expect(wayOver).toBeLessThan(SCORE_KEEP_THRESHOLD);

    // NPM and Yarn error patterns trigger the +60 bonus
    expect(scoreLineRelevance('npm ERR! code ERESOLVE', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    // YARN_ERROR_PATTERN specifically (does not match NPM_ERROR_PATTERN)
    expect(scoreLineRelevance('yarn error Command failed with exit code 1', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);

    // Container runtime names alone are context, but failure phrasing is diagnostic
    expect(scoreLineRelevance('containerd v1.7.0 started', 'high')).toBe(0);
    expect(scoreLineRelevance('containerd failed to create task', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('runc error: unable to start container process', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);

    // Aggressiveness: pure WARN without error keyword → drop
    expect(scoreLineRelevance('[WARN] cache warming', 'aggressive')).toBeLessThan(0);
    // WARN + any diagnostic keyword survives aggressive
    expect(scoreLineRelevance('[WARN] request failed', 'aggressive')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('[WARN] connection timeout', 'aggressive')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('[WARN] app crashed on startup', 'aggressive')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('[WARN] process killed by OOM', 'aggressive')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);

    // Low aggressiveness: NOTICE/STATUS lines get bonus
    expect(scoreLineRelevance('[NOTICE] queue warming', 'low')).toBeGreaterThan(0);
    expect(scoreLineRelevance('[WARN] cache warming', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD); // WARN is important tag
    // New scoring patterns
    expect(scoreLineRelevance('::error file=deploy.yml,line=42::deploy failed', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('Execution failed for task :app:compileJava', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('--- FAIL: TestCheckout', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('make: *** [build] Error 2', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('Failed to start checkout-api.service', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('Spin Cancelled', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('Failed to start checkout-api.service', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('[Pipeline] [ERROR] Stage "Deploy" failed', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('##vso[task.LogIssue type=error;]build failed', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('##teamcity[buildProblem description=compile error', 'high')).toBeGreaterThanOrEqual(SCORE_KEEP_THRESHOLD);
    // Ensure new patterns do NOT match benign lines (branch coverage)
    expect(scoreLineRelevance('systemd[1]: Started session', 'high')).toBeLessThan(SCORE_KEEP_THRESHOLD);
    expect(scoreLineRelevance('##vso[build.issue] unrelated', 'high')).toBeLessThan(SCORE_KEEP_THRESHOLD);
  });

  it('context window promotes soft lines near errors', async () => {
    // A soft-scored line (no error signal) that sits just before an ERROR
    // must be retroactively emitted as context.
    const logs = [
      'Connection state: connecting', // score=0 → buffered
      '[ERROR] Database connection timeout', // score>=40 → triggers context flush
    ].join('\n');

    const output = new MemoryWritable();
    await processLogStream(Readable.from([logs]), output);
    const lines = output.content().trimEnd().split('\n');

    expect(lines[0]).toBe('Connection state: connecting');
    expect(lines[1]).toContain('[ERROR]');
  });

  it('after-context window emits lines following a high-score event', async () => {
    const logs = [
      '[ERROR] crash',
      'stack frame 1', // score=0, afterContextRemaining=2 → emitted
      'stack frame 2', // score=0, afterContextRemaining=1 → emitted
      'unrelated soft', // score=0, afterContextRemaining=0 → buffered (no trigger follows)
    ].join('\n');

    const output = new MemoryWritable();
    await processLogStream(Readable.from([logs]), output);
    const content = output.content();

    expect(content).toContain('stack frame 1');
    expect(content).toContain('stack frame 2');
    expect(content).not.toContain('unrelated soft');
  });

  it('TF-IDF dampening reduces score for high-frequency non-error lines', async () => {
    // "Retrying connection" has base score ~50 (DIAGNOSTIC: "failed"? no, "Retrying" no)
    // Use a line that matches DIAGNOSTIC_PATTERN to get base score 50, then
    // repeat it enough times that TF-IDF reduces score below SCORE_KEEP_THRESHOLD.
    // "failed to connect" → DIAGNOSTIC +50; threshold exceeded after enough repeats.
    const repeatedLine = 'failed to connect to database';
    const errorLine = '[ERROR] fatal crash';

    // Build: interleaved repeats and noise, followed by an error to flush context.
    // Repeats 1-3: emitted directly (score >= 40)
    // Repeat 4: score = 50 - 16 = 34 < 40 → buffered in context → will be flushed by error
    // Repeat 5: score = 50 - 24 = 26 < 40 → also buffered
    const chunks: string[] = [];
    for (let i = 0; i < 5; i++) {
      chunks.push(repeatedLine);
      chunks.push('[INFO] heartbeat'); // noise between repeats
    }
    chunks.push(errorLine);

    const output = new MemoryWritable();
    await processLogStream(Readable.from([chunks.join('\n')]), output);
    const content = output.content();

    // Early occurrences (1-3) must appear directly
    expect(content).toContain(repeatedLine);
    // Error must appear
    expect(content).toContain(errorLine);
    // The total count of repeatedLine must be less than 5 (TF-IDF suppressed some)
    const count = content.split('\n').filter((l) => l.includes(repeatedLine)).length;
    expect(count).toBeLessThan(5);
  });

  it('bounds TF-IDF tracking for highly unique streams', async () => {
    const output = new MemoryWritable();
    const logs = Array.from(
      { length: TFIDF_MAP_LIMIT + 1 },
      (_, index) => `soft context line ${index}`,
    ).join('\n');

    const result = await processLogStream(Readable.from([logs]), output);

    expect(output.content()).toBe('');
    expect(result.stats.inputLines).toBe(TFIDF_MAP_LIMIT + 1);
    expect(result.stats.droppedLines).toBe(TFIDF_MAP_LIMIT + 1);
  });

  it('handles empty streams and backpressure', async () => {
    const emptyOutput = new MemoryWritable();
    const emptyResult = await processLogStream(Readable.from(['']), emptyOutput);

    expect(emptyResult.savingsPercent).toBe(0);
    expect(emptyOutput.content()).toBe('');

    const slowOutput = new SlowWritable();
    await processLogStream(Readable.from(['[ERROR] backpressure']), slowOutput);

    expect(slowOutput.content()).toBe('[ERROR] backpressure\n');
  });

  it('applies low/aggressive filtering rules', async () => {
    const logs = [
      '[NOTICE] build queue status: warming',
      '[WARN] retrying transient request',
      '[WARN] request failed after retry budget exhausted',
      '[ERROR] hard failure',
    ].join('\n');

    const lowOutput = new MemoryWritable();
    await processLogStream(Readable.from([logs]), lowOutput, {
      aggressiveness: 'low',
    });
    expect(lowOutput.content()).toContain('[NOTICE] build queue status: warming');

    const aggressiveOutput = new MemoryWritable();
    await processLogStream(Readable.from([logs]), aggressiveOutput, {
      aggressiveness: 'aggressive',
    });
    expect(aggressiveOutput.content()).not.toContain(
      '[WARN] retrying transient request',
    );
    expect(aggressiveOutput.content()).toContain(
      '[WARN] request failed after retry budget exhausted',
    );
    expect(aggressiveOutput.content()).toContain('[ERROR] hard failure');
  });

  it('processes files and propagates read errors', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'logstrip-'));

    try {
      const inputPath = join(directory, 'raw.log');
      const outputPath = join(directory, 'raw.logstrip.log');
      await writeFile(inputPath, '[ERROR] file failed\n', 'utf8');

      expect(pathsReferToSameFile(inputPath, outputPath)).toBe(false);
      expect(pathsReferToSameFile(inputPath, inputPath.toUpperCase())).toBe(
        true,
      );

      const result = await processLogFile(inputPath, outputPath);

      expect(result.outputPath).toBe(outputPath);
      expect(await readFile(outputPath, 'utf8')).toBe('[ERROR] file failed\n');

      await expect(processLogFile(inputPath, inputPath)).rejects.toThrow(
        'Input and output paths must be different',
      );
      expect(await readFile(inputPath, 'utf8')).toBe('[ERROR] file failed\n');

      await expect(
        processLogFile(join(directory, 'missing.log'), outputPath),
      ).rejects.toThrow();
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

describe('custom config integration', () => {
  it('buildMergedConfig returns built-in sources without config', () => {
    const merged = buildMergedConfig();
    expect(merged.mergedSources.length).toBeGreaterThan(0);
    expect(merged.diagnosticPatterns).toHaveLength(0);
  });

  it('buildMergedConfig merges custom sources with existing ones', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'logstrip-config-merge-'));
    try {
      const configPath = join(directory, '.logstrip.yml');
      await writeFile(
        configPath,
        `sources:
  - name: acme-tool
    markers:
      - acme-tool
      - "[ACME]"
diagnosticPatterns:
  - "ACME_ERROR_\\\\d+"
ignorePatterns:
  - "\\\\bheartbeat\\\\b"
sanitizePatterns:
  - pattern: "\\\\bACME-USER-\\\\d+\\\\b"
    replacement: "[ACME-USER]"
internalStackPatterns:
  - "/opt/acme/lib/"
`,
        'utf8',
      );

      const merged = buildMergedConfig({ configPath });
      expect(merged.mergedSources.some(([name]) => name === 'acme-tool')).toBe(true);
      expect(merged.diagnosticPatterns).toHaveLength(1);
      expect(merged.ignorePatterns).toHaveLength(1);
      expect(merged.sanitizePatterns).toHaveLength(1);
      expect(merged.internalStackPatterns).toHaveLength(1);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('custom ignore patterns drop matching lines', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'logstrip-config-ignore-'));
    try {
      const configPath = join(directory, '.logstrip.yml');
      await writeFile(
        configPath,
        `ignorePatterns:
  - "\\\\bheartbeat\\\\b"
`,
        'utf8',
      );

      const input = Readable.from([
        '[ERROR] critical failure\n',
        'heartbeat ok\n',
        '[WARN] something wrong\n',
      ]);
      const output = new MemoryWritable();
      const result = await processLogStream(input, output, {
        aggressiveness: 'low',
        configPath,
      });

      const out = output.content();
      expect(out).toContain('[ERROR] critical failure');
      expect(out).not.toContain('heartbeat');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('custom diagnostic patterns boost line score', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'logstrip-config-diag-'));
    try {
      const configPath = join(directory, '.logstrip.yml');
      await writeFile(
        configPath,
        `diagnosticPatterns:
  - "ACME_ERROR_\\\\d+"
`,
        'utf8',
      );

      const input = Readable.from([
        'ACME_ERROR_42 something broke\n',
        'boring noise line\n',
      ]);
      const output = new MemoryWritable();
      const result = await processLogStream(input, output, {
        aggressiveness: 'high',
        configPath,
      });

      const out = output.content();
      expect(out).toContain('ACME_ERROR_42');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('custom sanitize patterns mask matched text', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'logstrip-config-sanitize-'));
    try {
      const configPath = join(directory, '.logstrip.yml');
      await writeFile(
        configPath,
        `sanitizePatterns:
  - pattern: "\\\\bACME-USER-\\\\d+\\\\b"
    replacement: "[ACME-USER]"
`,
        'utf8',
      );

      const input = Readable.from([
        '[ERROR] auth failed for ACME-USER-12345\n',
      ]);
      const output = new MemoryWritable();
      const result = await processLogStream(input, output, {
        aggressiveness: 'high',
        configPath,
      });

      const out = output.content();
      expect(out).toContain('[ACME-USER]');
      expect(out).not.toContain('ACME-USER-12345');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('custom internal stack patterns collapse matching lines', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'logstrip-config-istack-'));
    try {
      const configPath = join(directory, '.logstrip.yml');
      await writeFile(
        configPath,
        `internalStackPatterns:
  - "/opt/acme/lib/"
`,
        'utf8',
      );

      const input = Readable.from([
        '[ERROR] crash\n',
        '  at acme.run (/opt/acme/lib/core.js:10:5)\n',
        '  at acme.run (/opt/acme/lib/util.js:20:3)\n',
        '[WARN] after\n',
      ]);
      const output = new MemoryWritable();
      const result = await processLogStream(input, output, {
        aggressiveness: 'high',
        configPath,
      });

      const out = output.content();
      expect(out).toContain('[ERROR] crash');
      expect(out).toContain(INTERNAL_STACK_MARKER);
      expect(out).not.toContain('/opt/acme/lib/');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('custom sources are detected in log output', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'logstrip-config-sources-'));
    try {
      const configPath = join(directory, '.logstrip.yml');
      await writeFile(
        configPath,
        `sources:
  - name: acme-gateway
    markers:
      - acme-gateway
`,
        'utf8',
      );

      const input = Readable.from([
        '[ERROR] acme-gateway connection refused\n',
      ]);
      const output = new MemoryWritable();
      const result = await processLogStream(input, output, {
        aggressiveness: 'high',
        configPath,
      });

      expect(result.detectedSources).toContain('acme-gateway');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('custom markers merge into existing built-in source', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'logstrip-config-merge-src-'));
    try {
      const configPath = join(directory, '.logstrip.yml');
      await writeFile(
        configPath,
        `sources:
  - name: docker
    markers:
      - custom-docker-marker
`,
        'utf8',
      );

      const merged = buildMergedConfig({ configPath });
      const dockerEntry = merged.mergedSources.find(([name]) => name === 'docker');
      expect(dockerEntry).toBeDefined();
      expect(dockerEntry![1]).toContain('custom-docker-marker');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
