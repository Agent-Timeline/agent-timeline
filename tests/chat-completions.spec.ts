import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {runConfiguredApp} from '../backend/runner';
import {parseRunnerConfig} from '../shared/runner-config';
import {spawn} from 'node:child_process';
const load=async()=>parseRunnerConfig(JSON.parse(await readFile('examples/proxy/chat-completions.config.json','utf8')));
test('SSE chat catches late text, passes fixed handling, and works through workbench and CLI',async({page,request})=>{
 const config=await load();config.setup[0].value='buggy';expect((await runConfiguredApp(config)).kind).toBe('fail');config.setup[0].value='fixed';
 const original=await (await request.get('/api/runner/config')).json();
 try{
  expect((await request.post('/api/runner/setup',{headers:{'X-Agent-Timeline':'1'},data:config})).ok()).toBeTruthy();
  await page.goto('/');await page.getByLabel('Workbench scenario').selectOption('connected');await page.getByRole('button',{name:'Run scenario',exact:true}).click();await expect(page.getByTestId('configured-verdict')).toHaveText('PASS',{timeout:15000});
 }finally{await request.post('/api/runner/setup',{headers:{'X-Agent-Timeline':'1'},data:original})}
 const child=spawn(process.execPath,['--import','tsx','backend/runner-cli.ts','--config','examples/proxy/chat-completions.config.json']);let output='';child.stdout.on('data',c=>output+=c);const code=await new Promise(resolve=>child.on('exit',resolve));expect(code).toBe(0);expect(JSON.parse(output).kind).toBe('pass');
});
