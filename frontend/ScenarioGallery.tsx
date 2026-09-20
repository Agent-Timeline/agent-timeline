import {RecoveryTimeline, defaultRecoveryTiming, configureRecovery, recoveryValidation} from './RecoveryTimeline';
import { ThemeToggle } from './ThemeToggle';
import React, { useEffect, useRef, useState } from 'react';
import { raceScenarios, type Action } from './raceScenarios';

export function ScenarioGallery({workbench = false, selector}: {workbench?: boolean; selector?: React.ReactNode}) {
  const [recoveryTiming, setRecoveryTiming] = useState({...defaultRecoveryTiming});
  const [elapsed, setElapsed] = useState(0);
  const [inspectionTime, setInspectionTime] = useState<number | null>(null);
  const snapshots = useRef<{atMs:number; text:string; status:string}[]>([]);
  const [recordedEnd, setRecordedEnd] = useState<number | null>(null);
  const capture = () => {
    const snapshot = {atMs: Math.max(0, Math.round(performance.now() - started.current)), text: root.current?.querySelector('[data-testid="gallery-output"]')?.textContent || '', status: root.current?.querySelector('[data-testid="gallery-status"]')?.textContent || ''};
    const last = snapshots.current.at(-1);
    if (!last || last.text !== snapshot.text || last.status !== snapshot.status) snapshots.current.push(snapshot);
  };
  const [selected, select] = useState(raceScenarios[0].id);
  const [mode, setMode] = useState('fixed');
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('Idle');
  const [screen, setScreen] = useState('editor');
  const [exists, setExists] = useState(true);
  const [input, setInput] = useState('Original brief');
  const [verdict, setVerdict] = useState('Ready');
  const [log, setLog] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const actions = useRef<Partial<Record<Action, HTMLButtonElement | null>>>({});
  const epoch = useRef(0), revision = useRef(0), active = useRef<string | null>(null);
  const controllers = useRef<AbortController[]>([]), timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const watch = useRef<MutationObserver | null>(null);
  const started = useRef(0);
  const baseScenario = raceScenarios.find(s => s.id === selected)!;
  const scenario = selected === 'connection-recovery' ? configureRecovery(baseScenario,recoveryTiming) : baseScenario;
  const validation = selected === 'connection-recovery' ? recoveryValidation(recoveryTiming) : '';
  const duration = scenario.observeUntilMs ?? 1800;
  useEffect(()=>{if(!running)return;let frame=0;const tick=()=>{setElapsed(Math.min(duration,Math.round(performance.now()-started.current)));frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[running,duration]);
  const append = (message: string) => setLog(old => [...old, `${Math.round(performance.now() - started.current)}ms · ${message}`]);
  const stop = () => { epoch.current++; timers.current.forEach(clearTimeout); timers.current = []; controllers.current.forEach(c => c.abort()); controllers.current = []; watch.current?.disconnect(); watch.current = null; active.current = null; };
  useEffect(() => () => stop(), []);
  const reset = () => { snapshots.current = []; setRecordedEnd(null); setInspectionTime(null); setElapsed(0); stop(); revision.current++; setRunning(false); setDraft(''); setStatus('Idle'); setScreen('editor'); setExists(true); setInput('Original brief'); setVerdict('Ready'); setLog([]); connected.current = true; };
  const connected = useRef(true);
  const pending = useRef(0), delivered = useRef(0), problem = useRef('');
  const request = async (index: number) => {
    const events = scenario.requests[index]; if (!events) return;
    if (!connected.current) { append('Request blocked while disconnected'); return; }
    const currentEpoch = epoch.current, currentRevision = revision.current;
    const requestId = crypto.randomUUID(); active.current = requestId;
    const controller = new AbortController(); controllers.current.push(controller);
    const seen = new Set<string>();
    pending.current++; if (!(scenario.id === 'connection-recovery' && index === 1 && mode === 'buggy')) setDraft(''); setStatus('Loading'); append(`Request ${index + 1} submitted`);
    let terminal = false;
    try {
      const response = await fetch('/api/generate', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, scenario: { version: 1, id: scenario.id, prompt: input, cancelAtMs: 0, observeUntilMs: duration, events, assertion: { type: 'textAbsentAfterCancel', text: 'unused gallery assertion' } } }) });
      if (!response.ok || !response.body) throw new Error('Provider rejected request');
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop()!;
        for (const line of lines) {
          if (!line || currentEpoch !== epoch.current) continue;
          const event = JSON.parse(line); if (event.type === 'start') continue;
          if (event.requestId !== requestId) throw new Error('Mismatched request identity');
          delivered.current++;
          terminal = event.type === 'complete' || event.type === 'error';
          const stale = active.current !== requestId || currentRevision !== revision.current;
          const duplicate = event.eventId && seen.has(event.eventId);
          if (event.eventId) seen.add(event.eventId);
          const ignored = mode === 'fixed' && (stale || duplicate);
          append(`Request ${index + 1} · ${event.type}${stale ? ' · stale arrival' : ''}${duplicate ? ' · duplicate event' : ''} · ${ignored ? 'ignored' : 'accepted'}`);
          if (ignored) continue;
          if (event.type === 'text') { setExists(true); setDraft(old => old + event.text); setStatus('Streaming'); }
          if (event.type === 'complete') { setStatus('Completed'); active.current = null; }
          if (event.type === 'error') { if (mode === 'fixed') setStatus(`Error: ${event.message}`); active.current = null; }
        }
      }
      if (!terminal && !controller.signal.aborted) throw new Error('Stream ended without termination');
    } catch (error) { if (currentEpoch === epoch.current && !controller.signal.aborted) problem.current = String(error); }
    finally { if (currentEpoch === epoch.current) pending.current--; }
  };
  const act = (action: Action) => {
    append(action);
    if (action === 'first' || action === 'second') { void request(action === 'first' ? 0 : 1); return; }
    if (action === 'disconnect') {
      connected.current = false; controllers.current.forEach(controller => controller.abort());
      active.current = null; revision.current++;
      if (mode === 'fixed') setStatus('Disconnected');
      append('Simulated connection loss: active transport aborted'); return;
    }
    if (action === 'reconnect') { connected.current = true; setStatus('Connected · ready to retry'); append('Connection restored; explicit retry required'); return; }
    active.current = null; revision.current++;
    if (action === 'cancel') setStatus('Cancelled');
    if (action === 'leave') { setScreen('library'); setDraft(''); setStatus('Idle'); }
    if (action === 'return') setScreen('editor');
    if (action === 'delete') { setExists(false); setDraft(''); setStatus('Deleted'); }
    if (action === 'change') { setInput('Updated brief'); setDraft(''); setStatus('Input changed'); }
  };
  const run = () => {
    if(validation)return;
    reset(); started.current = performance.now(); pending.current = 0; delivered.current = 0; problem.current = ''; setRunning(true); setVerdict('Observing…');
    snapshots.current = [{atMs:0,text:'',status:'Idle'}];
    let violation = '';
    const inspect = () => {
      capture();
      const text = root.current?.querySelector('[data-testid="gallery-output"]')?.textContent || '';
      if (scenario.forbidden.some(word => text.includes(word))) violation ||= 'Forbidden or duplicate content appeared.';
    };
    watch.current = new MutationObserver(inspect); watch.current.observe(root.current!, { subtree: true, childList: true, characterData: true });
    for (const step of scenario.actions) timers.current.push(setTimeout(() => actions.current[step.action]?.click(), step.atMs));
    const checkpoint = scenario.checkpoint;
    if (checkpoint) timers.current.push(setTimeout(() => {
      const text = root.current?.querySelector('[data-testid="gallery-output"]')?.textContent;
      const state = root.current?.querySelector('[data-testid="gallery-status"]')?.textContent;
      if (text !== checkpoint.text || state !== checkpoint.status) violation ||= 'Partial content or error recovery state was incorrect before retry.';
      append('Checked partial content and error state before retry');
    }, checkpoint.atMs));
    timers.current.push(setTimeout(() => {
      inspect();
      const actual = root.current?.querySelector('[data-testid="gallery-output"]')?.textContent || '';
      if (actual !== scenario.expected) violation ||= 'Final content did not match the expected result.';
      if (scenario.id === 'delete-item' && root.current?.querySelector('[data-testid="gallery-output"]')) violation ||= 'Deleted item was recreated.';
      if (scenario.expectedStatus && root.current?.querySelector('[data-testid="gallery-status"]')?.textContent !== scenario.expectedStatus) violation ||= 'Final loading/recovery state was incorrect.';
      const expectedEvents = scenario.expectedDelivered ?? scenario.requests.reduce((sum, events) => sum + events.length, 0);
      setVerdict(problem.current || pending.current || delivered.current !== expectedEvents ? `RUN ERROR: ${problem.current || 'Provider events incomplete'}` : violation ? `FAIL: ${violation}` : 'PASS: All scenario assertions held.');
      setRecordedEnd(Math.max(duration, Math.round(performance.now()-started.current))); stop(); setRunning(false); setElapsed(duration);
    }, duration));
  };
  const inspected = inspectionTime === null ? null : snapshots.current.filter(snapshot => snapshot.atMs <= inspectionTime).at(-1);
  const labels: Record<Action, string> = { first: 'Generate', second: 'Generate again / Retry', cancel: 'Cancel', leave: 'Leave editor', return: 'Return to editor', delete: 'Delete item', change: 'Change brief', disconnect: 'Disconnect stream', reconnect: 'Restore connection' };
  return <main><header><ThemeToggle/><span className="eyebrow">AGENT TIMELINE / {workbench ? 'LOCAL WORKBENCH' : 'SCENARIO GALLERY'}</span><h1>{workbench ? 'Connection loss and recovery' : `${raceScenarios.length} races to reproduce.`}</h1><p>Real fictional editor state, simulated provider streams. Each case includes an intentionally buggy behavior and a corrected version.</p>{workbench ? <a href="/?gallery">Explore more race scenarios →</a> : <a href="/">Back to editable cancellation workbench</a>}{selector}</header>
    <section className="controls">{!workbench && <label>Scenario<select aria-label="Gallery scenario" value={selected} disabled={running} onChange={e => { reset(); select(e.target.value); }}>{raceScenarios.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}<label>Behavior<select aria-label="Gallery behavior" value={mode} disabled={running} onChange={e => { reset(); setMode(e.target.value); }}><option value="fixed">Fixed</option><option value="buggy">Buggy</option></select></label><div className="actions"><button onClick={reset}>{workbench ? 'Reset' : 'Reset gallery'}</button><button className="primary" disabled={running || !!validation} onClick={run}>{workbench ? 'Run scenario' : 'Run gallery scenario'}</button>{running && <button onClick={() => {capture(); setRecordedEnd(Math.round(performance.now()-started.current)); stop(); setRunning(false); setVerdict('STOPPED · INCOMPLETE'); setStatus('Stopped');}}>Stop test</button>}{!running && verdict !== 'Ready' && <button disabled={!!validation} onClick={run}>Replay again</button>}</div></section>
    {selected === 'connection-recovery' && <RecoveryTimeline timing={recoveryTiming} onChange={value=>{reset();setRecoveryTiming(value)}} disabled={running} elapsed={inspectionTime ?? elapsed} onSeek={inspectionTime !== null ? setInspectionTime : undefined}/>}
    {selected === 'connection-recovery' && !running && recordedEnd !== null && <section className="panel"><h2>Inspect replay</h2><p>Inspect recorded text, status, and events. The original verdict stays unchanged. This is a state recording, not a screenshot or a rerun.</p>{inspectionTime === null ? <button onClick={()=>setInspectionTime(recordedEnd)}>Inspect replay</button> : <><button onClick={()=>setInspectionTime(null)}>Exit inspection</button><label>Inspection time: {inspectionTime} ms<input aria-label="Inspection time" type="range" min={0} max={recordedEnd} step={1} value={inspectionTime} onChange={event=>setInspectionTime(Number(event.target.value))}/></label><p>Drag the solid playhead above or use this slider. Arrow keys move by 1 ms.</p><p data-testid="inspection-status">{inspected?.status || 'Idle'}</p><div className="response" data-testid="inspection-output">{inspected?.text || ''}</div><pre data-testid="inspection-events">{log.filter(line=>Number.parseInt(line,10)<=inspectionTime).join('\n') || 'No events yet.'}</pre></>}</section>}
    {validation && <p role="alert" className="validation">{validation}</p>}
    <section className="panel"><h2>{scenario.title}</h2><p>{scenario.goal}</p><ol>{scenario.actions.map((a, i) => <li key={i}><code>{a.atMs} ms</code>{labels[a.action]}</li>)}</ol><p className="hint">Actions run automatically using the editor controls below. Choose Buggy to reproduce the failure, then Fixed to verify the correction. This scenario observes for {duration} ms.</p></section>
    <section className="panel" ref={root}><h2>Fictional draft editor</h2><div className="actions">{Object.entries(labels).map(([action, label]) => <button key={action} ref={node => { actions.current[action as Action] = node; }} disabled={!running} onClick={() => act(action as Action)}>{label}</button>)}</div><p>Screen: {screen} · Brief: {input}</p><p data-testid="gallery-status">{status}</p>{screen === 'editor' ? exists ? <div className="response" data-testid="gallery-output">{draft}</div> : <p>Item deleted</p> : <p>Library</p>}</section>
    <section className="panel" aria-live="polite"><h2 data-testid="gallery-verdict">{verdict}</h2></section><section className="panel"><h2>Observed events</h2><pre data-testid="gallery-log">{log.join('\n') || 'Waiting for replay.'}</pre></section></main>;
}
