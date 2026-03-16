import type { TokenUsage } from '../../types/llm';

/** AgentCard state machine — matches 03-meeting-flow.md §5 */
export type AgentState =
  | { type: 'idle' }
  | { type: 'selected' }
  | { type: 'streaming'; buffer: string; seq: number }
  | { type: 'done'; content: string; usage: TokenUsage; durationMs: number }
  | { type: 'error'; message: string; retryable: boolean; attempt: number }
  | { type: 'retrying'; attempt: number };

/** Agent event for reducer */
export type AgentEvent =
  | { type: 'MEETING_STARTED' }
  | { type: 'STREAM_START' }
  | { type: 'CHUNK'; text: string; seq: number }
  | { type: 'DONE'; content: string; usage: TokenUsage; durationMs: number }
  | { type: 'ERROR'; message: string; retryable: boolean }
  | { type: 'RETRY' }
  | { type: 'CANCEL' };

/** Agent state machine reducer */
export function agentReducer(state: AgentState, event: AgentEvent): AgentState {
  switch (state.type) {
    case 'idle':
      if (event.type === 'MEETING_STARTED') return { type: 'selected' };
      break;
    case 'selected':
      if (event.type === 'STREAM_START') return { type: 'streaming', buffer: '', seq: 0 };
      if (event.type === 'CHUNK') return { type: 'streaming', buffer: event.text, seq: event.seq };
      if (event.type === 'DONE') return { type: 'done', content: event.content, usage: event.usage, durationMs: event.durationMs };
      if (event.type === 'ERROR') return { type: 'error', message: event.message, retryable: event.retryable, attempt: 1 };
      if (event.type === 'CANCEL') return { type: 'idle' };
      break;
    case 'streaming':
      if (event.type === 'CHUNK') return { ...state, buffer: state.buffer + event.text, seq: event.seq };
      if (event.type === 'DONE') return { type: 'done', content: event.content, usage: event.usage, durationMs: event.durationMs };
      if (event.type === 'ERROR') return { type: 'error', message: event.message, retryable: event.retryable, attempt: 1 };
      if (event.type === 'CANCEL') return { type: 'idle' };
      break;
    case 'error':
      if (event.type === 'RETRY' && state.retryable) return { type: 'retrying', attempt: state.attempt };
      if (event.type === 'CANCEL') return { type: 'idle' };
      break;
    case 'retrying':
      if (event.type === 'STREAM_START') return { type: 'streaming', buffer: '', seq: 0 };
      if (event.type === 'CHUNK') return { type: 'streaming', buffer: event.text, seq: event.seq };
      if (event.type === 'DONE') return { type: 'done', content: event.content, usage: event.usage, durationMs: event.durationMs };
      if (event.type === 'ERROR') return { type: 'error', message: event.message, retryable: event.retryable, attempt: state.attempt + 1 };
      if (event.type === 'CANCEL') return { type: 'idle' };
      break;
    case 'done':
      // Terminal state — no transitions
      break;
  }
  return state; // Invalid transition → ignore
}

/** Meeting-level state */
export interface MeetingState {
  meetingId: string | null;
  topic: string;
  mode: 'quick' | 'deep';
  participants: string[];
  agents: Record<string, AgentState>;
  phase: 'idle' | 'running' | 'done' | 'cancelled';
  doneCount: number;
  totalCount: number;
  summary: import('../../types/messages').MeetingSummary | null;
}
