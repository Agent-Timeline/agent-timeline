import type {RunEvent,RunReport} from '../shared/runner-config';
export async function runDemo(input:unknown,signal:AbortSignal,onEvents:(events:RunEvent[])=>void,onId:(id:string)=>void):Promise<RunReport>{
 const response=await fetch('/api/runner/builtin',{method:'POST',headers:{'X-Agent-Timeline':'1','Content-Type':'application/json'},body:JSON.stringify(input)});const data=await response.json();if(!response.ok)throw Error(data.error);onId(data.id);
 const stop=()=>{void fetch(`/api/runner/run/${data.id}/stop`,{method:'POST',headers:{'X-Agent-Timeline':'1'}}).catch(()=>{})};signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
 try{while(!signal.aborted){const res=await fetch(`/api/runner/run/${data.id}`);const state=await res.json();if(!res.ok)throw Error(state.error);onEvents(state.events);if(state.status==='finished')return state.report;await new Promise(r=>setTimeout(r,75))}throw Error('Stopped')}finally{signal.removeEventListener('abort',stop)}
}
export function uiSnapshots(events:RunEvent[]):{atMs:number;values:Record<string,string>}[]{return events.filter(e=>e.kind==='ui').map(e=>JSON.parse(e.message))}
