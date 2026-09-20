import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { checkSetup } from '../backend/init.js';
import { parseRunnerConfig } from '../shared/runner-config.js';

async function listen(server: ReturnType<typeof createServer>) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return (server.address() as { port: number }).port;
}
async function freePort() {
  const server = createServer(); const port = await listen(server);
  await new Promise<void>(resolve => server.close(() => resolve())); return port;
}
async function cli(args: string[]) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'backend/init-cli.ts', ...args]);
  let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk);
  const [code] = await once(child, 'exit'); return { code, output };
}

test('init writes a valid starter, checks local app/proxy, and refuses overwrites', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'timeline-init-'));
  const app = createServer((_req, res) => res.end('synthetic app'));
  const appPort = await listen(app); const proxyPort = await freePort(); const file = join(dir, 'host.json');
  try {
    const args = ['--app-url', `http://127.0.0.1:${appPort}`, '--proxy-port', String(proxyPort), '--out', file, '--send-selector', '#send'];
    const result = await cli(args); assert.equal(result.code, 0, result.output);
    assert.match(result.output, /OK App/); assert.match(result.output, /OK Proxy/);
    const original = await readFile(file, 'utf8'); const config = parseRunnerConfig(JSON.parse(original));
    assert.equal(config.actions[0].selector, '#send'); assert.equal(config.proxy.port, proxyPort);
    const duplicate = await cli(args); assert.equal(duplicate.code, 2); assert.match(duplicate.output, /nothing overwritten/);
    assert.equal(await readFile(file, 'utf8'), original);
    // Temporary proxy was cleaned up; a second check can bind the same port.
    assert.ok((await checkSetup(config)).every(check => check.ok));
  } finally { app.close(); app.closeAllConnections(); await rm(dir, { recursive: true }); }
});

test('init saves offline configuration but returns incomplete checks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'timeline-init-'));
  try {
    const port = await freePort(); const proxyPort = await freePort(); const file = join(dir, 'host.json');
    const result = await cli(['--app-url', `http://127.0.0.1:${port}`, '--proxy-port', String(proxyPort), '--out', file]);
    assert.equal(result.code, 1, result.output); assert.match(result.output, /CHECK App/);
    parseRunnerConfig(JSON.parse(await readFile(file, 'utf8')));
  } finally { await rm(dir, { recursive: true }); }
});

test('setup flags occupied proxy ports and does not follow app redirects', async () => {
  let redirected = false;
  const destination = createServer((_req, res) => { redirected = true; res.end('wrong app'); });
  const target = await listen(destination);
  const app = createServer((_req, res) => { res.writeHead(302, { Location: `http://127.0.0.1:${target}` }); res.end(); });
  const port = await listen(app);
  try {
    const config = parseRunnerConfig(JSON.parse(await readFile('examples/proxy/host.config.json', 'utf8')));
    config.appUrl = `http://127.0.0.1:${port}`; config.proxy.port = port;
    const checks = await checkSetup(config);
    assert.equal(checks[0].ok, false); assert.match(checks[0].message, /302/);
    assert.equal(checks[1].ok, false); assert.match(checks[1].message, /occupied/); assert.equal(redirected, false);
  } finally { app.close(); app.closeAllConnections(); destination.close(); destination.closeAllConnections(); }
});

test('init rejects nonlocal URLs before writing and supports explicit skipped checks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'timeline-init-')); const file = join(dir, 'host.json');
  try {
    assert.equal((await cli(['--app-url', 'https://example.com', '--out', file])).code, 2);
    await assert.rejects(readFile(file), { code: 'ENOENT' });
    const result = await cli(['--app-url', 'http://127.0.0.1:3000', '--out', file, '--skip-check', '--upstream', 'http://127.0.0.1:3001/stream']);
    assert.equal(result.code, 0, result.output); assert.match(result.output, /checks skipped/);
    const config = parseRunnerConfig(JSON.parse(await readFile(file, 'utf8')));
    assert.equal(config.proxy.scenario, undefined); assert.equal(config.proxy.upstream, 'http://127.0.0.1:3001/stream');
  } finally { await rm(dir, { recursive: true }); }
});
