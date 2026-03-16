import React from 'react';

interface MeetingHeaderProps {
  topic: string;
  mode: 'quick' | 'deep';
  participantCount: number;
  doneCount: number;
  totalCount: number;
  phase: 'idle' | 'running' | 'done' | 'cancelled';
}

export function MeetingHeader({
  topic,
  mode,
  participantCount,
  doneCount,
  totalCount,
  phase,
}: MeetingHeaderProps): React.ReactElement {
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-base)' }}>
      {/* Topic */}
      <div style={{
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        marginBottom: '6px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {topic || 'Claude Team Meeting'}
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <Badge
          label={mode === 'quick' ? 'Quick' : 'Deep'}
          color={mode === 'quick' ? 'var(--color-state-info)' : 'var(--color-state-active)'}
        />
        <Badge
          label={`${participantCount}명 참여`}
          color="var(--color-text-secondary)"
        />
        {phase !== 'idle' && (
          <Badge
            label={
              phase === 'running' ? '진행 중...' :
              phase === 'done' ? '완료' :
              '취소됨'
            }
            color={
              phase === 'running' ? 'var(--color-state-active)' :
              phase === 'done' ? 'var(--color-state-success)' :
              'var(--color-text-muted)'
            }
          />
        )}
      </div>

      {/* Progress bar */}
      {phase === 'running' && totalCount > 0 && (
        <div style={{
          height: '3px',
          background: 'var(--color-border-subtle)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--color-state-active)',
            borderRadius: '2px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}
      {phase === 'done' && (
        <div style={{ height: '3px', background: 'var(--color-state-success)', borderRadius: '2px' }} />
      )}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }): React.ReactElement {
  return (
    <span style={{
      fontSize: '10px',
      padding: '1px 6px',
      borderRadius: '3px',
      border: `1px solid ${color}`,
      color,
    }}>
      {label}
    </span>
  );
}
