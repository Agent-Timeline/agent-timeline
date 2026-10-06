import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {runConfiguredApp} from '../backend/runner';
import {parseRunnerConfig} from '../shared/runner-config';
const load=async()=>parseRunnerConfig(JSON.parse(await readFile('examples/proxy/host.config.json','utf8')));
test('runner distinguishes selectors, missing routing, rejected protocol and evidence',async()=>{
 let config=await load();config.setup=[{atMs:0,type:'click',selector:'#missing-control'}];
 let report=await runConfiguredApp(config);expect(report.kind).toBe('error');expect(report.diagnosis).toMatchObject({code:'action-target',selector:'#missing-control'});
 config=await load();config.actions=[];report=await runConfiguredApp(config);expect(report.diagnosis?.code).toBe('no-proxy-request');
 config=await load();config.proxy.protocol='chat-completions';config.actions=config.actions.slice(0,1);report=await runConfiguredApp(config);expect(report.diagnosis?.code).toBe('request-rejected');
 config=await load();config.evidence=[{selector:'#events',text:'Not real delivery evidence'}];report=await runConfiguredApp(config);expect(report.kind).toBe('error');expect(report.diagnosis?.code).toBe('missing-evidence');
});
test('workbench shows diagnosis and next step with plain-text selectors',async({page})=>{
 await page.route('**/api/runner/run',r=>r.fulfill({json:{id:'diagnostic'}}));
 await page.route('**/api/runner/run/diagnostic',r=>r.fulfill({json:{status:'finished',events:[],report:{id:'diagnostic',kind:'error',message:'Check failed',assertions:[],diagnosis:{code:'selector-target',title:'A check could not find its target',detail:'No matching element',selector:'<script>synthetic</script>',nextStep:'Use a selector matching exactly one element.'}}}}));
 await page.goto('/');await page.getByLabel('Workbench scenario').selectOption('connected');await page.getByRole('button',{name:'Run scenario',exact:true}).click();
 await expect(page.getByTestId('run-diagnosis')).toContainText('Try this:');await expect(page.getByTestId('run-diagnosis')).toContainText('<script>synthetic</script>');await expect(page.getByTestId('run-diagnosis').locator('script')).toHaveCount(0);
});
