import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { runConfiguredApp } from '../backend/runner';
import { parseRunnerConfig } from '../shared/runner-config';
const load=async()=>parseRunnerConfig(JSON.parse(await readFile('examples/proxy/recovery.config.json','utf8')));

test('recovery passes fixed app and fails duplicated retry text',async()=>{
 const config=await load();
 const fixed=await runConfiguredApp(config);
 expect(fixed.kind,fixed.message).toBe('pass');
 expect(fixed.events.some(e=>e.message==='request 1: disconnect')).toBe(true);
 expect(fixed.events.some(e=>e.message==='request 1: aborted')).toBe(true);
 expect(fixed.events.some(e=>e.message==='request 2: complete')).toBe(true);
 config.setup[0].value='buggy';
 const buggy=await runConfiguredApp(config);
 expect(buggy.kind,buggy.message).toBe('fail');expect(buggy.assertions[2].passed).toBe(false);
 expect(buggy.assertions[2].evidence?.phase).toBe('final');expect(buggy.assertions[2].evidence?.actual).not.toBe(buggy.assertions[2].evidence?.expected);expect(buggy.assertions[3].passed).toBe(true); // Completion alone cannot hide duplication.
});

test('recovery requires the retry and preserves failed intermediate checks',async()=>{
 const config=await load();config.actions.pop();
 expect((await runConfiguredApp(config)).kind).toBe('error');
 config.actions.push({atMs:1000,type:'click',selector:'#retry'});
 config.assertions[0].text='not the disconnected state';
 const result=await runConfiguredApp(config);
 expect(result.kind,result.message).toBe('fail');expect(result.assertions[0].passed).toBe(false);
 expect(result.assertions[0].evidence?.phase).toBe('checkpoint');expect(result.assertions[0].evidence?.actual).toContain('Connection error:');expect(result.assertions[3].passed).toBe(true);
});

test('recovery workbench runs, stops and replays the shared runner',async({page})=>{
 await page.goto('http://127.0.0.1:4477');
 await page.getByLabel('Workbench scenario').selectOption('connected');
 await expect(page.getByRole('heading',{name:'Connection loss and recovery'})).toBeVisible();
 await page.getByRole('button',{name:'Run scenario',exact:true}).click();
 await expect(page.getByTestId('configured-verdict')).toHaveText('PASS',{timeout:15000});
 await expect(page.getByTestId('configured-events')).toContainText('request 1: disconnect');
 await expect(page.getByTestId('configured-events')).toContainText('request 2: complete');
 await page.getByRole('button',{name:'Replay again'}).click();
 await expect(page.getByTestId('configured-events')).toContainText('request 1: disconnect');
 await page.getByRole('button',{name:'Stop test',exact:true}).click();
 await expect(page.getByTestId('configured-verdict')).toHaveText('STOPPED',{timeout:15000});
 await page.getByRole('button',{name:'Replay again'}).click();
 await expect(page.getByTestId('configured-verdict')).toHaveText('PASS',{timeout:15000});
});

test('recovery CLI returns the same assertions and request events',async()=>{
 const child=spawn(process.execPath,['--import','tsx','backend/runner-cli.ts','--config','examples/proxy/recovery.config.json']);
 let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
 const code=await new Promise<number|null>((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});
 expect(code,stderr+stdout).toBe(0);const report=JSON.parse(stdout);
 expect(report.kind).toBe('pass');expect(report.assertions).toHaveLength(4);
 expect(report.events.some((e:any)=>e.message==='request 1: disconnect')).toBe(true);
});
