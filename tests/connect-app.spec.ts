import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('connection form checks, loads, runs and exports a real synthetic app configuration',async({page,request})=>{
 const original=JSON.parse(await readFile('examples/proxy/host.config.json','utf8'));
 try{
 await page.goto('/');await page.getByLabel('Workbench scenario').selectOption('connected');
 await page.getByLabel('Local app URL',{exact:true}).fill('https://example.com');
 await page.getByRole('button',{name:'Use this configuration',exact:true}).click();
 await expect(page.getByText('Error: Use a loopback development URL without credentials',{exact:true})).toBeVisible();
 await page.getByLabel('Local app URL',{exact:true}).fill('http://127.0.0.1:4469');
 await page.getByLabel('Send button selector').fill('#send');await page.getByLabel('Cancel button selector').fill('#cancel');await page.getByLabel('Response container selector').fill('#response');await page.getByLabel('Delivery log selector').fill('#events');
 await page.getByRole('button',{name:'Check connection',exact:true}).click();
 await expect(page.getByText(/OK · App:/)).toBeVisible();await expect(page.getByText(/OK · Proxy:/)).toBeVisible();
 await page.getByRole('button',{name:'Use this configuration',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Local app cancellation',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Run scenario',exact:true}).click();
 await expect(page.getByTestId('configured-verdict')).toHaveText('PASS',{timeout:15000});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export runner config',exact:true}).click();const file=await download;const exported=JSON.parse(await readFile((await file.path())!,'utf8'));expect(exported.appUrl).toBe('http://127.0.0.1:4469');expect(exported.actions[1].selector).toBe('#cancel');
 }finally{await request.post('/api/runner/setup',{headers:{'X-Agent-Timeline':'1'},data:original})}
});
test('setup API rejects remote URLs and requests without the local action header',async({request})=>{
 const config=JSON.parse(await readFile('examples/proxy/host.config.json','utf8'));
 expect((await request.post('/api/runner/setup',{data:config})).status()).toBe(400);
 config.appUrl='https://example.com';expect((await request.post('/api/runner/setup',{headers:{'X-Agent-Timeline':'1'},data:config})).status()).toBe(400);
 expect((await request.post('/api/runner/check',{headers:{'X-Agent-Timeline':'1',Origin:'https://example.com'},data:config})).status()).toBe(403);
});
