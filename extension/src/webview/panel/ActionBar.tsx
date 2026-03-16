import React, { useState, useEffect } from 'react';

interface ActionBarProps {
  phase: 'idle' | 'running' | 'done' | 'cancelled';
  copyStatus: 'idle' | 'pending' | 'success' | 'failed';
  saveStatus: 'idle' | 'pending' | 'success' | 'failed';
  onCancel: () => void;
  onCopy: () => void;
  onSave: () => void;
}

const COPY_LABELS = {
  idle: '📋 Markdown 복사',
  pending: '⏳ 복사 중...',
  success: '✓ 복사됨',
  failed: '✗ 복사 실패',
};

const SAVE_LABELS = {
  idle: '💾 결과 저장',
  pending: '⏳ 저장 중...',
  success: '✓ 저장됨',
  failed: '✗ 저장 실패',
};

export function ActionBar({ phase, copyStatus, saveStatus, onCancel, onCopy, onSave }: ActionBarProps): React.ReactElement {
  const isDone = phase === 'done';

  // Auto-reset status labels after 2 seconds
  const [showCopyResult, setShowCopyResult] = useState(false);
  const [showSaveResult, setShowSaveResult] = useState(false);

  useEffect(() => {
    if (copyStatus === 'success' || copyStatus === 'failed') {
      setShowCopyResult(true);
      const timer = setTimeout(() => setShowCopyResult(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyStatus]);

  useEffect(() => {
    if (saveStatus === 'success' || saveStatus === 'failed') {
      setShowSaveResult(true);
      const timer = setTimeout(() => setShowSaveResult(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const copyLabel = showCopyResult || copyStatus === 'pending'
    ? COPY_LABELS[copyStatus]
    : COPY_LABELS.idle;

  const saveLabel = showSaveResult || saveStatus === 'pending'
    ? SAVE_LABELS[saveStatus]
    : SAVE_LABELS.idle;

  const copyColor = copyStatus === 'failed' ? 'var(--color-state-error)' : 'var(--color-text-secondary)';
  const saveColor = saveStatus === 'failed' ? 'var(--color-state-error)' : 'var(--color-text-secondary)';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      borderTop: '1px solid var(--color-border-base)',
    }}>
      {phase === 'running' && (
        <ActionButton
          label="⏹ 중단"
          color="var(--color-state-error)"
          onClick={onCancel}
        />
      )}
      <div style={{ flex: 1 }} />
      <ActionButton
        label={copyLabel}
        color={copyColor}
        onClick={onCopy}
        disabled={!isDone || copyStatus === 'pending'}
      />
      <ActionButton
        label={saveLabel}
        color={saveColor}
        onClick={onSave}
        disabled={!isDone || saveStatus === 'pending'}
      />
    </div>
  );
}

function ActionButton({
  label,
  color,
  onClick,
  disabled = false,
}: {
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        fontSize: '11px',
        border: `1px solid ${disabled ? 'var(--color-border-base)' : color}`,
        borderRadius: '4px',
        background: 'transparent',
        color: disabled ? 'var(--color-text-muted)' : color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
