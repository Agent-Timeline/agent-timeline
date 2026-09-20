import { writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createStreamProxy } from './proxy.js';
import { parseRunnerConfig, type RunnerConfig } from '../shared/runner-config.js';

export interface SetupCheck { name: string; ok: boolean; message: string }

/** Never replace an existing host configuration. */
export async function saveStarter(path: string, config: RunnerConfig): Promise<void> {
  const validated = parseRunnerConfig(config);
  await writeFile(path, JSON.stringify(validated, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}

/** Reachability only: no browser actions, model requests, or upstream traffic. */
export async function checkSetup(config: RunnerConfig): Promise<SetupCheck[]> {
  parseRunnerConfig(config);
  const checks: SetupCheck[] = [];
  try {
    const response = await fetch(config.appUrl, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
    await response.body?.cancel();
    checks.push({ name: 'App', ok: response.ok, message: response.ok
      ? 'Local app responded. Selectors and endpoint routing still need a test run.'
      : `HTTP ${response.status}. Use a directly reachable local page; redirects are not followed.` });
  } catch {
    checks.push({ name: 'App', ok: false, message: 'App did not respond within 3 seconds. Start your development server and check appUrl.' });
  }

  const proxy = createStreamProxy({ ...config.proxy, upstream: config.proxy.upstream ? new URL(config.proxy.upstream) : undefined });
  try {
    proxy.server.listen(config.proxy.port, '127.0.0.1');
    await once(proxy.server, 'listening');
    const response = await fetch(`http://127.0.0.1:${config.proxy.port}/health`, { signal: AbortSignal.timeout(3000) });
    const ok = response.ok && await response.text() === 'ok';
    checks.push({ name: 'Proxy', ok, message: ok
      ? `Temporary proxy health check passed on port ${config.proxy.port}; it is now stopped. The runner will start it for each test.`
      : 'Temporary proxy health check failed.' });
  } catch (error) {
    const occupied = (error as NodeJS.ErrnoException).code === 'EADDRINUSE';
    checks.push({ name: 'Proxy', ok: false, message: occupied
      ? `Port ${config.proxy.port} is occupied. Stop that service or choose another proxy port and update app routing.`
      : 'Could not start or reach the temporary local proxy.' });
  } finally {
    const closed = proxy.server.listening ? once(proxy.server, 'close') : undefined;
    proxy.close();
    await closed;
  }
  return checks;
}
