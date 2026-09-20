import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./examples/proxy',testMatch:'late-chunk.spec.ts',workers:1,
  use:{baseURL:'http://127.0.0.1:4459',headless:true},reporter:'list',
  webServer:[
    {command:'npm run proxy -- --scenario scenarios/cancel-late-result.json --port 4458',url:'http://127.0.0.1:4458/health',reuseExistingServer:false},
    {command:'npm run dev:example -- --port 4459',env:{TIMELINE_PROVIDER_PORT:'4458'},url:'http://127.0.0.1:4459',reuseExistingServer:false},
  ],
});
