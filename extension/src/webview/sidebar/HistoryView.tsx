import React, { useState } from 'react';
import type { HistoryListItem, HistoryEntry, WebviewMessage } from '../../types/messages';

interface HistoryViewProps {
  postMessage: (msg: WebviewMessage) => void;
  items: HistoryListItem[];
  total: number;
  page: number;
  detail: HistoryEntry | null;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

export function HistoryView({ postMessage, items, total, page, detail }: HistoryViewProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Parent (App.tsx) handles initial fetch on tab switch — no need to fetch on mount

  function handleLoadMore() {
    postMessage({ type: 'getHistory', page: page + 1 });
  }

  function handleSelectItem(meetingId: string) {
    setSelectedId(meetingId);
    postMessage({ type: 'loadHistory', meetingId });
  }

  function handleBack() {
    setSelectedId(null);
  }

  // Detail view
  if (selectedId && detail && detail.meetingId === selectedId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-state-active)',
            cursor: 'pointer',
            fontSize: '12px',
            textAlign: 'left',
            padding: '4px 0',
          }}
        >
          &larr; 목록으로
        </button>

        <div style={{ padding: '0 4px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            {detail.topic}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            {formatDate(detail.timestamp)} | {detail.mode.toUpperCase()} | {detail.participants.length}명
          </div>

          {detail.summary && (
            <div style={{
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              padding: '6px 8px',
              background: 'var(--color-bg-input)',
              borderRadius: '4px',
              marginBottom: '8px',
            }}>
              <span>비용: ${detail.summary.totalCost.toFixed(4)}</span>
              <span style={{ marginLeft: '12px' }}>
                시간: {(detail.summary.totalDurationMs / 1000).toFixed(1)}초
              </span>
            </div>
          )}

          {detail.agentResults.map((r) => (
            <div
              key={r.agentId}
              style={{
                marginBottom: '8px',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid var(--color-border-base)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                {r.name} <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>({r.roleLabel})</span>
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '200px',
                overflow: 'auto',
              }}>
                {r.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // List view
  if (items.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '120px',
        color: 'var(--color-text-muted)',
        fontSize: '12px',
      }}>
        아직 회의 기록이 없습니다
      </div>
    );
  }

  const hasMore = items.length < total;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 8px',
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <span>History ({total})</span>
      </div>

      {items.map((item) => (
        <div
          key={item.meetingId}
          onClick={() => handleSelectItem(item.meetingId)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '8px',
            borderRadius: '4px',
            cursor: 'pointer',
            background: selectedId === item.meetingId ? 'var(--mc-selected-bg)' : 'transparent',
          }}
          onMouseEnter={(e) => {
            if (selectedId !== item.meetingId) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedId !== item.meetingId) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {truncate(item.topic, 40)}
            </span>
            <span style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '3px',
              fontWeight: 500,
              background: item.mode === 'deep' ? 'rgba(0,122,204,0.2)' : 'rgba(255,180,0,0.2)',
              color: item.mode === 'deep' ? 'var(--color-state-active)' : 'var(--color-state-warn)',
            }}>
              {item.mode === 'deep' ? 'Deep' : 'Quick'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--color-text-muted)' }}>
            <span>{formatDate(item.timestamp)}</span>
            <span>{item.participantCount}명</span>
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          onClick={handleLoadMore}
          style={{
            marginTop: '4px',
            padding: '6px',
            fontSize: '11px',
            color: 'var(--color-state-active)',
            background: 'none',
            border: '1px solid var(--color-border-base)',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          더 보기
        </button>
      )}
    </div>
  );
}
