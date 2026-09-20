import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import { parseScenario, replay } from './engine.js';
const scenario = parseScenario(JSON.parse(await readFile(new URL('../scenarios/cancel-late-result.json', import.meta.url), 'utf8')));
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
const server = createServer(async (req, res) => {
  if (req.url === '/api/scenario' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(scenario)); return;
  }
  if (req.url === '/api/generate' && req.method === 'POST') {
    try {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 262144) throw new Error('Request too large'); }
      const input = JSON.parse(body);
      if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(input.requestId)) throw new Error('Invalid request ID');
      const runScenario = input.scenario === undefined ? scenario : parseScenario(input.scenario);
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.flushHeaders();
      res.write(JSON.stringify({ type: 'start', requestId: input.requestId }) + '\n');
      const abort = new AbortController();
      res.on('close', () => abort.abort());
      await replay(runScenario.events, event => res.write(JSON.stringify({ ...event, requestId: input.requestId }) + '\n'), abort.signal);
      res.end();
    } catch (error) {
      if (!res.headersSent) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String(error) })); }
      else res.end();
    }
    return;
  }
  vite.middlewares(req, res);
});
server.listen(4317, '127.0.0.1', () => console.log('Agent Timeline: http://127.0.0.1:4317'));
