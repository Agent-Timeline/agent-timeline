import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { parseScenario, type Scenario } from '../src/engine';
import { TimelineEditor } from './TimelineEditor';
import './style.css';
type Result = { kind: 'pass' | 'fail' | 'error'; message: string; eventIndex: number | null };
function App() {
  const [scenario, setScenario] = useState<Scenario>();
  const [mode, setMode] = useState('fixed');
  const [status, setStatus] = useState('Idle');
  const [text, setText] = useState('');
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
  const append = (s: string) => setLog(old => [...old, s]);
  const cleanup = () => { timers.current.forEach(clearTimeout); timers.current = []; observer.current?.disconnect(); observer.current = null; cancelHook.current = null; };
  useEffect(() => { fetch('/api/scenario').then(r => r.json()).then(data => setScenario(parseScenario(data))).catch(() => setFileError('Failed to load scenario')); return () => { cleanup(); transport.current?.abort(); }; }, []);
  const reset = () => { generation.current++; cleanup(); transport.current?.abort(); active.current = null; setText(''); setLog([]); setStatus('Idle'); setBusy(false); setResult(null); };
  let validation = '';
  if (scenario) { try { parseScenario(scenario); } catch (error) { validation = String(error).replace('Error: ', ''); } }
  const edit = (next: Scenario) => { reset(); setFileError(''); setScenario(next); };
  const cancel = () => { active.current = null; setStatus('Cancelled'); append('User cancelled · transport stays open to exercise late delivery'); cancelHook.current?.(); };
  const submit = async (automatic = false) => {
    if (busy || !scenario || validation) return;
    cleanup();
    const run = parseScenario(structuredClone(scenario));
    const epoch = ++generation.current;
    const requestId = crypto.randomUUID(); active.current = requestId;
    const controller = new AbortController(); transport.current = controller;
    let cancelled = false, terminal = false, started = false, delivered = 0;
    let lastEvent: number | null = null;
    let violation: { eventIndex: number | null; elapsed: number } | null = null;
    let startTime = 0;
    setResult(null); setText(''); setLog([]); setBusy(true); setStatus('Waiting'); append('Request submitted');
    const inspect = () => {
      if (cancelled && !violation && responseNode.current?.textContent?.includes(run.assertion.text)) {
        violation = { eventIndex: lastEvent, elapsed: Math.round(performance.now() - startTime) };
      }
    };
    const failRun = (message: string) => { cleanup(); controller.abort(); active.current = null; setResult({ kind: 'error', message, eventIndex: null }); setStatus('Run error'); setBusy(false); };
    try {
      timers.current.push(setTimeout(() => { if (!started && epoch === generation.current) failRun('Provider did not start within 10 seconds.'); }, 10000));
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, scenario: run }), signal: controller.signal });
      if (!response.ok || !response.body) throw new Error('Provider rejected the request');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n'); pending = lines.pop()!;
        for (const line of lines) {
          if (!line || epoch !== generation.current) continue;
          const event = JSON.parse(line);
          if (event.requestId !== requestId) continue;
          if (event.type === 'start') {
            started = true; startTime = performance.now(); append('Provider connected');
            if (automatic) {
              observer.current = new MutationObserver(inspect);
              observer.current.observe(responseNode.current!, { subtree: true, childList: true, characterData: true });
              cancelHook.current = () => { cancelled = true; inspect(); };
              timers.current.push(setTimeout(() => cancelButton.current?.click(), run.cancelAtMs));
              timers.current.push(setTimeout(() => {
                if (epoch !== generation.current) return;
                inspect();
                if (!cancelled || !terminal || delivered !== run.events.length) {
                  failRun('Incomplete run: cancellation or scheduled provider events were not observed.'); return;
                }
                cleanup();
                const found = violation as { eventIndex: number | null; elapsed: number } | null;
                setResult(found ? { kind: 'fail', eventIndex: found.eventIndex, message: `Forbidden text appeared after cancellation at ${found.elapsed}ms. ${found.eventIndex === null ? '' : `Last delivered event: #${found.eventIndex + 1}.`}` } : { kind: 'pass', eventIndex: null, message: `“${run.assertion.text}” stayed absent after cancellation through ${run.observeUntilMs}ms.` });
                setBusy(false);
              }, run.observeUntilMs));
            }
            continue;
          }
          lastEvent = delivered++;
          terminal = event.type === 'complete' || event.type === 'error';
          const stale = active.current !== requestId;
          append(`${event.atMs}ms · ${event.type}${stale ? ' · arrived after cancellation' : ''}`);
          if (mode === 'fixed' && stale) { append('Ignored stale result'); continue; }
          if (event.type === 'text') { setText(old => old + event.text); setStatus('Streaming'); }
          if (event.type === 'complete') { setStatus('Completed'); active.current = null; }
          if (event.type === 'error') { setStatus(`Error: ${event.message}`); active.current = null; }
        }
      }
      if (!terminal && !controller.signal.aborted) throw new Error('Provider stream ended before a terminal event');
    } catch (error) { if (epoch === generation.current && !controller.signal.aborted) failRun(String(error)); }
    finally { if (epoch === generation.current && !automatic) { cleanup(); setBusy(false); } }
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
  return <main><header><span className="eyebrow">AGENT TIMELINE / LOCAL WORKBENCH</span><h1>Make the race repeatable.</h1><p>Edit the events. Replay the interaction. Verify what stays on screen.</p></header>
    <section className="controls"><label>Application behavior <select aria-label="Application behavior" value={mode} disabled={busy} onChange={e => { reset(); setMode(e.target.value); }}><option value="fixed">Fixed · reject cancelled results</option><option value="buggy">Buggy · accept every result</option></select></label><div className="actions"><button disabled={busy} onClick={() => importInput.current?.click()}>Import JSON</button><input ref={importInput} aria-label="Import scenario file" type="file" accept=".json,application/json" hidden onChange={e => void importScenario(e.target.files?.[0])}/><button disabled={busy || !scenario || !!validation} onClick={exportScenario}>Export JSON</button><button onClick={reset}>Reset</button><button className="primary" disabled={busy || !scenario || !!validation} onClick={() => void submit(true)}>{busy ? 'Running…' : 'Run scenario'}</button></div></section>
    {(validation || fileError) && <p role="alert" className="validation">{fileError || validation}</p>}
    <div className="workbench-grid">{scenario && <TimelineEditor scenario={scenario} onChange={edit} disabled={busy} failedEvent={result?.eventIndex ?? null}/>}
    <aside><section className="panel"><span className="eyebrow">REAL UI / SIMULATED PROVIDER</span><h2>Demo application</h2><p className="prompt">{scenario?.prompt || 'Loading scenario…'}</p><div className="actions"><button disabled={!scenario || busy || !!validation} onClick={() => void submit(false)}>Send prompt</button><button ref={cancelButton} disabled={!busy || status === 'Cancelled'} onClick={cancel}>Cancel request</button></div><p role="status">{status}</p><div ref={responseNode} data-testid="response" className="response">{text}</div></section>
    <section className={`panel verdict ${result?.kind || ''}`} aria-live="polite" data-testid="verdict"><h2>{result ? result.kind === 'pass' ? 'PASS' : result.kind === 'fail' ? 'FAIL' : 'RUN ERROR' : busy ? 'Observing…' : 'Ready to verify'}</h2><p>{result?.message || 'Run the scenario to cancel automatically and check for forbidden text throughout the observation window.'}</p></section></aside></div>
    <section className="panel"><h2>Event log</h2><pre data-testid="event-log">{log.join('\n') || 'Waiting for a request.'}</pre></section><footer>Local development · No live model · Provider offsets start at request receipt; browser actions start at acknowledgement.</footer></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
