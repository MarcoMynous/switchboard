import { defineConfig } from 'vitest/config';

// Phase exit gate: packages/booking ≥ 90% (docs/phases/p1-booking-engine.md).
// Runs unit + integration tests together, so it needs Docker Postgres like test:int.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/test-support/**', 'src/index.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
