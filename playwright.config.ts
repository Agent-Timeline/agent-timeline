import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '**/*.spec.ts', workers: 1, use: { baseURL: 'http://127.0.0.1:4317', headless: true }, webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4317', reuseExistingServer: !process.env.CI }, reporter: 'list' });
