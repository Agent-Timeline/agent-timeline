import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseScenario, replay } from '../shared/engine.js';
const fixture = JSON.parse(readFileSync(new URL('../scenarios/cancel-late-result.json', import.meta.url), 'utf8'));
test('validates supported scenarios and rejects malformed timing, events and assertions', () => {
  assert.equal(parseScenario(fixture).id, 'cancel-late-result');
  for (const bad of [ { ...fixture, events: [{ atMs: -1, type: 'complete' }] }, { ...fixture, events: [{ atMs: 0, type: 'unknown' }] }, { ...fixture, events: [{ atMs: 0, type: 'complete' }, { atMs: 1, type: 'text', text: 'late' }] }, { ...fixture, assertion: { type: 'unknown' } }, { ...fixture, observeUntilMs: 1200 } ]) assert.throws(() => parseScenario(bad));
});
test('preserves equal-time event ordering', async () => {
  const seen: string[] = [];
  await replay([{ atMs: 0, type: 'text', text: 'a' }, { atMs: 0, type: 'complete' }], e => seen.push(e.type), new AbortController().signal);
  assert.deepEqual(seen, ['text', 'complete']);
});
test('abort stops pending delivery and independent replays start cleanly', async () => {
  const controller = new AbortController(); const seen: string[] = [];
  const run = replay([{ atMs: 0, type: 'text', text: 'a' }, { atMs: 50, type: 'complete' }], e => { seen.push(e.type); controller.abort(); }, controller.signal);
  await run; assert.deepEqual(seen, ['text']);
  await replay([{ atMs: 0, type: 'complete' }], e => seen.push(e.type), new AbortController().signal);
  assert.deepEqual(seen, ['text', 'complete']);
});
