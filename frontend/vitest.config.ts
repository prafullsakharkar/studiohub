import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Hermetic API base URL: tests must not depend on a developer's git-ignored .env
    // (without a base URL, Node's Request rejects the relative /api/... paths).
    env: { VITE_API_URL: 'http://api.test' },
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    // Persist transforms between runs (vitest docs suggest this; cuts the
    // repeated ~95s transform pass on every run).
    fsModuleCache: true,
    // The 5s vitest default is too tight for the first cold run, which must
    // transform the whole graph before any import resolves; a stalled module
    // factory under that deadline surfaced as spurious timeouts and
    // "undefined export" errors in the module-namespace of the same file.
    // 20s absorbs cold-transform jitter without masking genuinely hung tests.
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/__tests__/**',
        'src/test/**',
        'src/types/**',
      ],
      // Regression floor against the honest baseline (statements 14.2% /
      // branches 12.8% / functions 8.5% / lines 14.8% of src/** excluding
      // tests, mocks and type-only modules). Raise as coverage improves.
      thresholds: {
        statements: 14,
        branches: 12,
        functions: 8,
        lines: 14,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
