import type { Scenario } from './engine';
export interface HostObservation { atMs: number; kind: 'cancel' | 'arrival'; label: string }
export interface HostResult {
  kind: 'pass' | 'fail' | 'error'; message: string; eventIndex: number | null;
  observations: HostObservation[]; log: string;
}
export interface HostProgress { elapsedMs: number; observations: HostObservation[]; log: string }
export type HostCommand =
  | { channel: 'agent-timeline'; type: 'run'; id: string; scenario: Scenario; mode: 'fixed' | 'buggy' }
  | { channel: 'agent-timeline'; type: 'reset' }
  | { channel: 'agent-timeline'; type: 'hello' };
export type HostReply =
  | { channel: 'agent-timeline'; type: 'ready' }
  | { channel: 'agent-timeline'; type: 'progress'; id: string; progress: HostProgress }
  | { channel: 'agent-timeline'; type: 'result'; id: string; result: HostResult };
