import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  phase: 'running' | 'done' | 'cancelled';
}

export function ProgressBar({ progress, phase }: ProgressBarProps): React.ReactElement | null {
  if (phase === 'cancelled') {
    return (
      <div
        data-testid="progress-bar"
        aria-hidden="true"
        style={{
          height: '3px',
          borderRadius: '2px',
          opacity: 0,
          visibility: 'hidden',
        }}
      />
    );
  }

  if (phase === 'done') {
    return (
      <div
        data-testid="progress-bar"
        role="progressbar"
        aria-valuenow={100}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="회의 진행률"
        style={{
          height: '3px',
          background: 'var(--color-state-success)',
          borderRadius: '2px',
        }}
      />
    );
  }

  // phase === 'running'
  return (
    <div
      data-testid="progress-bar"
      role="progressbar"
      aria-valuenow={Math.min(100, Math.max(0, Math.round(progress)))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="회의 진행률"
      style={{
        height: '3px',
        background: 'var(--color-border-subtle)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, progress))}%`,
          background: 'var(--color-state-active)',
          borderRadius: '2px',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}
