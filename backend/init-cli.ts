#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseRunnerConfig } from '../shared/runner-config.js';
import { saveStarter, checkSetup } from './init.js';

const help = `Usage: npm run init -- --app-url http://127.0.0.1:3000 [options]

Creates a starter cancellation test without changing your app. Existing files are never overwritten.
  --out FILE                 Config destination (default agent-timeline.config.json)
  --proxy-port PORT          Runner-owned proxy port (default 4468)
  --endpoint PATH            Proxy POST route (default /api/generate)
  --upstream URL             Fixed local unauthenticated upstream instead of NDJSON simulation
  --send-selector CSS        Send control (default [data-testid="send"])
  --cancel-selector CSS      Cancel control (default [data-testid="cancel"])
  --response-selector CSS    Response container (default [data-testid="response"])
  --evidence-selector CSS    Delivery log container (default [data-testid="events"])
  --evidence-text TEXT       Required delivery evidence (default Stream ended)
  --skip-check               Only write config; skip app/proxy reachability checks
  --help                    Show this help

Review selectors, timing, forbidden text, and delivery evidence before running.
Checks do not click controls, call the upstream, or verify app-to-proxy routing.
Exit codes: 0 generated/checks passed (or skipped), 1 generated/check incomplete, 2 configuration/write error.`;

try {
  const { values } = parseArgs({ options: {
    'app-url': { type: 'string' }, out: { type: 'string', default: 'agent-timeline.config.json' },
    'proxy-port': { type: 'string', default: '4468' }, endpoint: { type: 'string', default: '/api/generate' },
    upstream: { type: 'string' }, 'send-selector': { type: 'string', default: '[data-testid="send"]' },
    'cancel-selector': { type: 'string', default: '[data-testid="cancel"]' },
    'response-selector': { type: 'string', default: '[data-testid="response"]' },
    'evidence-selector': { type: 'string', default: '[data-testid="events"]' },
    'evidence-text': { type: 'string', default: 'Stream ended' },
    'skip-check': { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log(help);
  } else {
    if (!values['app-url']) throw new Error('Supply --app-url with your local development app URL. Run npm run init -- --help for options.');
    const scenario = JSON.parse(await readFile(new URL('../scenarios/cancel-late-result.json', import.meta.url), 'utf8'));
    const config = parseRunnerConfig({
      version: 1, name: 'Local app cancellation', appUrl: values['app-url'],
      proxy: { port: Number(values['proxy-port']), path: values.endpoint,
        ...(values.upstream ? { upstream: values.upstream } : { scenario }) },
      setup: [],
      actions: [
        { atMs: 0, type: 'click', selector: values['send-selector'] },
        { atMs: 700, type: 'click', selector: values['cancel-selector'] },
      ],
      observeUntilMs: 2200,
      assertions: [{ type: 'textAbsent', selector: values['response-selector'], text: 'Weekend Atlas', fromMs: 700 }],
      evidence: [{ selector: values['evidence-selector'], text: values['evidence-text'] }],
    });
    const file = resolve(values.out!);
    await saveStarter(file, config);
    console.log(`Created ${file}`);
    console.log('Review these CSS selectors (each must match one element):');
    for (const [label, selector] of [['Send', values['send-selector']], ['Cancel', values['cancel-selector']], ['Response', values['response-selector']], ['Delivery evidence', values['evidence-selector']]]) console.log(`  ${label}: ${selector}`);
    console.log(`Route your app's development POST endpoint to http://127.0.0.1:${config.proxy.port}${config.proxy.path}. Keep production routing unchanged.`);
    console.log(values.upstream ? 'Forwarding relays raw bytes without credentials; review expected cancellation outcome and choose real forbidden text/evidence.' : 'Simulation emits Agent Timeline NDJSON; your client must understand this protocol. It is not an automatic AI SDK adapter.');
    console.log('Set prompt/setup actions if needed. Review 700ms cancellation, 2200ms observation, forbidden text "Weekend Atlas", and evidence "' + values['evidence-text'] + '". Evidence must prove delivery, not just that Send was clicked.');
    if (!values['skip-check']) {
      const checks = await checkSetup(config);
      for (const check of checks) console.log(`${check.ok ? 'OK' : 'CHECK'} ${check.name}: ${check.message}`);
      if (checks.some(check => !check.ok)) process.exitCode = 1;
    } else console.log('Reachability checks skipped. Configuration has not been tested.');
    console.log('Keep private app configurations and reports in your own repository.');
    // Single-quote escaping for the documented POSIX shell commands, never executed here.
    const quoted = "'" + file.replaceAll("'", "'\\''") + "'";
    console.log(`After reviewing the config, run from the Agent Timeline checkout:\nnpm run run:app -- --config ${quoted}\nOr start the workbench:\nTIMELINE_RUNNER_CONFIG=${quoted} npm run dev\nSelect Connected app (config file). See docs/RUNNER.md.`);
  }
} catch (error) {
  console.error((error as NodeJS.ErrnoException).code === 'EEXIST'
    ? 'Config already exists; nothing overwritten. Edit that file or choose a different --out path.'
    : error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
