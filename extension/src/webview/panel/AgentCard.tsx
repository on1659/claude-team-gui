import React from 'react';
import { PixelAvatar } from '../shared/PixelAvatar';
import type { AgentState } from './types';

interface AgentCardProps {
  agentId: string;
  name: string;
  roleLabel: string;
  state: AgentState;
  onRetry?: () => void;
}

const STATUS_STYLES: Record<AgentState['type'], {
  border: string;
  bg: string;
  dotColor: string;
  opacity: number;
}> = {
  idle: {
    border: 'var(--agent-border-idle, var(--color-border-subtle))',
    bg: 'var(--agent-bg-idle, var(--color-bg-elevated))',
    dotColor: 'var(--color-text-muted)',
    opacity: 0.7,
  },
  selected: {
    border: 'var(--color-state-active)',
    bg: 'var(--agent-bg-idle, var(--color-bg-elevated))',
    dotColor: 'var(--color-state-active)',
    opacity: 0.85,
  },
  streaming: {
    border: 'var(--agent-border-streaming, var(--color-state-active))',
    bg: 'var(--agent-bg-idle, var(--color-bg-elevated))',
    dotColor: 'var(--color-state-active)',
    opacity: 1,
  },
  done: {
    border: 'var(--agent-border-done, var(--color-state-success))',
    bg: 'var(--agent-bg-done, var(--color-bg-elevated))',
    dotColor: 'var(--color-state-success)',
    opacity: 1,
  },
  error: {
    border: 'var(--agent-border-error, var(--color-state-error))',
    bg: 'var(--agent-bg-error, var(--color-bg-elevated))',
    dotColor: 'var(--color-state-error)',
    opacity: 1,
  },
  retrying: {
    border: 'var(--agent-border-retry, var(--color-state-warn))',
    bg: 'var(--agent-bg-retry, var(--color-bg-elevated))',
    dotColor: 'var(--color-state-warn)',
    opacity: 0.85,
  },
};

function getStatusLabel(state: AgentState): string {
  switch (state.type) {
    case 'idle': return '대기 중...';
    case 'selected': return '참여 예정';
    case 'streaming': return '';
    case 'done': return '';
    case 'error': return state.message;
    case 'retrying': return `재시도 중... (${state.attempt}회)`;
  }
}

export function AgentCard({ agentId, name, roleLabel, state, onRetry }: AgentCardProps): React.ReactElement {
  const style = STATUS_STYLES[state.type];

  return (
    <div
      style={{
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--card-radius, 8px)',
        background: style.bg,
        opacity: style.opacity,
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        transition: 'border-color 0.2s, background 0.2s, opacity 0.2s',
        minHeight: '120px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ position: 'relative' }}>
          <PixelAvatar
            id={agentId}
            size={32}
          />
          {state.type === 'done' && (
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 12, height: 12, borderRadius: '50%',
              background: 'var(--color-state-success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '8px', color: '#fff', fontWeight: 700,
            }}>
              ✓
            </div>
          )}
          {state.type === 'error' && (
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 12, height: 12, borderRadius: '50%',
              background: 'var(--color-state-error)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '8px', color: '#fff', fontWeight: 700,
            }}>
              ✕
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {name}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
            {roleLabel}
          </div>
        </div>
        {/* Status dot */}
        <div style={{
          width: 'var(--dot-size, 7px)',
          height: 'var(--dot-size, 7px)',
          borderRadius: '50%',
          background: style.dotColor,
          animation: state.type === 'streaming' ? 'blink 1s infinite' : 'none',
          flexShrink: 0,
        }} />
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        fontSize: '11px',
        lineHeight: '1.5',
        color: 'var(--color-text-primary)',
        maxHeight: 'var(--card-body-max-height, 220px)',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {state.type === 'streaming' && (
          <>
            {state.buffer}
            <span style={{
              display: 'inline-block',
              width: 'var(--cursor-width, 2px)',
              height: 'var(--cursor-height, 14px)',
              background: 'var(--cursor-color, var(--color-state-active))',
              animation: 'cursorBlink 0.8s step-end infinite',
              verticalAlign: 'text-bottom',
              marginLeft: '1px',
            }} />
          </>
        )}
        {state.type === 'done' && state.content}
        {(state.type === 'idle' || state.type === 'selected') && (
          <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
            {getStatusLabel(state)}
          </span>
        )}
        {state.type === 'error' && (
          <div role="alert" style={{ color: 'var(--color-state-error)' }}>
            ⚠ {state.message}
          </div>
        )}
        {state.type === 'retrying' && (
          <span style={{ fontStyle: 'italic', color: 'var(--color-state-warn)' }}>
            {getStatusLabel(state)}
          </span>
        )}
      </div>

      {/* Footer */}
      {state.type === 'done' && (
        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px' }}>
          <span>~{(state.usage.inputTokens + state.usage.outputTokens).toLocaleString()} 토큰</span>
          <span>{(state.durationMs / 1000).toFixed(1)}초</span>
        </div>
      )}
      {state.type === 'error' && state.retryable && onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '3px 8px',
            fontSize: '10px',
            border: '1px solid var(--color-state-warn)',
            borderRadius: '4px',
            background: 'transparent',
            color: 'var(--color-state-warn)',
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          ↺ 재시도
        </button>
      )}
    </div>
  );
}
