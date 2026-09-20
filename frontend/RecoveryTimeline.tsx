import React from 'react';
import type { RaceScenario } from './raceScenarios';
export interface RecoveryTiming { partial: number; disconnect: number; checkpoint: number; reconnect: number; retry: number; response: number; complete: number; end: number }
export const defaultRecoveryTiming: RecoveryTiming = {partial:100,disconnect:400,checkpoint:700,reconnect:900,retry:1000,response:1200,complete:1300,end:1800};
const names: Record<keyof RecoveryTiming,string> = {partial:'Partial text',disconnect:'Disconnect stream',checkpoint:'Check disconnected state',reconnect:'Restore connection',retry:'Retry request',response:'Retry text',complete:'Retry complete',end:'Final verification'};
export function recoveryValidation(t: RecoveryTiming): string {
 const values=Object.values(t);
 if(values.some(v=>!Number.isInteger(v)||v<0||v>60000)) return 'Use whole milliseconds between 0 and 60,000.';
 if (!(t.partial < t.disconnect && t.disconnect < t.checkpoint && t.checkpoint < t.reconnect && t.reconnect <= t.retry && t.retry < t.response && t.response < t.complete && t.complete < t.end)) return 'Order events as partial text → disconnect → checkpoint → reconnect → retry → response → completion → final verification.';
 return '';
}
export function configureRecovery(base: RaceScenario,t: RecoveryTiming): RaceScenario {
 return {...base,observeUntilMs:t.end,requests:[[{atMs:t.partial,type:'text',text:'Draft'},{atMs:t.end-1,type:'text',text:' abandoned'},{atMs:t.end,type:'complete'}],[{atMs:t.response-t.retry,type:'text',text:'Draft recovered'},{atMs:t.complete-t.retry,type:'complete'}]],actions:[{atMs:0,action:'first'},{atMs:t.disconnect,action:'disconnect'},{atMs:t.reconnect,action:'reconnect'},{atMs:t.retry,action:'second'}],checkpoint:{atMs:t.checkpoint,text:'Draft',status:'Disconnected'}};
}
export function RecoveryTimeline({timing,onChange,disabled,elapsed}:{timing:RecoveryTiming;onChange:(value:RecoveryTiming)=>void;disabled:boolean;elapsed:number}) {
 const lanes: {name:string;keys:(keyof RecoveryTiming)[]}[]=[{name:'Connection actions',keys:['disconnect','reconnect']},{name:'Request 1 · starts at 0 ms',keys:['partial']},{name:'Request 2 · full retry',keys:['retry','response','complete']},{name:'Assertions',keys:['checkpoint','end']}];
 const duration=Math.max(1,timing.end);
 return <section className="panel recovery-timeline"><h2>Shape the recovery sequence</h2><p>Actions and checks use time from run start. Response positions are planned: provider offsets start when each request reaches the provider. The first stream is aborted, not resumed.</p><div className="recovery-scroll"><div className="recovery-chart">
 <div className="recovery-axis">{[0,.25,.5,.75,1].map(n=><span key={n} style={{left:`${n*100}%`}}>{Math.round(n*duration)} ms</span>)}</div>
 {lanes.map(lane=><div className="recovery-lane" key={lane.name}><strong>{lane.name}</strong><div className="recovery-playhead" style={{left:`${Math.min(100,elapsed/duration*100)}%`}} aria-hidden="true"/>{lane.keys.map((key,i)=><div className="recovery-event" key={key} data-testid={`recovery-${key}`} style={{left:`${Math.max(0,Math.min(100,timing[key]/duration*100))}%`,top:34+i*48}}><span>{names[key]}</span><small>{timing[key]} ms</small></div>)}</div>)}
 </div></div><p>Elapsed: {elapsed} ms</p><fieldset disabled={disabled} className="recovery-fields">{(Object.keys(names) as (keyof RecoveryTiming)[]).map(key=><label key={key}>{names[key]} (ms)<input type="number" min="0" max="60000" value={timing[key]} onChange={e=>onChange({...timing,[key]:Number(e.target.value)})}/></label>)}</fieldset><button disabled={disabled} type="button" onClick={()=>onChange({...defaultRecoveryTiming})}>Restore recovery timings</button><p className="hint">Checkpoint: keep “Draft” visible and show Disconnected. Final: exactly “Draft recovered”, Completed, and no duplicate or abandoned text. Timeline positions are schedules, not proof of delivery; see observed events and verdict below.</p></section>;
}
