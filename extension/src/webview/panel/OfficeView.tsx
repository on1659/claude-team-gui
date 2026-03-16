import React from 'react';
import { PixelAvatar } from '../shared/PixelAvatar';
import { SpeechBubble } from './SpeechBubble';
import type { AgentState } from './types';

interface AgentInfo {
  id: string;
  name: string;
  roleLabel: string;
}

interface OfficeViewProps {
  agents: AgentInfo[];
  states: Record<string, AgentState>;
  onRetry?: (agentId: string) => void;
}

/** Extract a short text for the speech bubble from the current agent state */
function getBubbleText(state: AgentState): string {
  switch (state.type) {
    case 'idle':
      return '';
    case 'selected':
      return '준비 중...';
    case 'streaming': {
      const text = state.buffer.trimEnd();
      if (!text) return '…';
      // Short text — show as-is
      if (text.length <= 35) return text;
      // Show last meaningful portion of the streaming buffer
      const lastBreak = Math.max(text.lastIndexOf('\n'), text.lastIndexOf('. '));
      if (lastBreak > text.length - 50 && lastBreak > 0) {
        const tail = text.slice(lastBreak + 1).trim();
        return tail || '…';
      }
      return '…' + text.slice(-30).trim();
    }
    case 'done':
      return '✓ 발언 완료';
    case 'error':
      return '⚠ ' + (state.message.length > 20 ? state.message.slice(0, 20) + '…' : state.message);
    case 'retrying':
      return `재시도 중... (${state.attempt})`;
  }
}

function getBubbleVariant(state: AgentState): 'default' | 'streaming' | 'done' | 'error' {
  switch (state.type) {
    case 'streaming': return 'streaming';
    case 'done': return 'done';
    case 'error': return 'error';
    default: return 'default';
  }
}

export function OfficeView({ agents, states, onRetry }: OfficeViewProps): React.ReactElement {
  // Arrange in 2 rows x 4 columns
  const rows = [agents.slice(0, 4), agents.slice(4, 8)];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      padding: '16px 8px',
      minHeight: '240px',
      backgroundImage: 'radial-gradient(circle, var(--color-border-subtle) 1px, transparent 1px)',
      backgroundSize: '16px 16px',
      borderRadius: '8px',
    }}>
      {rows.map((row, rowIdx) => row.length > 0 ? (
        <div
          key={rowIdx}
          style={{
            display: 'flex',
            gap: '24px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {row.map(agent => {
            const state = states[agent.id] ?? { type: 'idle' as const };
            const bubbleText = getBubbleText(state);
            const isStreaming = state.type === 'streaming';
            const isDone = state.type === 'done';
            const isError = state.type === 'error';

            return (
              <div
                key={agent.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100px',
                  cursor: isError && onRetry ? 'pointer' : 'default',
                }}
                onClick={isError && onRetry ? () => onRetry(agent.id) : undefined}
                title={isError ? '클릭하여 재시도' : undefined}
              >
                {/* Speech Bubble area — fixed height to prevent layout shift */}
                <div style={{
                  minHeight: '48px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  opacity: bubbleText ? 1 : 0,
                  transition: 'opacity 0.3s',
                }}>
                  <SpeechBubble
                    text={bubbleText}
                    variant={getBubbleVariant(state)}
                  />
                </div>

                {/* Avatar with talk animation when streaming */}
                <div style={{
                  position: 'relative',
                  animation: isStreaming ? 'talk 0.5s ease-in-out infinite' : 'none',
                  transition: 'transform 0.2s',
                  opacity: state.type === 'idle' ? 0.5 : 1,
                }}>
                  <PixelAvatar id={agent.id} size={48} />
                  {/* Status indicator — absolute positioned */}
                  {isDone && (
                    <div style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--color-state-success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '7px',
                      color: '#fff',
                      fontWeight: 700,
                    }}>
                      ✓
                    </div>
                  )}
                  {isError && (
                    <div style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--color-state-error)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '7px',
                      color: '#fff',
                      fontWeight: 700,
                    }}>
                      ✕
                    </div>
                  )}
                </div>

                {/* Name */}
                <div
                  title={agent.name}
                  style={{
                    fontSize: '10px',
                    color: isStreaming ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontWeight: isStreaming ? 600 : 400,
                    marginTop: '2px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100px',
                  }}
                >
                  {agent.name}
                </div>
                <div style={{
                  fontSize: '8px',
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                }}>
                  {agent.roleLabel}
                </div>
              </div>
            );
          })}
        </div>
      ) : null)}
    </div>
  );
}
