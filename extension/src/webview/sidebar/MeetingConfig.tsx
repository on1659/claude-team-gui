import React, { useState } from 'react';
import type { MeetingMode } from '../../types/messages';

interface MeetingConfigProps {
  onStart: (topic: string, mode: MeetingMode) => void;
  disabled: boolean;
  hasApiKey: boolean;
}

export function MeetingConfig({ onStart, disabled, hasApiKey }: MeetingConfigProps): React.ReactElement {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<MeetingMode>('deep');

  const canStart = topic.trim().length > 0 && hasApiKey && !disabled;

  function handleStart() {
    if (!canStart) return;
    onStart(topic.trim(), mode);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && canStart) {
      e.preventDefault();
      handleStart();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
      <textarea
        value={topic}
        onChange={e => setTopic(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="회의 주제를 입력하세요..."
        rows={2}
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: '12px',
          background: 'var(--color-bg-input)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-base)',
          borderRadius: '4px',
          resize: 'vertical',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: '4px' }}>
        {(['quick', 'deep'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '11px',
              border: `1px solid ${mode === m ? 'var(--color-state-active)' : 'var(--color-border-base)'}`,
              borderRadius: '4px',
              background: mode === m ? 'rgba(0,122,204,0.2)' : 'transparent',
              color: mode === m ? 'var(--color-state-active)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {m === 'quick' ? 'Quick ~$0.01' : 'Deep ~$0.10'}
          </button>
        ))}
      </div>

      {!hasApiKey && (
        <div style={{ fontSize: '11px', color: 'var(--color-state-warn)' }}>
          API 키를 먼저 설정하세요 (Ctrl+Shift+P → Claude Team: API 키 설정)
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={!canStart}
        style={{
          padding: '8px',
          fontSize: '12px',
          fontWeight: 600,
          border: 'none',
          borderRadius: '4px',
          background: canStart ? 'var(--color-state-active)' : 'var(--color-border-base)',
          color: canStart ? '#fff' : 'var(--color-text-muted)',
          cursor: canStart ? 'pointer' : 'not-allowed',
        }}
      >
        {disabled ? '회의 진행 중...' : '회의 시작'}
      </button>
    </div>
  );
}
