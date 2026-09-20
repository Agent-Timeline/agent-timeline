import React from 'react';
import type { Scenario, ProviderEvent } from '../shared/engine';
export function TimelineEditor({ scenario, onChange, disabled, failedEvent, elapsedMs, running, started, receivedCount, cancelled, onRun, onStop, canRun }: {
  onRun: () => void; onStop: () => void; canRun: boolean;
  scenario: Scenario; onChange: (s: Scenario) => void; disabled: boolean; failedEvent: number | null; elapsedMs: number; running: boolean; started: boolean; receivedCount: number; cancelled: boolean;
}) {
  const [zoom, setZoom] = React.useState(1);
  const duration = Math.max(1, scenario.observeUntilMs);
  const roughStep = duration / (5 * zoom);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const tickStep = Math.max(1, ([1, 2, 5, 10].find(n => n * magnitude >= roughStep) ?? 10) * magnitude);
  const ticks = Array.from({ length: Math.floor(duration / tickStep) + 1 }, (_, i) => Math.round(i * tickStep));
  const update = (index: number, event: ProviderEvent) => onChange({ ...scenario, events: scenario.events.map((old, i) => i === index ? event : old) });
  const drag = React.useRef<{ pointerId: number; index: number; startX: number; startTime: number; width: number } | null>(null);
  const bounds = (index: number) => index === -1
    ? [0, Math.max(0, scenario.observeUntilMs - 1)]
    : [scenario.events[index - 1]?.atMs ?? 0, scenario.events[index + 1]?.atMs ?? scenario.observeUntilMs];
  const move = (index: number, time: number) => {
    if (disabled) return;
    const [min, max] = bounds(index);
    const atMs = Math.max(min, Math.min(max, Math.round(time)));
    if (index === -1) onChange({ ...scenario, cancelAtMs: atMs });
    else update(index, { ...scenario.events[index], atMs });
  };
  const add = () => {
    const events = [...scenario.events];
    const terminal = events.findIndex(e => e.type !== 'text');
    const index = terminal < 0 ? events.length : terminal;
    const atMs = terminal < 0 ? (events.at(-1)?.atMs ?? 0) : events[terminal].atMs;
    events.splice(index, 0, { atMs, type: 'text', text: 'New response chunk' });
    onChange({ ...scenario, events });
  };
  const marks = [...scenario.events.map((e, i) => ({ atMs: e.atMs, label: e.type, index: i })), { atMs: scenario.cancelAtMs, label: 'cancel requested', index: -1 }];
  // Left-to-right events stack top-to-bottom. Labels extend right so a
  // connector never travels through another label; equal times share a trunk.
  const ordered = [...marks].sort((a, b) => a.atMs - b.atMs || a.index - b.index);
  const rowByIndex = new Map(ordered.map((mark, row) => [mark.index, row]));
  const stackHeight = Math.max(224, marks.length * 56 + 24);
  return <section className="panel editor"><div className="section-heading"><div><span className="eyebrow">SCENARIO</span><h2>Shape the sequence</h2></div><div className="scenario-heading-actions"><span className="badge">{scenario.events.length} provider events</span><button type="button" className={`scenario-play ${running ? 'is-running' : ''}`} aria-label={running ? 'Stop scenario test' : 'Play scenario'} title={running ? 'Stop test' : 'Run scenario'} disabled={!running && !canRun} onClick={running ? onStop : onRun}><svg className="play-symbol" aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><svg className="stop-symbol" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg></button></div></div>
    <p className="replay-status" data-testid="replay-status">{running ? started ? 'Replaying' : 'Waiting for provider' : started ? 'Replay stopped' : 'Ready to replay'} · <span data-testid="elapsed-time">{elapsedMs}</span> ms · {receivedCount}/{scenario.events.length} events received{cancelled ? ' · Cancel requested' : ''}</p><div className="timeline-zoom" aria-label="Timeline zoom"><button type="button" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value / 2))}>Zoom out</button><span>{zoom}×</span><button type="button" disabled={zoom >= 16} onClick={() => setZoom(value => Math.min(16, value * 2))}>Zoom in</button><button type="button" onClick={() => setZoom(1)}>Fit timeline</button></div><div className="timeline-stack-scroll" tabIndex={0} aria-label="Scrollable event labels"><div className="ruler stacked-ruler" aria-label="Event timeline" style={{ height: stackHeight, width: `calc(${zoom * 100}% - 152px)` }}>{started && <div className="playhead" data-testid="playhead" style={{ left: `${Math.min(100, elapsedMs / Math.max(1, scenario.observeUntilMs) * 100)}%` }} aria-hidden="true"/>}{marks.map(m => <div key={m.index} role="slider" tabIndex={disabled ? -1 : 0} aria-label={m.index === -1 ? 'Cancellation time' : `Event ${m.index + 1} timeline time`} aria-valuemin={bounds(m.index)[0]} aria-valuemax={bounds(m.index)[1]} aria-valuenow={m.atMs} aria-valuetext={`${m.atMs} milliseconds`} aria-disabled={disabled}
      onPointerDown={e => { if (disabled || e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { pointerId: e.pointerId, index: m.index, startX: e.clientX, startTime: m.atMs, width: e.currentTarget.parentElement!.getBoundingClientRect().width }; }}
      onPointerMove={e => { const d = drag.current; if (d && d.pointerId === e.pointerId && d.index === m.index) move(m.index, d.startTime + (e.clientX - d.startX) / Math.max(1, d.width) * scenario.observeUntilMs); }}
      onPointerUp={e => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={e => { const step = e.shiftKey ? 10 : 1; const values: Record<string, number> = { ArrowLeft: m.atMs - step, ArrowDown: m.atMs - step, ArrowRight: m.atMs + step, ArrowUp: m.atMs + step, Home: bounds(m.index)[0], End: bounds(m.index)[1] }; if (e.key in values) { e.preventDefault(); move(m.index, values[e.key]); } }} data-testid={`marker-${m.index}`} data-received={m.index === -1 ? cancelled : m.index < receivedCount} className={`marker ${m.index === -1 ? 'cancel-marker' : ''} ${failedEvent === m.index ? 'failed-marker' : ''} ${(m.index === -1 ? cancelled : m.index < receivedCount) ? 'received-marker' : ''}`} style={{ left: `${Math.max(0, Math.min(100, m.atMs / Math.max(1, scenario.observeUntilMs) * 100))}%`, '--label-rise': `${stackHeight - (rowByIndex.get(m.index) ?? 0) * 56 - 44}px` } as React.CSSProperties} title={`${m.atMs}ms: ${m.label}`}><i className="marker-connector" aria-hidden="true"/><span className="stacked-label">{m.label}{(m.index === -1 ? cancelled : m.index < receivedCount) ? ' ✓' : ''}<small className="marker-time">{m.atMs} ms</small></span></div>)}<div className="time-axis" aria-label="Time ruler">{ticks.map(time => <span className="time-tick" key={time} style={{left:`${time / duration * 100}%`}}><small>{time.toLocaleString('en-US')} ms</small></span>)}</div></div></div>
    <p className="hint">Scroll horizontally when zoomed to inspect another time range. Duration: {scenario.observeUntilMs.toLocaleString('en-US')} ms.</p>
    <fieldset disabled={disabled}><div className="fields"><label>Scenario ID<input value={scenario.id} onChange={e => onChange({ ...scenario, id: e.target.value })}/></label><label>Cancel at (ms)<input type="number" min="0" max="60000" value={scenario.cancelAtMs} onChange={e => onChange({ ...scenario, cancelAtMs: Number(e.target.value) })}/></label><label>Observe until (ms)<input type="number" min="1" max="60000" value={scenario.observeUntilMs} onChange={e => onChange({ ...scenario, observeUntilMs: Number(e.target.value) })}/></label></div>
    <label>Prompt<input value={scenario.prompt} onChange={e => onChange({ ...scenario, prompt: e.target.value })}/></label>
    <div className="event-heading"><h3>Provider events</h3><button type="button" onClick={add}>+ Add event</button></div>
    <div className="event-list">{scenario.events.map((event, i) => <div key={i} className={`event-row ${failedEvent === i ? 'event-failed' : ''}`} data-testid={`event-${i}`}>
      <label>Time (ms)<input aria-label={`Event ${i + 1} time`} type="number" min="0" max="60000" value={event.atMs} onChange={e => update(i, { ...event, atMs: Number(e.target.value) })}/></label>
      <label>Type<select aria-label={`Event ${i + 1} type`} value={event.type} onChange={e => { const type = e.target.value; update(i, type === 'text' ? { atMs: event.atMs, type, text: 'Response chunk' } : type === 'error' ? { atMs: event.atMs, type, message: 'Provider unavailable' } : { atMs: event.atMs, type: 'complete' }); }}><option value="text">Text chunk</option><option value="complete">Complete</option><option value="error">Error</option></select></label>
      {event.type === 'text' ? <label>Text<input aria-label={`Event ${i + 1} text`} value={event.text} onChange={e => update(i, { ...event, text: e.target.value })}/></label> : event.type === 'error' ? <label>Message<input aria-label={`Event ${i + 1} message`} value={event.message} onChange={e => update(i, { ...event, message: e.target.value })}/></label> : <span className="terminal-note">Ends the response stream</span>}
      <button type="button" className="remove" aria-label={`Remove event ${i + 1}`} onClick={() => onChange({ ...scenario, events: scenario.events.filter((_, index) => index !== i) })}>Remove</button>
    </div>)}</div><button type="button" className="subtle" onClick={() => onChange({ ...scenario, events: [...scenario.events].sort((a, b) => a.atMs - b.atMs) })}>Sort events by time</button>
    <label className="assertion-field">Text that must stay absent after cancellation<input value={scenario.assertion.text} onChange={e => onChange({ ...scenario, assertion: { ...scenario.assertion, text: e.target.value } })}/></label></fieldset>
  </section>;
}
