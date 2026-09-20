import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Scenario } from '../shared/engine';
import type { HostCommand, HostReply, HostResult } from '../shared/host-run';
export interface ExternalChatHandle { run: () => void; reset: () => void }
export const ExternalChat = forwardRef<ExternalChatHandle, {
  scenario?: Scenario; mode: string; onBusy: (busy: boolean) => void; onResult: (result: HostResult) => void;
}>(function ExternalChat({ scenario, mode, onBusy, onResult }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [url, setUrl] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<string | null>(null), timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onBusy, onResult }); callbacks.current = { onBusy, onResult };
  const post = (command: HostCommand) => { if (url) frame.current?.contentWindow?.postMessage(command, new URL(url).origin); };
  const clear = () => { pending.current = null; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; };
  const fail = (message: string) => { clear(); callbacks.current.onBusy(false); callbacks.current.onResult({ kind: 'error', message, eventIndex: null, observations: [], log: '' }); };
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/example-target', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
      const target = new URL(data.url);
      if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1') throw new Error();
      setUrl(target.href);
    }).catch(() => { if (!controller.signal.aborted) setError('Could not load the standalone chat target.'); });
    return () => { controller.abort(); clear(); };
  }, []);
  useEffect(() => {
    if (!url) return;
    const listen = (event: MessageEvent<HostReply>) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(url).origin || event.data?.channel !== 'agent-timeline') return;
      if (event.data.type === 'ready') setReady(true);
      if (event.data.type === 'result' && event.data.id === pending.current) {
        clear(); callbacks.current.onBusy(false); callbacks.current.onResult(event.data.result);
      }
    };
    window.addEventListener('message', listen);
    const hello = setInterval(() => post({ channel: 'agent-timeline', type: 'hello' }), 500);
    return () => { clearInterval(hello); window.removeEventListener('message', listen); post({ channel: 'agent-timeline', type: 'reset' }); };
  }, [url]);
  useImperativeHandle(ref, () => ({
    reset() { clear(); post({ channel: 'agent-timeline', type: 'reset' }); },
    run() {
      if (!ready || !scenario) { fail('Start the standalone app with npm run dev:example, then wait for it to connect.'); return; }
      clear(); const id = crypto.randomUUID(); pending.current = id; onBusy(true);
      post({ channel: 'agent-timeline', type: 'run', id, scenario: structuredClone(scenario), mode: mode === 'buggy' ? 'buggy' : 'fixed' });
      timeout.current = setTimeout(() => { post({ channel: 'agent-timeline', type: 'reset' }); fail('Standalone app stopped responding before verification finished.'); }, scenario.observeUntilMs + 15000);
    },
  }));
  return <section className="panel"><span className="eyebrow">SEPARATE APP / REAL CONTROLS</span><h2>Standalone chat</h2><p>{error || (ready ? 'Connected. Run the edited scenario against this app.' : 'Waiting for the app. Start npm run dev:example in another terminal.')}</p><p className="hint">A fresh embedded instance runs here. Your other chat tab is independent.</p>{url && <><a href={url.replace('?timeline', '')} target="_blank" rel="noreferrer">Open standalone app</a><iframe ref={frame} title="Standalone chat under test" src={url} className="external-chat" onLoad={() => { setReady(false); if (pending.current) fail('Standalone app reloaded during the run.'); post({ channel: 'agent-timeline', type: 'hello' }); }}/></>}</section>;
});
