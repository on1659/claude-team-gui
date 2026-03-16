import React from 'react';
import type { CostEstimate as CostEstimateType } from '../../types/messages';

interface CostEstimateProps {
  estimate: CostEstimateType | null;
  participantCount: number;
  totalCount: number;
}

export function CostEstimate({ estimate, participantCount, totalCount }: CostEstimateProps): React.ReactElement {
  if (!estimate) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '4px 0' }}>
        팀원을 선택하면 비용이 표시됩니다
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: 'var(--color-text-secondary)',
        padding: '4px 0',
        borderTop: '1px solid var(--color-border-subtle)',
      }}
    >
      <span>{participantCount}/{totalCount}명</span>
      <span>~{(estimate.inputTokens + estimate.outputTokens).toLocaleString()} tokens</span>
      <span style={{ color: 'var(--color-state-info)' }}>
        ~${estimate.cost.toFixed(3)}
      </span>
    </div>
  );
}
