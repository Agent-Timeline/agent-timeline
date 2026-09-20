import { parseScenario, type Scenario } from '../../shared/engine';
import type { HostObservation, HostReply, HostResult } from '../../shared/host-run';

/** Opt-in adapter for this example's controls, log, and response element. */
export function connectWorkbench(setScenario: (scenario: Scenario | null) => void) {
  if (window.parent === window || !new URLSearchParams(location.search).has('timeline')) return;
  const trustedOrigins = new Set(['http://127.0.0.1:4317', 'http://127.0.0.1:4417']);
  let dispose = () => {};
  const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
  const reset = () => { dispose(); dispose = () => {}; setScenario(null); button('reset').click(); };
  window.addEventListener('message', event => {
    if (event.source !== window.parent || !trustedOrigins.has(event.origin) || event.data?.channel !== 'agent-timeline') return;
    const reply = (message: HostReply) => window.parent.postMessage(message, event.origin);
    const command = event.data;
    if (command.type === 'hello') { reply({ channel: 'agent-timeline', type: 'ready' }); return; }
    if (command.type === 'reset') { reset(); return; }
    if (command.type !== 'run' || typeof command.id !== 'string') return;
    reset();
    let scenario: Scenario;
    try { scenario = parseScenario(command.scenario); if (!['fixed', 'buggy'].includes(command.mode)) throw new Error('Invalid mode'); }
    catch { reply({ channel: 'agent-timeline', type: 'result', id: command.id, result: { kind: 'error', message: 'Invalid scenario or behavior.', eventIndex: null, observations: [], log: '' } }); return; }
    setScenario(structuredClone(scenario));
    (document.getElementById('mode') as HTMLSelectElement).value = command.mode;
    (document.getElementById('prompt') as HTMLTextAreaElement).value = scenario.prompt;
    const output = document.getElementById('response')!, log = document.getElementById('events')!;
    const cancel = button('cancel');
    const submitted = performance.now();
    const observations: HostObservation[] = [];
    let connected = false, cancelled = false, delivered = 0, lastIndex: number | null = null;
    let violation: { elapsed: number; index: number | null } | null = null;
    let seenLines = 0, finished = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const inspect = () => {
      if (cancelled && !violation && output.textContent?.includes(scenario.assertion.text)) violation = { elapsed: Math.round(performance.now() - submitted), index: lastIndex };
    };
    const onCancel = () => {
      if (cancelled) return;
      cancelled = true;
      observations.push({ atMs: Math.round(performance.now() - submitted), kind: 'cancel', label: 'Cancel requested' });
      inspect();
    };
    const finish = (override?: string) => {
      if (finished) return;
      finished = true; inspect();
      const incomplete = !connected || !cancelled || delivered !== scenario.events.length || !log.textContent?.includes('Stream ended');
      const error = override || (incomplete ? 'Incomplete run: cancellation or provider delivery was not observed.' : '');
      const result: HostResult = { kind: error ? 'error' : violation ? 'fail' : 'pass',
        message: error || (violation ? `Forbidden text appeared after cancellation at ${violation.elapsed}ms.` : `“${scenario.assertion.text}” stayed absent after cancellation through ${scenario.observeUntilMs}ms.`),
        eventIndex: violation?.index ?? null, observations, log: log.textContent || '' };
      dispose(); setScenario(null);
      reply({ channel: 'agent-timeline', type: 'result', id: command.id, result });
    };
    const observer = new MutationObserver(() => {
      const lines = (log.textContent || '').split('\n').filter(Boolean);
      for (const line of lines.slice(seenLines)) {
        if (line === 'Provider connected' && !connected) {
          connected = true;
          timers.push(setTimeout(() => {
            if (cancel.disabled) { finish('Cancel control was unavailable at the scheduled time.'); return; }
            cancel.click();
          }, scenario.cancelAtMs));
          timers.push(setTimeout(() => finish(), scenario.observeUntilMs));
        }
        if (/^\d+ms · (text|complete|error)/.test(line)) {
          lastIndex = delivered++;
          observations.push({ atMs: Math.round(performance.now() - submitted), kind: 'arrival', label: `${cancelled ? 'Late response received' : 'Response received'} · ${line}` });
        }
      }
      seenLines = lines.length;
      inspect();
    });
    // The real cancel handler and app reducer remain in charge of app state.
    cancel.addEventListener('click', onCancel);
    const onReset = () => finish('The chat was reset before verification finished.');
    button('reset').addEventListener('click', onReset);
    dispose = () => { observer.disconnect(); timers.forEach(clearTimeout); cancel.removeEventListener('click', onCancel); button('reset').removeEventListener('click', onReset); };
    observer.observe(document.querySelector('main')!, { subtree: true, childList: true, characterData: true });
    timers.push(setTimeout(() => { if (!connected) finish('Provider did not connect within 10 seconds.'); }, 10000));
    // Only the provider scenario is substituted; exercise the app's actual Send handler.
    button('send').click();
  });
}
