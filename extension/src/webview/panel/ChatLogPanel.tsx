import React, { useRef, useEffect } from 'react';
import { PixelAvatar } from '../shared/PixelAvatar';
import { PIXEL_DATA } from '../shared/pixel-data';
import type { AgentState } from './types';

interface AgentInfo {
  id: string;
  name: string;
  roleLabel: string;
}

interface ChatLogPanelProps {
  agents: AgentInfo[];
  states: Record<string, AgentState>;
}

/** Get the main outfit color from pixel data for color-coding chat entries */
function getAgentColor(agentId: string): string {
  const data = PIXEL_DATA[agentId];
  if (data?.palette[3]) return data.palette[3];
  return 'var(--color-text-secondary)';
}

/** Extract displayable content from agent state */
function getContent(state: AgentState): string | null {
  switch (state.type) {
    case 'streaming': return state.buffer || null;
    case 'done': return state.content;
    case 'error': return `⚠ ${state.message}`;
    default: return null;
  }
}

export function ChatLogPanel({ agents, states }: ChatLogPanelProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScroll = useRef(true);

  // Track whether user has scrolled up
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    isAutoScroll.current = atBottom;
  }

  // Reset auto-scroll when agents list changes (new meeting started)
  const prevAgentCount = useRef(agents.length);
  useEffect(() => {
    if (agents.length !== prevAgentCount.current) {
      isAutoScroll.current = true;
      prevAgentCount.current = agents.length;
    }
  }, [agents.length]);

  // Auto-scroll to bottom when content updates (only if user hasn't scrolled up)
  useEffect(() => {
    if (isAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  // Agents that have content to display
  const activeAgents = agents.filter(a => {
    const state = states[a.id];
    return state && (state.type === 'streaming' || state.type === 'done' || state.type === 'error');
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderLeft: '1px solid var(--color-border-base)',
      background: 'var(--color-bg-elevated)',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        borderBottom: '1px solid var(--color-border-subtle)',
        flexShrink: 0,
      }}>
        대화 기록
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {activeAgents.length === 0 ? (
          <div style={{
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            padding: '24px 8px',
          }}>
            회의가 시작되면 대화 내용이 여기에 표시됩니다.
          </div>
        ) : (
          activeAgents.map(agent => {
            const state = states[agent.id];
            const content = getContent(state);
            if (!content) return null;

            const isStreaming = state.type === 'streaming';
            const isError = state.type === 'error';
            const accentColor = getAgentColor(agent.id);

            return (
              <div key={agent.id} style={{
                borderLeft: `2px solid ${accentColor}`,
                paddingLeft: '8px',
              }}>
                {/* Agent header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '3px',
                }}>
                  <PixelAvatar id={agent.id} size={20} />
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: accentColor,
                    background: `${accentColor}18`,
                    padding: '0 4px',
                    borderRadius: '3px',
                  }}>
                    {agent.name}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    color: 'var(--color-text-muted)',
                  }}>
                    {agent.roleLabel}
                  </span>
                  {isStreaming && (
                    <span style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: 'var(--color-state-active)',
                      animation: 'blink 1s infinite',
                      display: 'inline-block',
                    }} />
                  )}
                </div>

                {/* Content */}
                <div style={{
                  fontSize: '11px',
                  lineHeight: '1.5',
                  color: isError ? 'var(--color-state-error)' : 'var(--color-text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {content}
                  {isStreaming && (
                    <span style={{
                      display: 'inline-block',
                      width: '2px',
                      height: '12px',
                      background: 'var(--color-state-active)',
                      animation: 'cursorBlink 0.8s step-end infinite',
                      verticalAlign: 'text-bottom',
                      marginLeft: '1px',
                    }} />
                  )}
                </div>

                {/* Token info for done agents */}
                {state.type === 'done' && (
                  <div style={{
                    fontSize: '9px',
                    color: 'var(--color-text-muted)',
                    marginTop: '2px',
                  }}>
                    {(state.usage.inputTokens + state.usage.outputTokens).toLocaleString()} tokens · {(state.durationMs / 1000).toFixed(1)}s
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
