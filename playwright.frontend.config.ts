import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', testIgnore: ['provider.spec.ts', 'example-chat.spec.ts'], workers: 1,
  use: { baseURL: 'http://127.0.0.1:4417', headless: true },
  webServer: [
    { command: 'npm run dev:backend', env: { TIMELINE_PROVIDER_PORT: '4418' }, url: 'http://127.0.0.1:4418/api/scenario', reuseExistingServer: false },
    { command: 'npm run dev:frontend -- --port 4417', env: { TIMELINE_PROVIDER_PORT: '4418' }, url: 'http://127.0.0.1:4417', reuseExistingServer: false },
  ],
  reporter: 'list',
});
