import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {raceScenarios} from '../shared/race-scenarios';
test('gallery presets are selectable and edited snapshots run, export and import',async({page})=>{
 await page.goto('/');
 for(const preset of raceScenarios.filter(s=>s.id!=='connection-recovery')){
  await page.getByLabel('Workbench scenario').selectOption(preset.id);
  await expect(page.getByRole('heading',{name:preset.title,exact:true})).toBeVisible();
 }
 await page.getByLabel('Workbench scenario').selectOption('out-of-order');
 await page.getByLabel('click [data-action="second"] milliseconds',{exact:true}).fill('300');
 await page.locator('.runner-lane').filter({has:page.getByRole('heading',{name:'Request 2 provider · request receipt',exact:true})}).getByLabel('text milliseconds',{exact:true}).fill('250');
 await page.getByText('Edit full configuration',{exact:true}).click();
 await page.getByRole('button',{name:'Load current JSON'}).click();
 const config=JSON.parse(await page.getByLabel('Runner configuration JSON').inputValue());
 config.proxy.requests[1].scenario.events[0].text='Custom result';
 config.assertions.find((a:any)=>a.type==='textEquals').text='Custom result';
 await page.getByLabel('Runner configuration JSON').fill(JSON.stringify(config));
 await page.getByRole('button',{name:'Apply JSON'}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export runner config'}).click();
 const saved=JSON.parse(await readFile((await(await download).path())!,'utf8'));expect(saved).toEqual(config);
 await page.getByRole('button',{name:'Reset preset'}).click();
 await page.getByLabel('Import runner config file').setInputFiles({name:'edited.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await expect(page.getByLabel('click [data-action="second"] milliseconds',{exact:true})).toHaveValue('300');
 await page.getByRole('button',{name:'Run scenario',exact:true}).click();
 await expect(page.getByTestId('configured-verdict')).toHaveText('PASS',{timeout:15000});
 await expect(page.getByTestId('configured-events')).toContainText('Custom result');
 await page.getByLabel('Preset behavior').selectOption('buggy');
 await page.getByRole('button',{name:'Run scenario',exact:true}).click();
 await expect(page.getByTestId('configured-verdict')).toHaveText('FAIL',{timeout:15000});
 await page.getByLabel('Import runner config file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByRole('heading',{name:config.name,exact:true})).toBeVisible();
});
test('preset snapshots cannot change destination and unknown presets are rejected',async({request})=>{
 const config=await(await request.get('/api/runner/preset/duplicate')).json();
 config.appUrl='http://127.0.0.1:9999/';
 const response=await request.post('/api/runner/preset/duplicate',{headers:{'X-Agent-Timeline':'1'},data:config});
 expect(response.status()).toBe(400);expect((await response.json()).error).toContain('destination');
 expect((await request.get('/api/runner/preset/unknown')).status()).toBe(400);
});
