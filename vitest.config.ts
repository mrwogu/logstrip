import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['dist/**', 'node_modules/**'],
    testTimeout: 15000,
    coverage: {
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/core/types.ts', 'src/core/telemetry/telemetry-store.ts'],
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
