import { createRunnerApi } from './runner-api.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { parseScenario, replay } from '../shared/engine.js';
const scenario = parseScenario(JSON.parse(await readFile(new URL('../scenarios/cancel-late-result.json', import.meta.url), 'utf8')));
const runnerApi = createRunnerApi(process.env.TIMELINE_RUNNER_CONFIG);
const server = createServer(async (req, res) => {
  if (await runnerApi.handle(req, res)) return;
  if (req.url === '/api/example-target' && req.method === 'GET') {
    const examplePort = Number(process.env.TIMELINE_EXAMPLE_PORT ?? 4319);
    if (!Number.isInteger(examplePort) || examplePort < 1 || examplePort > 65535) { res.writeHead(500); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ url: `http://127.0.0.1:${examplePort}/?timeline` })); return;
  }
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
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});
const port = Number(process.env.TIMELINE_PROVIDER_PORT ?? 4318);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid TIMELINE_PROVIDER_PORT');
server.listen(port, '127.0.0.1', () => console.log(`Agent Timeline provider: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { runnerApi.close(); server.close(); server.closeAllConnections(); });
