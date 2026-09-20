import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'example-chat.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4439', headless: true },
  webServer: [
    { command: 'npm run dev:backend', env: { TIMELINE_PROVIDER_PORT: '4438' }, url: 'http://127.0.0.1:4438/api/scenario', reuseExistingServer: false },
    { command: 'npm run dev:example -- --port 4439', env: { TIMELINE_PROVIDER_PORT: '4438' }, url: 'http://127.0.0.1:4439', reuseExistingServer: false },
  ], reporter: 'list',
});
