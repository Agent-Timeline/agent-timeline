import { test, expect } from '@playwright/test';
import { createTimelineProvider } from '../client/provider';
import type { Scenario } from '../shared/engine';
const scenario: Scenario = { version: 1, id: 'connection-test', prompt: 'Synthetic prompt', cancelAtMs: 0, observeUntilMs: 1000, events: [{ atMs: 20, type: 'text', text: 'Connected' }, { atMs: 40, type: 'complete' }], assertion: { type: 'textAbsentAfterCancel', text: 'unused' } };
test('a Node host connects to the provider with independent concurrent scenarios', async ({ baseURL }) => {
  const provider = createTimelineProvider({ endpoint: `${baseURL}/api/generate` });
  const run = async (requestId: string, content: string) => {
    const events = [];
    for await (const event of provider.generate({ requestId, scenario: { ...scenario, events: [{ atMs: 20, type: 'text', text: content }, { atMs: 40, type: 'complete' }] } })) events.push(event);
    expect(events.every(e => e.requestId === requestId)).toBeTruthy();
    expect(events.map(e => e.type)).toEqual(['start', 'text', 'complete']);
    expect(events[1]).toMatchObject({ text: content });
  };
  await Promise.all([run('request-a', 'First'), run('request-b', 'Second')]);
});
test('caller abort stops a pending provider stream', async ({ baseURL }) => {
  const provider = createTimelineProvider({ endpoint: `${baseURL}/api/generate` });
  const controller = new AbortController();
  const events: string[] = [];
  await expect(async () => {
    for await (const event of provider.generate({ signal: controller.signal, scenario: { ...scenario, events: [{ atMs: 800, type: 'complete' }] } })) {
      events.push(event.type); controller.abort();
    }
  }).rejects.toThrow();
  expect(events).toEqual(['start']);
});
