import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

const VENDOR_CHUNKS = new Map<string, string>(
  Object.entries({
    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
    'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
    'vendor-query': ['@tanstack/react-query'],
    'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
    'vendor-charts': ['recharts'],
    'vendor-motion': ['motion'],
    'vendor-utils': ['clsx', 'tailwind-merge', 'ky', 'lucide-react'],
  }).flatMap(([chunk, packages]) => packages.map((name) => [name, chunk] as const)),
);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: 'dist/bundle-report.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: false,
  },
  build: {
    rollupOptions: {
      output: {
        // A function, not an object: Vite 8 (Rolldown) takes only this form. Groups match whole package names.
        manualChunks(id: string) {
          const match = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)\//.exec(id);
          return match ? VENDOR_CHUNKS.get(match[1]) : undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});

