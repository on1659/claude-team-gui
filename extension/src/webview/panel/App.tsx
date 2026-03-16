import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useVscodeMessage } from '../shared/hooks/useVscodeMessage';
import { useChunkBuffer } from '../shared/hooks/useChunkBuffer';
import { MeetingHeader } from './MeetingHeader';
import { AgentGrid } from './AgentGrid';
import { OfficeView } from './OfficeView';
import { ChatLogPanel } from './ChatLogPanel';
import { ActionBar } from './ActionBar';
import { agentReducer } from './types';
import type { AgentState, MeetingState } from './types';
import type { HostMessage, TeamMemberView } from '../../types/messages';

const INITIAL_STATE: MeetingState = {
  meetingId: null,
  topic: '',
  mode: 'deep',
  participants: [],
  agents: {},
  phase: 'idle',
  doneCount: 0,
  totalCount: 0,
  summary: null,
};

/** Agent info for rendering (name, role) */
interface AgentInfo {
  id: string;
  name: string;
  roleLabel: string;
}

type ActionStatus = 'idle' | 'pending' | 'success' | 'failed';
type ViewMode = 'office' | 'card';

export function App(): React.ReactElement {
  const [meeting, setMeeting] = useState<MeetingState>(INITIAL_STATE);
  const [agentInfos, setAgentInfos] = useState<AgentInfo[]>([]);
  const lastSeqMap = useRef<Map<string, number>>(new Map());
  const [copyStatus, setCopyStatus] = useState<ActionStatus>('idle');
  const [saveStatus, setSaveStatus] = useState<ActionStatus>('idle');
  const [viewMode, setViewMode] = useState<ViewMode>('office');
  const [panelWidth, setPanelWidth] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  // Callback ref: attaches ResizeObserver when the DOM node appears
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (node && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          setPanelWidth(entry.contentRect.width);
        }
      });
      ro.observe(node);
      roRef.current = ro;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roRef.current) {
        roRef.current.disconnect();
        roRef.current = null;
      }
    };
  }, []);

  const showChatLog = panelWidth >= 500;

  // Dispatch agent event helper
  const dispatchAgent = useCallback((agentId: string, event: import('./types').AgentEvent) => {
    setMeeting(prev => {
      const currentState = prev.agents[agentId] ?? { type: 'idle' as const };
      const nextState = agentReducer(currentState, event);
      if (nextState === currentState) return prev;

      const newAgents = { ...prev.agents, [agentId]: nextState };

      // Count done agents
      let doneCount = 0;
      for (const s of Object.values(newAgents)) {
        if (s.type === 'done') doneCount++;
      }

      return { ...prev, agents: newAgents, doneCount };
    });
  }, []);

  // rAF chunk buffer — push queues chunks, flushAgent forces immediate dispatch
  const chunkBuffer = useChunkBuffer(
    useCallback((agentId: string, text: string, lastSeq: number) => {
      dispatchAgent(agentId, { type: 'CHUNK', text, seq: lastSeq });
    }, [dispatchAgent]),
  );

  const postMessage = useVscodeMessage(
    useCallback((msg: HostMessage) => {
      console.log(`[Panel] ← received: ${msg.type}`, 'agentId' in msg ? `agent=${(msg as any).agentId}` : '');

      switch (msg.type) {
        case 'teamData': {
          console.log(`[Panel] teamData — ${(msg.members as TeamMemberView[]).length} members`);
          // Store agent display info
          setAgentInfos((msg.members as TeamMemberView[]).map(m => ({
            id: m.id,
            name: m.name,
            roleLabel: m.roleLabel,
          })));
          break;
        }
        case 'meetingStarted': {
          console.log(`[Panel] meetingStarted — id=${msg.meetingId} participants=${msg.participants.join(',')} mode=${msg.mode}`);
          lastSeqMap.current.clear();
          const agents: Record<string, AgentState> = {};
          for (const id of msg.participants) {
            agents[id] = { type: 'selected' };
          }
          setCopyStatus('idle');
          setSaveStatus('idle');
          setMeeting({
            meetingId: msg.meetingId,
            topic: msg.topic,
            mode: msg.mode,
            participants: msg.participants,
            agents,
            phase: 'running',
            doneCount: 0,
            totalCount: msg.participants.length,
            summary: null,
          });
          break;
        }
        case 'agentStream': {
          // seq gap detection
          const lastSeq = lastSeqMap.current.get(msg.agentId) ?? -1;
          if (msg.seq > lastSeq + 1) {
            console.warn(`[Panel] seq gap! agent=${msg.agentId} expected=${lastSeq + 1} got=${msg.seq}`);
          }
          if (msg.seq <= 2 || msg.seq % 20 === 0) {
            console.log(`[Panel] agentStream agent=${msg.agentId} seq=${msg.seq} chunkLen=${msg.chunk.length}`);
          }
          lastSeqMap.current.set(msg.agentId, msg.seq);

          // Buffer chunk for rAF flush
          chunkBuffer.push(msg.agentId, msg.seq, msg.chunk);
          break;
        }
        case 'agentDone': {
          console.log(`[Panel] agentDone agent=${msg.agentId} contentLen=${msg.result.content.length} tokens=${msg.result.tokenUsage.inputTokens}+${msg.result.tokenUsage.outputTokens} duration=${msg.result.durationMs}ms`);
          // Flush any pending rAF-buffered chunks before transitioning to done
          chunkBuffer.flushAgent(msg.agentId);
          dispatchAgent(msg.agentId, {
            type: 'DONE',
            content: msg.result.content,
            usage: msg.result.tokenUsage,
            durationMs: msg.result.durationMs,
          });
          break;
        }
        case 'agentError': {
          console.error(`[Panel] agentError agent=${msg.agentId} error="${msg.error}" retryable=${msg.retryable}`);
          dispatchAgent(msg.agentId, {
            type: 'ERROR',
            message: msg.error,
            retryable: msg.retryable,
          });
          break;
        }
        case 'meetingDone': {
          console.log(`[Panel] meetingDone — cost=${msg.summary.totalCost} duration=${msg.summary.totalDurationMs}ms`);
          setMeeting(prev => ({
            ...prev,
            phase: 'done',
            summary: msg.summary,
          }));
          break;
        }
        case 'meetingCancelled': {
          console.log(`[Panel] meetingCancelled`);
          setMeeting(prev => {
            const agents = { ...prev.agents };
            for (const [id, state] of Object.entries(agents)) {
              if (state.type === 'streaming' || state.type === 'selected' || state.type === 'retrying') {
                agents[id] = { type: 'idle' };
              }
            }
            return { ...prev, agents, phase: 'cancelled' };
          });
          break;
        }
        case 'copyDone':
          setCopyStatus('success');
          break;
        case 'copyFailed':
          setCopyStatus('failed');
          break;
        case 'saveDone':
          setSaveStatus('success');
          break;
        case 'saveFailed':
          setSaveStatus('failed');
          break;
      }
    }, [dispatchAgent, chunkBuffer]),
  );

  // Request team data for display names (this also signals "panel ready" to the host)
  React.useEffect(() => {
    console.log('[Panel] mounted — sending getTeam (this triggers host message flush)');
    postMessage({ type: 'getTeam' });
  }, [postMessage]);

  // Build agent list from participants, using agentInfos for names
  const agentList = meeting.participants.map(id => {
    const info = agentInfos.find(a => a.id === id);
    return {
      id,
      name: info?.name ?? id,
      roleLabel: info?.roleLabel ?? '',
    };
  });

  function handleCancel() {
    if (meeting.meetingId) {
      postMessage({ type: 'cancelMeeting', meetingId: meeting.meetingId });
    }
  }

  function handleCopy() {
    if (meeting.meetingId) {
      setCopyStatus('pending');
      postMessage({ type: 'copyResult', meetingId: meeting.meetingId, format: 'markdown' });
    }
  }

  function handleSave() {
    if (meeting.meetingId) {
      setSaveStatus('pending');
      postMessage({ type: 'saveResult', meetingId: meeting.meetingId });
    }
  }

  function handleRetry(agentId: string) {
    if (meeting.meetingId) {
      dispatchAgent(agentId, { type: 'RETRY' });
      postMessage({ type: 'retryAgent', meetingId: meeting.meetingId, agentId });
    }
  }

  if (meeting.phase === 'idle') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--color-text-secondary)',
        fontSize: '13px',
        padding: '24px',
        textAlign: 'center',
      }}>
        사이드바에서 회의를 시작하세요.
      </div>
    );
  }

  const summarySection = meeting.phase === 'done' && meeting.summary ? (
    <div style={{
      margin: '8px 16px',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid var(--color-border-subtle)',
      background: 'var(--color-bg-elevated)',
    }}>
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        marginBottom: '8px',
      }}>
        회의 요약
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', gap: '12px' }}>
        <span>총 비용: ${meeting.summary.totalCost.toFixed(4)}</span>
        <span>소요 시간: {(meeting.summary.totalDurationMs / 1000).toFixed(1)}초</span>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with view toggle */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <MeetingHeader
            topic={meeting.topic || '팀 회의'}
            mode={meeting.mode}
            participantCount={meeting.participants.length}
            doneCount={meeting.doneCount}
            totalCount={meeting.totalCount}
            phase={meeting.phase}
          />
        </div>
        <div style={{ padding: '0 12px', flexShrink: 0 }}>
          <button
            onClick={() => setViewMode(v => v === 'office' ? 'card' : 'office')}
            title={viewMode === 'office' ? '카드 뷰로 전환' : '오피스 뷰로 전환'}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              border: '1px solid var(--color-border-base)',
              borderRadius: '4px',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {viewMode === 'office' ? '⊞ 카드' : '🏢 오피스'}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'office' ? (
          <>
            {/* Office View (left) */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <OfficeView
                agents={agentList}
                states={meeting.agents}
                onRetry={handleRetry}
              />
              {summarySection}
            </div>
            {/* Chat Log (right) — hidden when panel is narrow */}
            {showChatLog && (
              <div style={{ width: '280px', height: '100%', flexShrink: 0 }}>
                <ChatLogPanel
                  agents={agentList}
                  states={meeting.agents}
                />
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <AgentGrid
              agents={agentList}
              states={meeting.agents}
              onRetry={handleRetry}
            />
            {summarySection}
          </div>
        )}
      </div>

      <ActionBar
        phase={meeting.phase}
        copyStatus={copyStatus}
        saveStatus={saveStatus}
        onCancel={handleCancel}
        onCopy={handleCopy}
        onSave={handleSave}
      />
    </div>
  );
}
