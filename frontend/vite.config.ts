import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: {
    host: '127.0.0.1', port: 4317, strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.TIMELINE_PROVIDER_PORT ?? 4318}` } },
  },
  build: { outDir: '../dist/frontend', emptyOutDir: true },
});
