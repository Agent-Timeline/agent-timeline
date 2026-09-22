import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', testIgnore: ['provider.spec.ts', 'example-chat.spec.ts'], workers: 1,
  use: { baseURL: 'http://127.0.0.1:4417', headless: true },
  webServer: [
    { command: 'npm run dev:backend', env: { TIMELINE_PROVIDER_PORT: '4418', TIMELINE_EXAMPLE_PORT: '4419', TIMELINE_RUNNER_CONFIG: 'examples/proxy/host.config.json' }, url: 'http://127.0.0.1:4418/api/scenario', reuseExistingServer: false },
    { command: 'npm run dev:frontend -- --port 4417', env: { TIMELINE_PROVIDER_PORT: '4418' }, url: 'http://127.0.0.1:4417', reuseExistingServer: false },
    { command: 'npm run dev:example -- --port 4419', env: { TIMELINE_PROVIDER_PORT: '4418' }, url: 'http://127.0.0.1:4419', reuseExistingServer: false },
    { command: 'npm run dev:example -- --port 4469', env: { TIMELINE_PROVIDER_PORT: '4468' }, url: 'http://127.0.0.1:4469', reuseExistingServer: false },
    { command: 'npm run dev:backend', env: { TIMELINE_PROVIDER_PORT: '4478', TIMELINE_RUNNER_CONFIG: 'examples/proxy/recovery.config.json' }, url: 'http://127.0.0.1:4478/api/scenario', reuseExistingServer: false },
    { command: 'npm run dev:frontend -- --port 4477', env: { TIMELINE_PROVIDER_PORT: '4478' }, url: 'http://127.0.0.1:4477', reuseExistingServer: false },
  ],
  reporter: 'list',
});
