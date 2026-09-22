import type { RequestPlan } from '../shared/runner-config.js';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import { parseScenario, type Scenario } from '../shared/engine.js';

export interface ProxyOptions {
  path?: string;
  onEvent?: (kind: string, request: number) => void;
  requests?: RequestPlan[];
  scenario?: Scenario;
  upstream?: URL;
  delayMs?: number;
  disconnectMs?: number;
}
// One explicit route and one fixed upstream; never an arbitrary destination from a request.
export function createStreamProxy(options: ProxyOptions) {
  if (!!options.scenario === !!options.upstream) throw new Error('Choose exactly one scenario or upstream');
  if (options.scenario) parseScenario(options.scenario);
  if (options.upstream && (!['http:', 'https:'].includes(options.upstream.protocol) || options.upstream.username || options.upstream.password)) throw new Error('Unsupported upstream URL');
  for (const value of [options.delayMs, options.disconnectMs]) if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 60000)) throw new Error('Fault times must be integers from 0 to 60000');
  if (options.requests) {
    if (options.requests.length < 1 || options.requests.length > 100 || options.delayMs !== undefined || options.disconnectMs !== undefined) throw new Error('Invalid or conflicting request plan');
    for (const request of options.requests) {
      if (!['complete', 'aborted'].includes(request.expectedOutcome)) throw new Error('Invalid request outcome');
      for (const value of [request.delayMs, request.disconnectMs]) if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 60000)) throw new Error('Invalid request fault time');
      if (request.disconnectMs !== undefined && request.expectedOutcome !== 'aborted') throw new Error('Disconnect requires aborted outcome');
    }
  }
  let requestCount = 0;
  const active = new Set<AbortController>();
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') { res.end('ok'); return; }
    if (req.method !== 'POST' || req.url !== (options.path ?? '/api/generate')) { res.writeHead(404); res.end(); return; }
    const requestNumber = ++requestCount;
    const emit = (kind: string) => options.onEvent?.(kind, requestNumber);
    emit('request');
    const settings = options.requests ? options.requests[requestNumber - 1] : options;
    if (!settings) { emit('unexpected-request'); res.writeHead(503); res.end('Request plan exhausted'); return; }
    const controller = new AbortController(); active.add(controller);
    const { signal } = controller;
    res.on('close', () => { if (!res.writableFinished) emit('aborted'); controller.abort(); });
    const deadline = setTimeout(() => { controller.abort(); res.destroy(); }, 65000);
    const disconnect = settings.disconnectMs === undefined ? undefined : setTimeout(() => { emit('disconnect'); controller.abort(); res.destroy(); }, settings.disconnectMs);
    const write = async (chunk: string | Buffer) => {
      if (signal.aborted) throw new Error('Aborted');
      emit('delivery');
      if (!res.write(chunk)) await once(res, 'drain', { signal });
    };
    try {
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 262144) { res.writeHead(413); res.end(); return; }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      if (options.scenario) {
        const input = JSON.parse(body.toString());
        if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(input.requestId)) throw new Error('Invalid request ID');
        // The CLI fixture wins over any scenario sent by an app.
        await delay(settings.delayMs ?? 0, undefined, { signal });
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.flushHeaders();
        await write(JSON.stringify({ type: 'start', requestId: input.requestId }) + '\n');
        const start = performance.now();
        for (const event of options.scenario.events) {
          await delay(Math.max(0, event.atMs - (performance.now() - start)), undefined, { signal });
          await write(JSON.stringify({ ...event, requestId: input.requestId }) + '\n');
        }
      } else {
        const target = options.upstream!;
        const upstream = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
          method: 'POST', signal,
          // Do not silently forward browser credentials or hop-by-hop headers.
          headers: { 'content-type': req.headers['content-type'] ?? 'application/json', 'content-length': body.length, 'accept-encoding': 'identity' },
        });
        const received = once(upstream, 'response', { signal });
        upstream.end(body);
        const [response] = await received;
        // First-response delay: pause consumption; do not buffer an entire response.
        await delay(settings.delayMs ?? 0, undefined, { signal });
        res.writeHead(response.statusCode ?? 502, {
          'Content-Type': response.headers['content-type'] ?? 'application/octet-stream',
          ...(response.headers['content-encoding'] ? { 'Content-Encoding': response.headers['content-encoding'] } : {}),
          'Cache-Control': 'no-store',
        });
        res.flushHeaders();
        for await (const chunk of response) await write(chunk);
      }
      res.end(); emit('complete');
    } catch {
      if (!signal.aborted && !res.headersSent) { res.writeHead(options.upstream ? 502 : 400); res.end('Stream request failed'); }
      else res.destroy();
    } finally {
      clearTimeout(deadline); clearTimeout(disconnect); controller.abort(); active.delete(controller);
    }
  });
  return { server, close: () => { for (const controller of active) controller.abort(); server.close(); server.closeAllConnections(); } };
}
