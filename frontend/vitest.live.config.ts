import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Live end-to-end checks: the real ApiClient, token storage and pages against a RUNNING backend.
 * No mocks. Start the backend with docs/sync/tools/live_backend.py, then:
 *
 *   SYNC_LIVE_INFO=/path/live.json pnpm test:live
 */
const infoPath = process.env.SYNC_LIVE_INFO;
if (!infoPath || !fs.existsSync(infoPath)) {
  throw new Error('SYNC_LIVE_INFO must point at the live.json written by docs/sync/tools/live_backend.py');
}
const live = JSON.parse(fs.readFileSync(infoPath, 'utf8')) as { url: string };

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify(live.url) },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.live.test.{ts,tsx}'],
    testTimeout: 30000,
    // One backend, shared state: run files one after another.
    fileParallelism: false,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
