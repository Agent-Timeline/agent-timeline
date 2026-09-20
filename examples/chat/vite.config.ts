import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '127.0.0.1', port: 4319, strictPort: true, proxy: {
    '/timeline': { target: `http://127.0.0.1:${process.env.TIMELINE_PROVIDER_PORT ?? 4318}`, rewrite: path => path.replace(/^\/timeline/, '') },
  } },
  build: { outDir: '../../dist/example-chat', emptyOutDir: true },
});
