import React, { useState } from 'react';
import type { MeetingSummary } from '../../types/messages';

interface SummaryViewProps {
  summary: MeetingSummary;
}

export function SummaryView({ summary }: SummaryViewProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const hasAgreements = summary.agreements.length > 0;
  const hasConflicts = summary.conflicts.length > 0;
  const hasNextActions = summary.nextActions.length > 0;
  const hasAnySections = hasAgreements || hasConflicts || hasNextActions;

  return (
    <div style={{
      margin: '8px 16px',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid var(--color-border-subtle)',
      background: 'var(--color-bg-elevated)',
    }}>
      {/* Cost & duration row */}
      <div style={{
        fontSize: '11px',
        color: 'var(--color-text-secondary)',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
      }}>
        <span>총 비용: {summary.totalCost > 0 ? `$${summary.totalCost.toFixed(4)}` : '무료'}</span>
        <span>소요 시간: {(summary.totalDurationMs / 1000).toFixed(1)}초</span>

        {hasAnySections && (
          <button
            onClick={() => setExpanded(prev => !prev)}
            aria-expanded={expanded}
            aria-controls="summary-expanded-sections"
            style={{
              marginLeft: 'auto',
              padding: '2px 8px',
              fontSize: '11px',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '4px',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {expanded ? '접기 \u25B2' : '요약 보기 \u25BC'}
          </button>
        )}
      </div>

      {/* Expanded sections */}
      {expanded && (
        <div id="summary-expanded-sections" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Agreements */}
          {hasAgreements && (
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                marginBottom: '4px',
                color: 'var(--color-state-success)',
              }}>
                합의점
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {summary.agreements.map((item, i) => (
                  <li key={i} style={{
                    fontSize: '11px',
                    color: 'var(--color-text-primary)',
                    lineHeight: '1.5',
                  }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Conflicts */}
          {hasConflicts && (
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                marginBottom: '4px',
                color: 'var(--color-state-warn)',
              }}>
                충돌점
              </div>
              {summary.conflicts.map((conflict, i) => (
                <div key={i} style={{ marginBottom: i < summary.conflicts.length - 1 ? '6px' : 0 }}>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--color-text-primary)',
                    lineHeight: '1.5',
                    fontWeight: 600,
                  }}>
                    {conflict.topic}
                  </div>
                  {conflict.opinions.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                      {conflict.opinions.map((op, j) => (
                        <li key={j} style={{
                          fontSize: '11px',
                          color: 'var(--color-text-primary)',
                          lineHeight: '1.5',
                        }}>
                          <strong>{op.agentId}</strong>: {op.opinion}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Next Actions */}
          {hasNextActions && (
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                marginBottom: '4px',
                color: 'var(--color-state-info)',
              }}>
                액션아이템
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {summary.nextActions.map((item, i) => (
                  <li key={i} style={{
                    fontSize: '11px',
                    color: 'var(--color-text-primary)',
                    lineHeight: '1.5',
                  }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
