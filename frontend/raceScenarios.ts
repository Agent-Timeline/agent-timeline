import type { ProviderEvent } from '../shared/engine';
export type Action = 'first' | 'second' | 'cancel' | 'leave' | 'return' | 'delete' | 'change' | 'disconnect' | 'reconnect';
export interface RaceScenario {
  id: string; title: string; goal: string;
  requests: ProviderEvent[][];
  actions: { atMs: number; action: Action }[];
  expected: string; forbidden: string[];
  observeUntilMs?: number;
  expectedDelivered?: number;
  expectedStatus?: string;
  checkpoint?: { atMs: number; text: string; status: string };
}
const response = (text: string, atMs: number): ProviderEvent[] => [{ atMs, type: 'text', text }, { atMs: atMs + 100, type: 'complete' }];
export const raceScenarios: RaceScenario[] = [
  { id: 'connection-recovery', title: 'Connection loss and recovery', goal: 'Simulate a dropped stream, preserve partial text while disconnected, then retry without duplicate output. This is not browser-wide offline mode.', requests: [[{atMs:100,type:'text',text:'Draft'}, {atMs:1400,type:'text',text:' abandoned'}, {atMs:1500,type:'complete'}], response('Draft recovered',200)], actions:[{atMs:0,action:'first'},{atMs:400,action:'disconnect'},{atMs:900,action:'reconnect'},{atMs:1000,action:'second'}], checkpoint:{atMs:700,text:'Draft',status:'Disconnected'}, expected:'Draft recovered', forbidden:['DraftDraft','abandoned'], expectedDelivered:3, expectedStatus:'Completed' },
  { id: 'out-of-order', title: 'Requests finish out of order', goal: 'The older response must never overwrite or mix into the newest result.', requests: [response('OLD RESULT', 1000), response('Newest result', 200)], actions: [{ atMs: 0, action: 'first' }, { atMs: 200, action: 'second' }], expected: 'Newest result', forbidden: ['OLD RESULT'] },
  { id: 'cancel-retry', title: 'Cancel then retry', goal: 'Chunks from the cancelled request must not mix into the retry.', requests: [response('CANCELLED RESULT', 1000), response('Retry result', 200)], actions: [{ atMs: 0, action: 'first' }, { atMs: 200, action: 'cancel' }, { atMs: 300, action: 'second' }], expected: 'Retry result', forbidden: ['CANCELLED RESULT'] },
  { id: 'partial-error', title: 'Stream fails halfway through', goal: 'Retain partial content, leave loading state, and successfully retry.', requests: [[{ atMs: 100, type: 'text', text: 'Partial draft' }, { atMs: 250, type: 'error', message: 'Connection lost' }], response('Recovered draft', 200)], actions: [{ atMs: 0, action: 'first' }, { atMs: 900, action: 'second' }], checkpoint: { atMs: 700, text: 'Partial draft', status: 'Error: Connection lost' }, expected: 'Recovered draft', forbidden: [] },
  { id: 'navigation', title: 'Navigate away and return', goal: 'Leaving the editor invalidates pending results, including after returning.', requests: [response('WRONG SCREEN RESULT', 1000)], actions: [{ atMs: 0, action: 'first' }, { atMs: 200, action: 'leave' }, { atMs: 500, action: 'return' }], expected: '', forbidden: ['WRONG SCREEN RESULT'] },
  { id: 'delete-item', title: 'Delete during generation', goal: 'A late result must not recreate a deleted item.', requests: [response('DELETED ITEM RESULT', 1000)], actions: [{ atMs: 0, action: 'first' }, { atMs: 200, action: 'delete' }], expected: '', forbidden: ['DELETED ITEM RESULT'] },
  { id: 'change-inputs', title: 'Change inputs during generation', goal: 'A result based on the previous input must not apply to the new input.', requests: [response('OLD INPUT RESULT', 1000)], actions: [{ atMs: 0, action: 'first' }, { atMs: 200, action: 'change' }], expected: '', forbidden: ['OLD INPUT RESULT'] },
  { id: 'duplicate', title: 'Duplicate delivery', goal: 'The same event ID arriving twice must append content only once.', requests: [[{ atMs: 100, type: 'text', text: 'One result', eventId: 'chunk-1' }, { atMs: 400, type: 'text', text: 'One result', eventId: 'chunk-1' }, { atMs: 600, type: 'complete' }]], actions: [{ atMs: 0, action: 'first' }], expected: 'One result', forbidden: ['One resultOne result'] },
];
