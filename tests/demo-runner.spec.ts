import {test,expect} from '@playwright/test';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
for(const preset of ['cancel','recovery','out-of-order','cancel-retry','partial-error','navigation','delete-item','change-inputs','duplicate'] as const)test(`${preset}: built-in report snapshot runs unchanged in the CLI`,async({request})=>{
 const scenario=JSON.parse(await readFile('scenarios/cancel-late-result.json','utf8'));
 const kind=preset==='cancel'||preset==='recovery'?preset:'gallery';
 const input={kind,preset,mode:'fixed',scenario,timing:{partial:100,disconnect:400,checkpoint:700,reconnect:900,retry:1000,response:1200,complete:1300,end:1800}};
 const response=await request.post('/api/runner/builtin',{headers:{'X-Agent-Timeline':'1'},data:input});expect(response.status()).toBe(202);
 const {id}=await response.json();let state:any;
 await expect.poll(async()=>{state=await(await request.get(`/api/runner/run/${id}`)).json();return state.status}).toBe('finished');
 expect(state.report.kind,state.report.message).toBe('pass');expect(state.report.events.some((e:any)=>e.kind==='ui')).toBe(true);
 const folder=await mkdtemp(join(tmpdir(),'timeline-demo-'));
 try{
  const path=join(folder,'config.json');await writeFile(path,JSON.stringify(state.report.scenario));
  const child=spawn(process.execPath,['--import','tsx','backend/runner-cli.ts','--config',path]);let out='',err='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});
  expect(code,err+out).toBe(0);const report=JSON.parse(out);expect(report.assertions.map((a:any)=>[a.description,a.passed])).toEqual(state.report.assertions.map((a:any)=>[a.description,a.passed]));
 }finally{await rm(folder,{recursive:true,force:true})}
});
