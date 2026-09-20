#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { createStreamProxy } from './proxy.js';
import { parseScenario } from '../shared/engine.js';
try {
  const { values } = parseArgs({ options: {
    scenario: { type: 'string' }, upstream: { type: 'string' }, port: { type: 'string', default: '4321' },
    'delay-ms': { type: 'string', default: '0' }, 'disconnect-ms': { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: npm run proxy -- (--scenario FILE | --upstream URL) [--port 4321] [--delay-ms 300] [--disconnect-ms 900]\nPOST /api/generate; loopback only. Scenario mode uses Agent Timeline NDJSON. Forward mode relays a fixed unauthenticated development upstream.');
  } else {
    const port = Number(values.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
    const proxy = createStreamProxy({
      scenario: values.scenario ? parseScenario(JSON.parse(await readFile(values.scenario, 'utf8'))) : undefined,
      upstream: values.upstream ? new URL(values.upstream) : undefined,
      delayMs: Number(values['delay-ms']), disconnectMs: values['disconnect-ms'] === undefined ? undefined : Number(values['disconnect-ms']),
    });
    proxy.server.on('error', error => { console.error(error.message); process.exitCode = 1; proxy.close(); });
    proxy.server.listen(port, '127.0.0.1', () => console.log(`Agent Timeline proxy: http://127.0.0.1:${port} (${values.scenario ? 'simulate' : 'forward'})`));
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => proxy.close());
  }
} catch (error) { console.error(error instanceof Error ? error.message : 'Proxy configuration failed'); process.exitCode = 1; }
