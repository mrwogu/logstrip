import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface RetryConfig {
  attempts: number;
  delayMs: number;
}

export interface AppConfig {
  endpoint: string;
  timeoutMs: number;
  retry: RetryConfig;
}

const DEFAULT_CONFIG: AppConfig = {
  endpoint: 'http://localhost:8080',
  timeoutMs: 5000,
  retry: { attempts: 3, delayMs: 250 },
};

export class ConfigError extends Error {
  constructor(message: string, readonly path: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Merge a parsed file over the defaults; unknown keys are ignored.
export function mergeConfig(raw: unknown): AppConfig {
  if (!isRecord(raw)) {
    return DEFAULT_CONFIG;
  }
  const retry = isRecord(raw.retry) ? raw.retry : {};
  return {
    endpoint: typeof raw.endpoint === 'string' ? raw.endpoint : DEFAULT_CONFIG.endpoint,
    timeoutMs: typeof raw.timeoutMs === 'number' ? raw.timeoutMs : DEFAULT_CONFIG.timeoutMs,
    retry: {
      attempts: typeof retry.attempts === 'number' ? retry.attempts : DEFAULT_CONFIG.retry.attempts,
      delayMs: typeof retry.delayMs === 'number' ? retry.delayMs : DEFAULT_CONFIG.retry.delayMs,
    },
  };
}

export async function loadConfig(file: string): Promise<AppConfig> {
  const path = resolve(file);
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new ConfigError(`Cannot read config: ${String(error)}`, path);
  }
  try {
    return mergeConfig(JSON.parse(text));
  } catch (error) {
    throw new ConfigError(`Invalid JSON in config: ${String(error)}`, path);
  }
}
