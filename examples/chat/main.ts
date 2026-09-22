import { createTimelineProvider } from '../../client/provider';
import type { Scenario } from '../../shared/engine';
import './style.css';
import { connectWorkbench } from './workbench-bridge';
let workbenchScenario: Scenario | null = null;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = el<HTMLFormElement>('chat'), prompt = el<HTMLTextAreaElement>('prompt');
const mode = el<HTMLSelectElement>('mode'), send = el<HTMLButtonElement>('send'), cancel = el<HTMLButtonElement>('cancel');
const retry = el<HTMLButtonElement>('retry');
let retrying = false;
retry.addEventListener('click', () => { retrying = true; form.requestSubmit(); });
const status = el('status'), response = el('response'), events = el('events');
const provider = createTimelineProvider({ endpoint: '/timeline/api/generate' });
let active: string | null = null, epoch = 0, transport: AbortController | null = null;
const ready = () => { send.disabled = false; mode.disabled = false; prompt.disabled = false; cancel.disabled = true; };
const reset = () => { retry.disabled = true; retrying = false; epoch++; transport?.abort(); active = null; response.textContent = ''; events.textContent = 'No request yet.'; status.textContent = 'Ready'; ready(); };
el('reset').addEventListener('click', reset);
cancel.addEventListener('click', () => {
  active = null; cancel.disabled = true; status.textContent = 'Cancelled';
  events.textContent += 'Cancel requested (transport remains open)\n';
});
form.addEventListener('submit', async event => {
  event.preventDefault(); if (send.disabled || !prompt.value.trim()) return;
  const run = ++epoch, requestId = crypto.randomUUID(), fixed = mode.value === 'fixed';
  const controller = new AbortController(); transport = controller; active = requestId;
  send.disabled = mode.disabled = prompt.disabled = true; cancel.disabled = false;
  // Buggy mode deliberately appends a retry to the abandoned partial response.
  if (!retrying || fixed) response.textContent = '';
  events.textContent = ''; status.textContent = 'Connecting'; retry.disabled = true; retrying = false;
  const scenario: Scenario = workbenchScenario ?? {
    version: 1, id: 'example-chat-cancel', prompt: prompt.value.trim(), cancelAtMs: 700, observeUntilMs: 1800,
    events: [{ atMs: 100, type: 'text', text: 'A possible title is ' }, { atMs: 1100, type: 'text', text: 'Weekend Atlas' }, { atMs: 1300, type: 'complete' }],
    assertion: { type: 'textAbsentAfterCancel', text: 'Weekend Atlas' },
  };
  try {
    for await (const item of provider.generate({ requestId, scenario, signal: controller.signal })) {
      if (run !== epoch) continue;
      if (item.type === 'start') { events.textContent += 'Provider connected\n'; continue; }
      const stale = active !== requestId;
      events.textContent += `${item.atMs}ms · ${item.type}${stale ? fixed ? ' · late, ignored' : ' · late, accepted' : ''}\n`;
      if (fixed && stale) continue;
      if (item.type === 'text') { response.textContent += item.text; status.textContent = 'Streaming'; }
      if (item.type === 'error') status.textContent = `Error: ${item.message}`;
      if (item.type === 'complete') status.textContent = 'Completed';
    }
    if (run === epoch) events.textContent += 'Stream ended\n';
  } catch (error) {
    if (run === epoch && !controller.signal.aborted) { status.textContent = `Connection error: ${error instanceof Error ? error.message : String(error)}`; retry.disabled = false; }
  } finally { if (run === epoch) { active = null; ready(); } }
});
window.addEventListener('pagehide', () => transport?.abort());

connectWorkbench(scenario => { workbenchScenario = scenario; });
