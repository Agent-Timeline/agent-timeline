import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Scenario } from '../src/engine';
import './style.css';
function App() {
  const [scenario, setScenario] = useState<Scenario>();
  const [mode, setMode] = useState('fixed');
  const [status, setStatus] = useState('Idle');
  const [text, setText] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const active = useRef<string | null>(null);
  const transport = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const append = (s: string) => setLog(old => [...old, s]);
  useEffect(() => { fetch('/api/scenario').then(r => r.json()).then(setScenario).catch(() => setStatus('Failed to load scenario')); return () => { transport.current?.abort(); }; }, []);
  const reset = () => { generation.current++; transport.current?.abort(); active.current = null; setText(''); setLog([]); setStatus('Idle'); setBusy(false); };
  const submit = async () => {
    if (busy) return;
    const epoch = ++generation.current;
    const requestId = crypto.randomUUID(); active.current = requestId;
    const controller = new AbortController(); transport.current = controller;
    setText(''); setLog([]); setBusy(true); setStatus('Waiting'); append('Request submitted');
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId }), signal: controller.signal });
      if (!response.ok || !response.body) throw new Error('Provider request failed');
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
          if (event.type === 'start') { append('Provider connected'); continue; }
          const stale = active.current !== requestId;
          append(`${event.atMs}ms · ${event.type}${stale ? ' · arrived after cancellation' : ''}`);
          if (mode === 'fixed' && stale) { append('Ignored stale result'); continue; }
          if (event.type === 'text') { setText(old => old + event.text); setStatus('Streaming'); }
          if (event.type === 'complete') { setStatus('Completed'); active.current = null; }
          if (event.type === 'error') { setStatus(`Error: ${event.message}`); active.current = null; }
        }
      }
    } catch (error) { if (epoch === generation.current && !controller.signal.aborted) setStatus(String(error)); }
    finally { if (epoch === generation.current) setBusy(false); }
  };
  const cancel = () => { active.current = null; setStatus('Cancelled'); append('User cancelled · transport stays open to exercise late delivery'); };
  return <main><header><span className="eyebrow">AGENT TIMELINE / FIRST EXPERIMENT</span><h1>What arrives after cancel?</h1><p>A real chat interface. A simulated provider. One repeatable race.</p></header>
    <section className="controls"><label>Application behavior <select aria-label="Application behavior" value={mode} disabled={busy} onChange={e => { reset(); setMode(e.target.value); }}><option value="fixed">Fixed · reject cancelled results</option><option value="buggy">Buggy · accept every result</option></select></label><button onClick={reset}>Reset</button></section>
    <div className="grid"><section className="panel"><h2>Demo application</h2><p className="prompt">{scenario?.prompt || 'Loading scenario…'}</p><div className="actions"><button className="primary" disabled={!scenario || busy} onClick={submit}>Send prompt</button><button disabled={!busy || status === 'Cancelled'} onClick={cancel}>Cancel request</button></div><p role="status">{status}</p><div data-testid="response" className="response">{text}</div></section>
    <section className="panel"><h2>Provider schedule</h2><p>Offsets start when the provider receives a request.</p><ol>{scenario?.events.map((e, i) => <li key={i}><code>{e.atMs}ms</code><span>{e.type === 'text' ? e.text : e.type}</span></li>)}</ol><p className="hint">Send, then cancel before 1,100ms. Compare both modes—or run the automated browser tests.</p></section></div>
    <section className="panel"><h2>Event log</h2><pre data-testid="event-log">{log.join('\n') || 'Waiting for a request.'}</pre></section><footer>Local development demo · No live model · MIT</footer></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
