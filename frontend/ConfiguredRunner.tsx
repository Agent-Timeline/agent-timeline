import React, { useEffect, useRef, useState } from 'react';
import {RunnerTimeline} from './RunnerTimeline';
import {parseRunnerConfig} from '../shared/runner-config';
import type { RunnerConfig, RunEvent, RunReport } from '../shared/runner-config';
import { ThemeToggle } from './ThemeToggle';
const stop=(id:string)=>fetch(`/api/runner/run/${id}/stop`,{method:'POST',headers:{'X-Agent-Timeline':'1'}}).catch(()=>{});
export function ConfiguredRunner({selector}:{selector:React.ReactNode}){
 const [config,setConfig]=useState<RunnerConfig>();const [draft,setDraft]=useState('');let validation='';if(config){try{parseRunnerConfig(config)}catch(e){validation=String(e)}}
 const edit=(value:RunnerConfig)=>{setConfig(value);setReport(undefined);setEvents([])};const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [events,setEvents]=useState<RunEvent[]>([]);const [report,setReport]=useState<RunReport>();
 const active=useRef<string | undefined>(undefined);const mounted=useRef(true);const timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
 useEffect(()=>{mounted.current=true;fetch('/api/runner/config').then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(mounted.current)setConfig(data)}).catch(e=>{if(mounted.current)setError(e.message)});return()=>{mounted.current=false;clearTimeout(timer.current);if(active.current)void stop(active.current)}},[]);
 const run=async(snapshot?:RunnerConfig)=>{
  if(validation||!config)return;
  setBusy(true);setError('');setReport(undefined);setEvents([]);
  try{
   const response=await fetch('/api/runner/run',{method:'POST',headers:{'X-Agent-Timeline':'1','Content-Type':'application/json'},body:JSON.stringify(snapshot??config)});const data=await response.json();if(!response.ok)throw new Error(data.error);
   if(!mounted.current){void stop(data.id);return}active.current=data.id;
   const poll=async()=>{try{const reply=await fetch(`/api/runner/run/${data.id}`);const result=await reply.json();if(!reply.ok)throw new Error(result.error);if(!mounted.current)return;setEvents(result.events);if(result.status==='finished'){setReport(result.report);if(result.report.scenario)setConfig(result.report.scenario);setBusy(false);active.current=undefined}else timer.current=setTimeout(poll,200)}catch(e){if(mounted.current){setError(String(e));setBusy(false)}void stop(data.id)}};
   void poll();
  }catch(e){if(mounted.current){setError(String(e));setBusy(false)}}
 };
 return <main><header><ThemeToggle/><span className="eyebrow">AGENT TIMELINE / CONNECTED APP</span><h1>Run against your app.</h1><p>The same proxy and Playwright runner used by the CLI. Your app runs at its own URL in an isolated browser.</p>{selector}</header>
 {error&&<p role="alert" className="validation">{error}</p>}
 {config&&<><section className="panel"><h2>{config.name}</h2><p>App: <code>{config.appUrl}</code></p><p>Proxy: <code>127.0.0.1:{config.proxy.port}{config.proxy.path}</code> · Observe {config.observeUntilMs} ms</p><p>Timeline and JSON edits run as one validated snapshot. Run uses the visible configuration; replay uses the last run snapshot. Reload file discards unsaved edits. Endpoint changes require editing the configured file and reloading this page.</p><button disabled={busy} onClick={()=>{void fetch('/api/runner/config').then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);edit(parseRunnerConfig(data));setError('')}).catch(e=>setError(String(e)))}}>Reload file</button><details><summary>Loaded configuration</summary><pre>{JSON.stringify(config,null,2)}</pre></details><div className="actions"><button className="primary" disabled={busy||!!validation} onClick={()=>void run()}>Run scenario</button>{busy&&<button disabled={!active.current} onClick={()=>{if(active.current)void stop(active.current)}}>Stop test</button>}{report&&!busy&&<button onClick={()=>void run(report.scenario)}>Replay again</button>}</div></section>
 {validation&&<p role="alert">{validation}</p>}
 <RunnerTimeline config={config} disabled={busy} onChange={edit}/>
 <section className="panel"><h2>Scenario JSON</h2><p>One configuration format for timeline edits, CLI and CI. Export this configuration to run it with run:app --config FILE.</p><button disabled={busy||!!validation} onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='agent-timeline.config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>Export runner config</button><details><summary>Edit full configuration</summary><button disabled={busy} onClick={()=>setDraft(JSON.stringify(config,null,2))}>Load current JSON</button><textarea className="runner-json" aria-label="Runner configuration JSON" disabled={busy} value={draft} onChange={e=>setDraft(e.target.value)}/><button disabled={busy} onClick={()=>{try{edit(parseRunnerConfig(JSON.parse(draft)));setError('')}catch(e){setError(String(e))}}}>Apply JSON</button></details></section>
 <section className="panel" aria-live="polite"><h2 data-testid="configured-verdict">{busy?'Running…':report?report.kind.toUpperCase():'Ready'}</h2><p>{report?.message}</p>{report?.assertions.map((a,i)=><div key={i}><p>{a.passed?'PASS':'FAIL'} · {a.description}</p>{a.evidence&&<section className="failure-context" data-testid="configured-failure"><h3>Why this failed</h3><dl><dt>Expected ({a.evidence.type})</dt><dd>{a.evidence.expected}</dd><dt>Actual UI text</dt><dd><pre style={{whiteSpace:'pre-wrap'}}>{a.evidence.actual || '(empty text)'}</pre></dd><dt>Target</dt><dd><code>{a.evidence.selector}</code></dd><dt>Observed</dt><dd>{a.evidence.atMs} ms · {a.evidence.phase} · browser observation clock</dd></dl></section>}</div>)}</section>
 <section className="panel"><h2>Observed events</h2><p>Events use the runner clock; captured UI text uses the browser observation clock. Nearby events provide context, not proof of causality. Replay again reuses the captured run configuration; delivery timing remains approximate.</p><ol data-testid="configured-events">{events.map((event,i)=><li key={i}><code>{event.atMs} ms</code> · {event.kind} · {event.message}</li>)}</ol></section></>}
 </main>;
}
