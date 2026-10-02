import {parseRunnerConfig, type RunnerConfig} from './runner-config.js';
export interface RunnerMark {id:string;lane:string;label:string;atMs:number;maxMs:number}
/** A projection of the runner contract, never a second executable scenario format. */
export function runnerMarks(config:RunnerConfig):RunnerMark[]{
 const marks:RunnerMark[]=[];
 config.actions.forEach((a,i)=>marks.push({id:`action:${i}`,lane:'App actions · run start',label:`${a.type} ${a.selector}`,atMs:a.atMs,maxMs:config.observeUntilMs-1}));
 config.assertions.forEach((a,i)=>marks.push({id:`assertion:${i}`,lane:'Assertions · observation start',label:`${a.type} ${a.selector}${a.type==='textAbsent'?' · window starts':a.atMs===undefined?' · final (read-only)':''}`,atMs:a.type==='textAbsent'?a.fromMs:a.atMs??config.observeUntilMs,maxMs:a.type!=='textAbsent'&&a.atMs===undefined?config.observeUntilMs:config.observeUntilMs-1}));
 if(!config.proxy.requests?.every(r=>r.scenario))config.proxy.scenario?.events.forEach((e,i)=>marks.push({id:`event:${i}`,lane:'Provider template · each request receipt',label:e.type,atMs:e.atMs,maxMs:config.proxy.scenario!.observeUntilMs}));
 if(config.proxy.requests)config.proxy.requests.forEach((r,i)=>{r.scenario?.events.forEach((e,j)=>marks.push({id:`requestEvent:${i}:${j}`,lane:`Request ${i+1} provider · request receipt`,label:e.type,atMs:e.atMs,maxMs:r.scenario!.observeUntilMs}));for(const key of ['delayMs','disconnectMs'] as const)if(r[key]!==undefined)marks.push({id:`request:${i}:${key}`,lane:`Request ${i+1} faults · request receipt`,label:key,atMs:r[key]!,maxMs:60000})});
 else for(const key of ['delayMs','disconnectMs'] as const)if(config.proxy[key]!==undefined)marks.push({id:`fault:${key}`,lane:'Transport faults · request receipt',label:key,atMs:config.proxy[key]!,maxMs:60000});
 return marks;
}
export function retimeRunner(config:RunnerConfig,id:string,time:number):RunnerConfig{
 const next=structuredClone(config);const [kind,key,field]=id.split(':');const i=Number(key);
 if(!Number.isInteger(time)||time<0||time>60000)throw Error('Time must be an integer from 0 to 60000 ms');
 if(kind==='action'&&next.actions[i]){next.actions[i].atMs=time;next.actions.sort((a,b)=>a.atMs-b.atMs)}
 else if(kind==='assertion'&&next.assertions[i]){const a=next.assertions[i];if(a.type==='textAbsent')a.fromMs=time;else if(a.atMs!==undefined)a.atMs=time;else throw Error('Final assertions stay at the observation deadline')}
 else if(kind==='event'&&next.proxy.scenario?.events[i]){next.proxy.scenario.events[i].atMs=time;next.proxy.scenario.events.sort((a,b)=>a.atMs-b.atMs)}
 else if(kind==='requestEvent'&&next.proxy.requests?.[i]?.scenario?.events[Number(field)]){const scenario=next.proxy.requests[i].scenario!;scenario.events[Number(field)].atMs=time;scenario.events.sort((a,b)=>a.atMs-b.atMs)}
 else if(kind==='request'&&next.proxy.requests?.[i]&&['delayMs','disconnectMs'].includes(field))next.proxy.requests[i][field as 'delayMs'|'disconnectMs']=time;
 else if(kind==='fault'&&['delayMs','disconnectMs'].includes(key))next.proxy[key as 'delayMs'|'disconnectMs']=time;
 else throw Error('Unknown timeline event');
 return parseRunnerConfig(next);
}
