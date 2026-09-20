import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'provider.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4428' },
  webServer: {
    command: 'npm run dev:backend', env: { TIMELINE_PROVIDER_PORT: '4428' },
    url: 'http://127.0.0.1:4428/api/scenario', reuseExistingServer: false,
  },
  reporter: 'list',
});
