import {raceScenarios} from '../shared/race-scenarios';
import {runDemo,uiSnapshots} from './demo-run';
import { ConfiguredRunner } from './ConfiguredRunner';
import { ThemeToggle } from './ThemeToggle';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { parseScenario, type Scenario } from '../shared/engine';
import { TimelineEditor } from './TimelineEditor';
import './style.css';
import { createTimelineProvider } from '../client/provider';
import { ExternalChat, type ExternalChatHandle } from './ExternalChat';
import { ScenarioGallery } from './ScenarioGallery';
type Observation = { atMs: number; kind: 'cancel' | 'arrival'; label: string };
type Result = { kind: 'pass' | 'fail' | 'error' | 'stopped'; message: string; eventIndex: number | null; failure?: { expected: string; actual: string; detectedAtMs: number; cancelAtMs: number; scenario: Scenario } };
function App({selector,driverTarget=false}: {selector: React.ReactNode;driverTarget?:boolean}) {
  const sharedRun=useRef<AbortController|null>(null);
  const [scenario, setScenario] = useState<Scenario>();
  const [elapsed, setElapsed] = useState(0);
  const [clockAnchor, setClockAnchor] = useState<number | null>(null);
  const [target, setTarget] = useState('demo');
  const external = useRef<ExternalChatHandle>(null);
  const [mode, setMode] = useState('fixed');
  const [status, setStatus] = useState('Idle');
  const [text, setText] = useState('');
  const [observations, setObservations] = useState<Observation[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [fileError, setFileError] = useState('');
  const active = useRef<string | null>(null);
  const transport = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const observer = useRef<MutationObserver | null>(null);
  const responseNode = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const cancelHook = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (clockAnchor === null || !busy) return;
    let frame = 0;
    const tick = () => { setElapsed(Math.min(scenario?.observeUntilMs ?? 0, Math.max(0, Math.round(performance.now() - clockAnchor)))); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clockAnchor, busy, scenario?.observeUntilMs]);
  const append = (s: string) => setLog(old => [...old, s]);
  const cleanup = () => { setClockAnchor(null); timers.current.forEach(clearTimeout); timers.current = []; observer.current?.disconnect(); observer.current = null; cancelHook.current = null; };
  useEffect(() => { fetch('/api/scenario').then(r => r.json()).then(data => setScenario(parseScenario(data))).catch(() => setFileError('Failed to load scenario')); return () => { sharedRun.current?.abort();cleanup(); transport.current?.abort(); }; }, []);
  const reset = () => { sharedRun.current?.abort(); setElapsed(0); external.current?.reset(); generation.current++; cleanup(); transport.current?.abort(); active.current = null; setText(''); setLog([]); setObservations([]); setStatus('Idle'); setBusy(false); setResult(null); };
  const stopTest = () => {
    if (!busy) return;sharedRun.current?.abort();
    generation.current++;
    cleanup();
    transport.current?.abort();
    active.current = null;
    external.current?.reset();
    setBusy(false);
    setStatus('Test stopped');
    append('Test stopped by user · incomplete observation window');
    setResult({ kind: 'stopped', eventIndex: null, message: 'Test stopped before verification finished. This run is incomplete; replay to obtain a verdict.' });
  };
  let validation = '';
  if (scenario) { try { parseScenario(scenario); } catch (error) { validation = String(error).replace('Error: ', ''); } }
  const edit = (next: Scenario) => { reset(); setFileError(''); setScenario(next); };
  const cancel = () => { active.current = null; setStatus('Cancelled'); append('User cancelled · transport stays open to exercise late delivery'); cancelHook.current?.(); };
  const submit = async (automatic = false) => {
    if (busy || !scenario || validation) return;
    if(automatic&&target==='demo'&&!driverTarget){
      reset();const controller=new AbortController();sharedRun.current=controller;setBusy(true);setStatus('Waiting');let anchored=false;
      try{const report=await runDemo({kind:'cancel',mode,scenario},controller.signal,events=>{
        if(controller.signal.aborted)return;if(!anchored&&events.some(e=>e.kind==='run')){anchored=true;setClockAnchor(performance.now()-(events.at(-1)?.atMs??0))}const captures=uiSnapshots(events);const last=captures.at(-1);if(last){setText(last.values.text??'');setStatus(last.values.status??'');setLog((last.values.log??'').split('\n'));try{setObservations(JSON.parse(last.values.observations||'[]'))}catch{}setElapsed(Math.min(scenario.observeUntilMs,last.atMs))}
      },()=>{});if(controller.signal.aborted)return;const evidence=report.assertions.find(a=>!a.passed)?.evidence;
      const captures=uiSnapshots(report.events);const firstBad=captures.find(c=>c.values.text?.includes(scenario.assertion.text));
      let eventIndex:number|null=null;try{const arrivals:Observation[]=JSON.parse(firstBad?.values.observations??'[]');const last=arrivals.filter(o=>o.kind==='arrival').at(-1);const n=last?.label.match(/event #(\d+)/);if(n)eventIndex=Number(n[1])-1}catch{}
      const cancelCapture=captures.find(c=>c.values.status==='Cancelled');
      setResult({kind:report.kind,message:report.message,eventIndex:report.kind==='fail'?eventIndex:null,...(evidence?{failure:{expected:evidence.expected,actual:evidence.actual,detectedAtMs:evidence.atMs,cancelAtMs:cancelCapture?.atMs??scenario.cancelAtMs,scenario}}:{})});setClockAnchor(null);setElapsed(scenario.observeUntilMs);setBusy(false)}catch(e){if(!controller.signal.aborted){setResult({kind:'error',message:String(e),eventIndex:null});setClockAnchor(null);setBusy(false)}}return;
    }
    sharedRun.current=null;setElapsed(0); setClockAnchor(null);
    if (target === 'external' && automatic) { setResult(null); setLog([]); setObservations([]); external.current?.run(); return; }
    cleanup();
    const run = parseScenario(structuredClone(scenario));
    const epoch = ++generation.current;
    const requestId = crypto.randomUUID(); active.current = requestId;
    const controller = new AbortController(); transport.current = controller;
    let cancelled = false, terminal = false, started = false, delivered = 0;
    let lastEvent: number | null = null;
    let startTime = 0;
    const submittedAt = performance.now();
    const record = (kind: Observation['kind'], label: string) => setObservations(old => [...old, { atMs: Math.round(performance.now() - submittedAt), kind, label }]);
    cancelHook.current = () => { if (cancelled) return; cancelled = true; record('cancel', 'Cancel requested'); };
    setResult(null); setText(''); setLog([]); setObservations([]); setBusy(true); setStatus('Waiting'); append('Request submitted');
    const failRun = (message: string) => { cleanup(); controller.abort(); active.current = null; setResult({ kind: 'error', message, eventIndex: null }); setStatus('Run error'); setBusy(false); };
    try {
      timers.current.push(setTimeout(() => { if (!started && epoch === generation.current) failRun('Provider did not start within 10 seconds.'); }, 10000));
      const provider = createTimelineProvider({ endpoint: driverTarget?'/api/runner/stream':'/api/generate' });
      for await (const event of provider.generate({ requestId, scenario: run, signal: controller.signal })) {
          if (epoch !== generation.current) continue;
          if (event.type === 'start') {
            started = true; startTime = performance.now(); setClockAnchor(startTime); append('Provider connected');
            continue;
          }
          lastEvent = delivered++;
          terminal = event.type === 'complete' || event.type === 'error';
          const stale = active.current !== requestId;
          append(`${event.atMs}ms · ${event.type}${stale ? ' · arrived after cancellation' : ''}`);
          record('arrival', `${cancelled ? 'Late response received' : 'Response received'} · ${event.type} · event #${lastEvent + 1} · scheduled ${event.atMs}ms${cancelled ? mode === 'fixed' ? ' · ignored by app' : ' · accepted by app' : ''}`);
          if (mode === 'fixed' && stale) { append('Ignored stale result'); continue; }
          if (event.type === 'text') { setText(old => old + event.text); setStatus('Streaming'); }
          if (event.type === 'complete') { setStatus('Completed'); active.current = null; }
          if (event.type === 'error') { setStatus(`Error: ${event.message}`); active.current = null; }
      }
      if (!terminal && !controller.signal.aborted) throw new Error('Provider stream ended before a terminal event');
    } catch (error) { if (epoch === generation.current && !controller.signal.aborted) failRun(String(error)); }
    finally { if (epoch === generation.current) { cleanup(); setBusy(false); } }
  };
  const exportScenario = () => {
    if (!scenario || validation) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(parseScenario(scenario), null, 2) + '\n'], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${scenario.id.replace(/[^a-zA-Z0-9_-]/g, '-')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importScenario = async (file?: File) => {
    if (!file) return;
    try { if (file.size > 262144) throw new Error('Scenario file must be smaller than 256 KB'); const parsed = parseScenario(JSON.parse(await file.text())); edit(parsed); }
    catch (error) { setFileError(`Import failed: ${String(error).replace('Error: ', '')}`); }
    finally { if (importInput.current) importInput.current.value = ''; }
  };
  return <main>{driverTarget&&scenario&&<><label>Runner setup<textarea id="runner-setup" onChange={e=>{try{setScenario(parseScenario(JSON.parse(e.target.value)))}catch{}}}/></label><pre id="runner-observations" hidden>{JSON.stringify(observations)}</pre></>}<header><ThemeToggle/><span className="eyebrow">AGENT TIMELINE / LOCAL WORKBENCH</span><h1>Make the race repeatable.</h1><a href="/?gallery">Explore more race scenarios →</a><p>Edit the events. Replay the interaction. Verify what stays on screen.</p>{selector}</header>
    <section className="controls"><label>Test target<select aria-label="Test target" value={target} disabled={busy} onChange={e => { reset(); setTarget(e.target.value); }}><option value="demo">Built-in demo</option><option value="external">Standalone chat</option></select></label><label>Application behavior <select aria-label="Application behavior" value={mode} disabled={busy} onChange={e => { reset(); setMode(e.target.value); }}><option value="fixed">Fixed · reject cancelled results</option><option value="buggy">Buggy · accept every result</option></select></label><div className="actions"><button disabled={busy} onClick={() => importInput.current?.click()}>Import JSON</button><input ref={importInput} aria-label="Import scenario file" type="file" accept=".json,application/json" hidden onChange={e => void importScenario(e.target.files?.[0])}/><button disabled={busy || !scenario || !!validation} onClick={exportScenario}>Export JSON</button><button onClick={reset}>Reset</button><button className="primary" disabled={busy || !scenario || !!validation} onClick={() => void submit(true)}>{busy ? 'Running…' : 'Run scenario'}</button>{busy && <button onClick={stopTest}>Stop test</button>}{!busy && result && <button disabled={!scenario || !!validation} onClick={() => void submit(true)}>Replay again</button>}</div></section>
    {(validation || fileError) && <p role="alert" className="validation">{fileError || validation}</p>}
    <div className="workbench-grid">{scenario && <TimelineEditor onRun={() => void submit(true)} onStop={stopTest} canRun={!busy && !validation} scenario={scenario} onChange={edit} disabled={busy} failedEvent={result?.eventIndex ?? null} elapsedMs={elapsed} running={busy} started={clockAnchor !== null || elapsed > 0} receivedCount={observations.filter(event => event.kind === 'arrival').length} cancelled={observations.some(event => event.kind === 'cancel')}/>}
    <aside>{target === 'external' ? <ExternalChat ref={external} scenario={scenario} mode={mode} onBusy={setBusy} onProgress={value => { setClockAnchor(performance.now() - value.elapsedMs); setElapsed(value.elapsedMs); setObservations(value.observations); setLog(value.log.split('\n')); }} onResult={value => { setClockAnchor(null); if (value.kind !== 'error') setElapsed(scenario?.observeUntilMs ?? 0); setResult(value); setObservations(value.observations); setLog(value.log.split('\n')); }}/> : <section className="panel"><span className="eyebrow">REAL UI / SIMULATED PROVIDER</span><h2>Demo application</h2><p className="prompt">{scenario?.prompt || 'Loading scenario…'}</p><div className="actions"><button id="runner-send" disabled={!scenario || busy || !!validation} onClick={() => void submit(false)}>Send prompt</button><button id="runner-cancel" ref={cancelButton} disabled={!busy || status === 'Cancelled' || (!driverTarget && !!sharedRun.current)} onClick={cancel}>Cancel request</button></div><p role="status" data-testid="app-status">{status}</p><div ref={responseNode} data-testid="response" className="response">{text}</div></section>}
    <section className={`panel verdict ${result?.kind || ''}`} aria-live="polite" data-testid="verdict"><h2>{result ? result.kind === 'pass' ? 'PASS' : result.kind === 'fail' ? 'FAIL' : result.kind === 'stopped' ? 'STOPPED · INCOMPLETE' : 'RUN ERROR' : busy ? 'Observing…' : 'Ready to verify'}</h2><p>{result?.message || 'Run the scenario to cancel automatically and check for forbidden text throughout the observation window.'}</p>{result?.failure && <div data-testid="failure-details"><h3>Why this failed</h3><dl><dt>Expected</dt><dd>“{result.failure.expected}” must stay absent after cancellation.</dd><dt>Actual response at first detection</dt><dd><pre>{result.failure.actual}</pre></dd><dt>Timing</dt><dd>Cancellation state captured at {result.failure.cancelAtMs} ms; forbidden text first detected at {result.failure.detectedAtMs} ms — {Math.max(0,result.failure.detectedAtMs-result.failure.cancelAtMs)} ms later.</dd></dl><p>Highlighted arrival is the last delivered event before detection, not proof that it caused the failure.</p><button onClick={() => void submit(true)}>Replay failed scenario</button><p className="hint">Reuses these scenario settings. Browser delivery timing may vary. Export JSON to save the sequence.</p></div>}</section></aside></div>
    <section className="panel"><h2>Observed interaction timeline</h2><p className="hint">Browser receipt times measured from request submission. Cancellation is local; this provider sends no cancellation acknowledgement. Accepted events are handled by the app; the verdict checks what actually appears.</p><ol data-testid="observed-timeline" className="observed-timeline">{observations.map((event, index) => <li key={index} className={`observed-${event.kind} ${result?.kind === 'fail' && (event.kind === 'cancel' || (result.eventIndex !== null && event.label.includes(`event #${result.eventIndex+1} ·`))) ? 'failure-context' : ''}`}><code>{event.atMs} ms</code><span>{event.label}</span></li>)}</ol>{!observations.length && <p>Run a scenario to see cancellation and response arrivals.</p>}</section>
    <section className="panel"><h2>Event log</h2><pre data-testid="event-log">{log.join('\n') || 'Waiting for a request.'}</pre></section><footer>Local development · No live model · Automatic runs use the shared browser runner. Provider offsets start at request receipt; actions start at runner observation start.</footer></main>;
}
function Workbench() {
  const [kind, setKind] = useState('cancel');
  const selector = <label>Scenario<select aria-label="Workbench scenario" value={kind} onChange={event => setKind(event.target.value)}><option value="cancel">Cancel then late response</option><option value="recovery">Connection loss and recovery</option><option value="connected">Connect your app</option>{raceScenarios.filter(s=>s.id!=='connection-recovery').map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select><small>Switching scenarios resets the current run and unsaved edits.</small></label>;
  return kind === 'connected' ? <ConfiguredRunner selector={selector}/> : kind === 'cancel' ? <App selector={selector}/> : kind==='recovery'?<ScenarioGallery workbench selector={selector}/>:<ConfiguredRunner key={kind} selector={selector} preset={kind}/>;
}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).get('runner-target')==='cancel'?<App selector={null} driverTarget/>:new URLSearchParams(location.search).get('runner-target')==='recovery'?<ScenarioGallery driverTarget/>:new URLSearchParams(location.search).has('gallery') ? <ScenarioGallery/> : <Workbench/>);
