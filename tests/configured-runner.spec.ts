import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { runConfiguredApp } from '../backend/runner';
import { parseRunnerConfig } from '../shared/runner-config';
const load=async()=>parseRunnerConfig(JSON.parse(await readFile('examples/proxy/host.config.json','utf8')));
test('workbench runs and stops the configured app without embedding',async({page})=>{
 await page.goto('/');await page.getByLabel('Workbench scenario').selectOption('connected');
 await expect(page.getByRole('heading',{name:'Standalone chat cancellation'})).toBeVisible();
 await expect(page.locator('iframe')).toHaveCount(0);
 await page.getByRole('button',{name:'Run scenario',exact:true}).click();
 await expect(page.getByTestId('configured-verdict')).not.toHaveText('Running…',{timeout:15000});
 expect(await page.getByTestId('configured-verdict').textContent(),await page.locator('main').innerText()).toBe('PASS');
 await expect(page.getByTestId('configured-events')).toContainText('complete');
 await page.getByRole('button',{name:'Replay again'}).click();
 await expect(page.getByRole('button',{name:'Stop test',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Stop test',exact:true}).click();
 await expect(page.getByTestId('configured-verdict')).toHaveText('STOPPED',{timeout:15000});
});
test('same runner catches buggy UI and rejects missing evidence',async()=>{
 const config=await load();config.setup[0].value='buggy';
 const bad=await runConfiguredApp(config);expect(bad.kind).toBe('fail');expect(bad.assertions[0].passed).toBe(false);
 config.setup[0].value='fixed';config.evidence[0].text='impossible evidence';
 expect((await runConfiguredApp(config)).kind).toBe('error');
 config.actions[0].selector='#missing-button';
 expect((await runConfiguredApp(config)).kind).toBe('error');
});
test('CLI uses the same config and returns a passing JSON report',async()=>{
 const child=spawn(process.execPath,['--import','tsx','backend/runner-cli.ts','--config','examples/proxy/host.config.json']);
 let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
 const code=await new Promise<number|null>((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});
 expect(code,stderr+stdout).toBe(0);expect(JSON.parse(stdout).kind).toBe('pass');
});
