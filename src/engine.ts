export type ProviderEvent = { atMs: number; eventId?: string } & (
  { type: 'text'; text: string } | { type: 'complete' } | { type: 'error'; message: string }
);
export interface Scenario {
  version: 1; id: string; prompt: string; cancelAtMs: number; observeUntilMs: number;
  events: ProviderEvent[];
  assertion: { type: 'textAbsentAfterCancel'; text: string };
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const time = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 60000;
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
export function parseScenario(input: unknown): Scenario {
  if (!object(input) || input.version !== 1 || !nonempty(input.id) || !nonempty(input.prompt) ||
    !time(input.cancelAtMs) || !time(input.observeUntilMs) || input.observeUntilMs <= input.cancelAtMs ||
    !Array.isArray(input.events) || input.events.length === 0 || input.events.length > 1000 ||
    !object(input.assertion) || input.assertion.type !== 'textAbsentAfterCancel' || !nonempty(input.assertion.text)) {
    throw new Error('Invalid scenario metadata or assertion');
  }
  let last = -1, terminal = false;
  for (const event of input.events) {
    if (!object(event) || !time(event.atMs) || event.atMs < last || event.atMs > input.observeUntilMs || terminal)
      throw new Error('Events must be ordered, inside the observation window, and precede termination');
    if (event.eventId !== undefined && !nonempty(event.eventId)) throw new Error('Event ID must be a nonempty string');
    if (event.type === 'text') {
      if (!nonempty(event.text)) throw new Error('Text event needs text');
    } else if (event.type === 'error') {
      if (!nonempty(event.message)) throw new Error('Error event needs a message');
      terminal = true;
    } else if (event.type === 'complete') terminal = true;
    else throw new Error('Unsupported provider event');
    last = event.atMs;
  }
  if (!terminal) throw new Error('Scenario must end with complete or error');
  return input as unknown as Scenario;
}
// Times are offsets from receipt of the provider request. Equal offsets retain file order.
export async function replay(events: ProviderEvent[], emit: (event: ProviderEvent) => void, signal: AbortSignal): Promise<void> {
  const started = performance.now();
  for (const event of events) {
    if (signal.aborted) return;
    const delay = Math.max(0, event.atMs - (performance.now() - started));
    if (delay > 0) await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
      const timer = setTimeout(finish, delay);
      signal.addEventListener('abort', finish, { once: true });
    });
    if (signal.aborted) return;
    emit(event);
  }
}
