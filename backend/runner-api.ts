import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseRunnerConfig, type RunEvent, type RunReport } from '../shared/runner-config.js';
import { runConfiguredApp } from './runner.js';
export function createRunnerApi(configPath:string|undefined){
 let current:{id:string;status:'running'|'finished';events:RunEvent[];report?:RunReport;controller:AbortController}|undefined;
 const json=(res:ServerResponse,status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
 const config=async()=>parseRunnerConfig(JSON.parse(await readFile(configPath!,'utf8')));
 return {
 close(){current?.controller.abort()},
 async handle(req:IncomingMessage,res:ServerResponse):Promise<boolean>{
  if(!req.url?.startsWith('/api/runner'))return false;
  try{
   if(req.headers.origin&&!['127.0.0.1','localhost','[::1]'].includes(new URL(req.headers.origin).hostname)){json(res,403,{error:'Local origin required'});return true}
   if(!configPath){json(res,503,{error:'Set TIMELINE_RUNNER_CONFIG to a local host config file, then restart the backend.'});return true}
   if(req.method==='GET'&&req.url==='/api/runner/config'){json(res,200,await config());return true}
   if(req.method==='GET'&&req.url?.startsWith('/api/runner/run/')){const id=req.url.slice('/api/runner/run/'.length);if(current?.id!==id){json(res,404,{error:'Run not found'});return true}json(res,200,{id:current.id,status:current.status,events:current.events,report:current.report});return true}
   if(req.method!=='POST'||req.headers['x-agent-timeline']!=='1'){json(res,400,{error:'Unsupported runner request'});return true}
   if(req.url==='/api/runner/run'){
    if(current?.status==='running'){json(res,409,{error:'A run is already active'});return true}
    const input=await config();const run={id:crypto.randomUUID(),status:'running' as 'running'|'finished',events:[] as RunEvent[],controller:new AbortController(),report:undefined as RunReport|undefined};current=run;
    void runConfiguredApp(input,{id:run.id,signal:run.controller.signal,onEvent:event=>run.events.push(event)}).then(report=>{run.report=report;run.status='finished'}).catch(error=>{run.report={id:run.id,kind:'error',message:String(error),events:run.events,assertions:[]};run.status='finished'});
    json(res,202,{id:run.id});return true;
   }
   if(req.url===`/api/runner/run/${current?.id}/stop`&&current){current.controller.abort();json(res,202,{id:current.id});return true}
   json(res,404,{error:'Unknown runner route'});return true;
  }catch(error){json(res,400,{error:error instanceof Error?error.message:String(error)});return true}
 }
 };
}
