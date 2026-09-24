import React, { useEffect, useRef, useState } from 'react';
import type { RunnerConfig, RunEvent, RunReport } from '../shared/runner-config';
import { ThemeToggle } from './ThemeToggle';
const stop=(id:string)=>fetch(`/api/runner/run/${id}/stop`,{method:'POST',headers:{'X-Agent-Timeline':'1'}}).catch(()=>{});
export function ConfiguredRunner({selector}:{selector:React.ReactNode}){
 const [config,setConfig]=useState<RunnerConfig>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [events,setEvents]=useState<RunEvent[]>([]);const [report,setReport]=useState<RunReport>();
 const active=useRef<string | undefined>(undefined);const mounted=useRef(true);const timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
 useEffect(()=>{mounted.current=true;fetch('/api/runner/config').then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(mounted.current)setConfig(data)}).catch(e=>{if(mounted.current)setError(e.message)});return()=>{mounted.current=false;clearTimeout(timer.current);if(active.current)void stop(active.current)}},[]);
 const run=async()=>{
  setBusy(true);setError('');setReport(undefined);setEvents([]);
  try{
   const response=await fetch('/api/runner/run',{method:'POST',headers:{'X-Agent-Timeline':'1'}});const data=await response.json();if(!response.ok)throw new Error(data.error);
   if(!mounted.current){void stop(data.id);return}active.current=data.id;
   const poll=async()=>{try{const reply=await fetch(`/api/runner/run/${data.id}`);const result=await reply.json();if(!reply.ok)throw new Error(result.error);if(!mounted.current)return;setEvents(result.events);if(result.status==='finished'){setReport(result.report);setBusy(false);active.current=undefined}else timer.current=setTimeout(poll,200)}catch(e){if(mounted.current){setError(String(e));setBusy(false)}void stop(data.id)}};
   void poll();
  }catch(e){if(mounted.current){setError(String(e));setBusy(false)}}
 };
 return <main><header><ThemeToggle/><span className="eyebrow">AGENT TIMELINE / CONNECTED APP</span><h1>Run against your app.</h1><p>The same proxy and Playwright runner used by the CLI. Your app runs at its own URL in an isolated browser.</p>{selector}</header>
 {error&&<p role="alert" className="validation">{error}</p>}
 {config&&<><section className="panel"><h2>{config.name}</h2><p>App: <code>{config.appUrl}</code></p><p>Proxy: <code>127.0.0.1:{config.proxy.port}{config.proxy.path}</code> · Observe {config.observeUntilMs} ms</p><p>Edit your local JSON config to change actions, assertions, or endpoint. Each run reloads that file.</p><details><summary>Loaded configuration</summary><pre>{JSON.stringify(config,null,2)}</pre></details><div className="actions"><button className="primary" disabled={busy} onClick={()=>void run()}>Run scenario</button>{busy&&<button disabled={!active.current} onClick={()=>{if(active.current)void stop(active.current)}}>Stop test</button>}{report&&!busy&&<button onClick={()=>void run()}>Replay again</button>}</div></section>
 <section className="panel" aria-live="polite"><h2 data-testid="configured-verdict">{busy?'Running…':report?report.kind.toUpperCase():'Ready'}</h2><p>{report?.message}</p>{report?.assertions.map((a,i)=><div key={i}><p>{a.passed?'PASS':'FAIL'} · {a.description}</p>{a.evidence&&<section className="failure-context" data-testid="configured-failure"><h3>Why this failed</h3><dl><dt>Expected ({a.evidence.type})</dt><dd>{a.evidence.expected}</dd><dt>Actual UI text</dt><dd><pre style={{whiteSpace:'pre-wrap'}}>{a.evidence.actual || '(empty text)'}</pre></dd><dt>Target</dt><dd><code>{a.evidence.selector}</code></dd><dt>Observed</dt><dd>{a.evidence.atMs} ms · {a.evidence.phase} · browser observation clock</dd></dl></section>}</div>)}</section>
 <section className="panel"><h2>Observed events</h2><p>Events use the runner clock; captured UI text uses the browser observation clock. Nearby events provide context, not proof of causality. Replay again reloads your current configuration file.</p><ol data-testid="configured-events">{events.map((event,i)=><li key={i}><code>{event.atMs} ms</code> · {event.kind} · {event.message}</li>)}</ol></section></>}
 </main>;
}
