import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '127.0.0.1', port: 4319, strictPort: true, proxy: {
    '/timeline': { target: `http://127.0.0.1:${process.env.TIMELINE_PROVIDER_PORT ?? 4318}`, rewrite: path => path.replace(/^\/timeline/, ''),
      configure(proxy) {
        // Propagate an interrupted upstream stream to Fetch instead of leaving it pending.
        proxy.on('proxyRes', (upstream, _request, downstream) => {
          upstream.on('aborted', () => downstream.destroy());
        });
      } },
  } },
  build: { outDir: '../../dist/example-chat', emptyOutDir: true },
});
