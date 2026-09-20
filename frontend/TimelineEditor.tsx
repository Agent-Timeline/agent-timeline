import React from 'react';
import type { Scenario, ProviderEvent } from '../shared/engine';
export function TimelineEditor({ scenario, onChange, disabled, failedEvent }: {
  scenario: Scenario; onChange: (s: Scenario) => void; disabled: boolean; failedEvent: number | null;
}) {
  const update = (index: number, event: ProviderEvent) => onChange({ ...scenario, events: scenario.events.map((old, i) => i === index ? event : old) });
  const add = () => {
    const events = [...scenario.events];
    const terminal = events.findIndex(e => e.type !== 'text');
    const index = terminal < 0 ? events.length : terminal;
    const atMs = terminal < 0 ? (events.at(-1)?.atMs ?? 0) : events[terminal].atMs;
    events.splice(index, 0, { atMs, type: 'text', text: 'New response chunk' });
    onChange({ ...scenario, events });
  };
  const marks = [...scenario.events.map((e, i) => ({ atMs: e.atMs, label: e.type, index: i })), { atMs: scenario.cancelAtMs, label: 'cancel requested', index: -1 }];
  return <section className="panel editor"><div className="section-heading"><div><span className="eyebrow">SCENARIO</span><h2>Shape the sequence</h2></div><span className="badge">{scenario.events.length} provider events</span></div>
    <div className="ruler" aria-label="Event timeline">{marks.map(m => <div key={m.index} className={`marker ${m.index === -1 ? 'cancel-marker' : ''} ${failedEvent === m.index ? 'failed-marker' : ''}`} style={{ left: `${Math.max(0, Math.min(100, m.atMs / Math.max(1, scenario.observeUntilMs) * 100))}%` }} title={`${m.atMs}ms: ${m.label}`}><span>{m.label}</span></div>)}</div>
    <div className="ruler-labels"><span>0 ms</span><span>{scenario.observeUntilMs} ms</span></div>
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
