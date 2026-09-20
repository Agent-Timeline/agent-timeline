import type { ProviderEvent, Scenario } from '../shared/engine';

export type StreamEvent = { type: 'start'; requestId: string } | (ProviderEvent & { requestId: string });
export interface ProviderConnection {
  /** Full endpoint URL in Node; a same-origin URL also works in browsers. */
  endpoint: string;
  fetch?: typeof globalThis.fetch;
}
export interface GenerateRequest {
  requestId?: string;
  scenario?: Scenario;
  signal?: AbortSignal;
}

/** Connects to Agent Timeline's NDJSON development provider, not a live model API. */
export function createTimelineProvider(connection: ProviderConnection) {
  const fetcher = connection.fetch ?? globalThis.fetch;
  return {
    async *generate(input: GenerateRequest = {}): AsyncGenerator<StreamEvent> {
      const requestId = input.requestId ?? crypto.randomUUID();
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(requestId)) throw new Error('Invalid request ID');
      const controller = new AbortController();
      const abort = () => controller.abort(input.signal?.reason);
      input.signal?.addEventListener('abort', abort, { once: true });
      if (input.signal?.aborted) abort();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const response = await fetcher(connection.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, scenario: input.scenario }), signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Timeline provider returned HTTP ${response.status}`);
        if (!response.body || !response.headers.get('content-type')?.includes('application/x-ndjson'))
          throw new Error('Timeline provider must return an NDJSON stream');
        reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8', { fatal: true });
        let buffer = '', started = false, terminal = false, lastTime = -1;
        const parse = (line: string): StreamEvent => {
          const event = JSON.parse(line);
          if (!event || typeof event !== 'object' || event.requestId !== requestId) throw new Error('Mismatched provider request ID');
          if (terminal) throw new Error('Provider event received after termination');
          if (event.type === 'start') {
            if (started) throw new Error('Duplicate provider start');
            started = true;
          } else {
            if (!started) throw new Error('Provider event received before start');
            if (!Number.isInteger(event.atMs) || event.atMs < lastTime || event.atMs < 0 || event.atMs > 60000)
              throw new Error('Invalid provider event timing');
            lastTime = event.atMs;
            if (event.eventId !== undefined && (typeof event.eventId !== 'string' || !event.eventId.trim()))
              throw new Error('Invalid provider event ID');
            if (event.type === 'text') {
              if (typeof event.text !== 'string' || !event.text.trim()) throw new Error('Invalid provider text');
            } else if (event.type === 'error') {
              if (typeof event.message !== 'string' || !event.message.trim()) throw new Error('Invalid provider error');
              terminal = true;
            } else if (event.type === 'complete') terminal = true;
            else throw new Error('Unsupported provider event');
          }
          return event as StreamEvent;
        };
        while (true) {
          const { value, done } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          let newline: number;
          while ((newline = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
            if (line.length > 262144) throw new Error('Provider event too large');
            if (line.trim()) yield parse(line);
          }
          if (buffer.length > 262144) throw new Error('Provider event too large');
          if (done) break;
        }
        if (buffer.trim()) yield parse(buffer);
        if (!started || !terminal) throw new Error('Provider stream ended before termination');
      } finally {
        controller.abort();
        input.signal?.removeEventListener('abort', abort);
        try { await reader?.cancel(); } catch { /* The stream may already be aborted. */ }
        reader?.releaseLock();
      }
    },
  };
}
