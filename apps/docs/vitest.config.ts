import { defineConfig } from 'vitest/config';

// Standalone from the root vitest config: the docs app has its own deps and gate.
export default defineConfig({
  test: {
    name: 'docs',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
