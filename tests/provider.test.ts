import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimelineProvider } from '../client/provider';
const start = { type: 'start', requestId: 'test' };
const complete = { type: 'complete', requestId: 'test', atMs: 2 };
const text = { type: 'text', requestId: 'test', atMs: 1, text: 'Hello 🌍', eventId: 'chunk' };
function provider(events: unknown[], status = 200) {
  const bytes = new TextEncoder().encode(events.map(e => JSON.stringify(e)).join('\n'));
  const fetcher: typeof fetch = async () => new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } }), { status, headers: { 'content-type': 'application/x-ndjson' } });
  return createTimelineProvider({ endpoint: 'http://localhost/api/generate', fetch: fetcher });
}
async function collect(p: ReturnType<typeof createTimelineProvider>) {
  const events = []; for await (const event of p.generate({ requestId: 'test' })) events.push(event); return events;
}
test('reassembles fragmented UTF-8, preserves duplicate IDs and accepts a final line without newline', async () => {
  assert.deepEqual(await collect(provider([start, text, text, complete])), [start, text, text, complete]);
});
test('delivers scripted errors as terminal events for app handling', async () => {
  const error = { type: 'error', requestId: 'test', atMs: 2, message: 'Unavailable' };
  assert.deepEqual(await collect(provider([start, text, error])), [start, text, error]);
});
test('rejects HTTP failures and malformed or incomplete streams', async () => {
  await assert.rejects(collect(provider([], 400)), /HTTP 400/);
  for (const events of [[text, complete], [start, text], [start, start, complete], [start, { ...text, requestId: 'wrong' }, complete], [start, complete, text], [start, { ...text, atMs: -1 }, complete]]) {
    await assert.rejects(collect(provider(events)));
  }
});
test('breaking iteration aborts the transport', async () => {
  let signal: AbortSignal | undefined;
  const p = createTimelineProvider({ endpoint: '/api/generate', fetch: async (_url, init) => {
    signal = init?.signal as AbortSignal;
    return new Response(JSON.stringify(start) + '\n' + JSON.stringify(complete), { headers: { 'content-type': 'application/x-ndjson' } });
  } });
  for await (const _event of p.generate({ requestId: 'test' })) break;
  assert.equal(signal?.aborted, true);
});
