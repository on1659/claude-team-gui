import React from 'react';

interface SpeechBubbleProps {
  text: string;
  variant?: 'default' | 'streaming' | 'done' | 'error';
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

export function SpeechBubble({ text, variant = 'default' }: SpeechBubbleProps): React.ReactElement | null {
  if (!text || !text.trim()) return null;

  const borderColor =
    variant === 'error' ? 'var(--color-state-error)' :
    variant === 'streaming' ? 'var(--color-state-active)' :
    variant === 'done' ? 'var(--color-state-success)' :
    'var(--color-border-subtle)';

  return (
    <div style={{
      position: 'relative',
      maxWidth: '140px',
      minWidth: '40px',
      padding: '3px 6px',
      borderRadius: '6px',
      border: `1px solid ${borderColor}`,
      background: 'var(--color-bg-elevated)',
      fontSize: '9px',
      lineHeight: '1.3',
      color: 'var(--color-text-primary)',
      textAlign: 'center',
      wordBreak: 'break-word',
      marginBottom: '6px',
    }}>
      {truncate(text, 40)}
      {variant === 'streaming' && (
        <span style={{
          display: 'inline-block',
          width: '2px',
          height: '10px',
          background: 'var(--color-state-active)',
          animation: 'cursorBlink 0.8s step-end infinite',
          verticalAlign: 'text-bottom',
          marginLeft: '1px',
        }} />
      )}
      {/* Tail — outer border triangle */}
      <div style={{
        position: 'absolute',
        bottom: '-5px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderTop: `5px solid ${borderColor}`,
      }} />
      {/* Tail — inner fill triangle */}
      <div style={{
        position: 'absolute',
        bottom: '-3px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '3px solid transparent',
        borderRight: '3px solid transparent',
        borderTop: '4px solid var(--color-bg-elevated)',
      }} />
    </div>
  );
}
