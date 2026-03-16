import React, { useState, useCallback } from 'react';
import { useVscodeMessage } from '../shared/hooks/useVscodeMessage';
import { ProviderSelect } from './ProviderSelect';
import { TeamList } from './TeamList';
import { MeetingConfig } from './MeetingConfig';
import { CostEstimate } from './CostEstimate';
import { HistoryView } from './HistoryView';
import type {
  HostMessage, TeamMemberView, CostEstimate as CostEstimateType, MeetingMode,
  HistoryListItem, HistoryEntry,
} from '../../types/messages';

type SidebarTab = 'team' | 'history';

export function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SidebarTab>('team');
  const [members, setMembers] = useState<TeamMemberView[]>([]);
  const [costEstimate, setCostEstimate] = useState<CostEstimateType | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [meetingInProgress, setMeetingInProgress] = useState(false);

  // History state
  const [historyItems, setHistoryItems] = useState<HistoryListItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyDetail, setHistoryDetail] = useState<HistoryEntry | null>(null);

  const postMessage = useVscodeMessage(
    useCallback((msg: HostMessage) => {
      switch (msg.type) {
        case 'teamData':
          setMembers(msg.members);
          break;
        case 'costUpdate':
          setCostEstimate(msg.estimated);
          break;
        case 'meetingStarted':
          setMeetingInProgress(true);
          break;
        case 'meetingDone':
        case 'meetingCancelled':
          setMeetingInProgress(false);
          break;
        case 'historyList':
          if (msg.page === 0) {
            setHistoryItems(msg.items);
          } else {
            setHistoryItems(prev => [...prev, ...msg.items]);
          }
          setHistoryTotal(msg.total);
          setHistoryPage(msg.page);
          break;
        case 'historyDetail':
          setHistoryDetail(msg.entry);
          break;
      }
    }, []),
  );

  // Request initial data
  React.useEffect(() => {
    postMessage({ type: 'getTeam' });
  }, [postMessage]);

  const handleProviderChange = useCallback((_activeId: string, providerHasKey: boolean) => {
    setHasApiKey(providerHasKey);
  }, []);

  function handleToggle(id: string) {
    postMessage({ type: 'toggleMember', memberId: id });
    setMembers(prev => prev.map(m => (m.id === id ? { ...m, active: !m.active } : m)));
  }

  function handleStartMeeting(topic: string, mode: MeetingMode) {
    const participants = members.filter(m => m.active).map(m => m.id);
    if (participants.length === 0) return;
    setMeetingInProgress(true);
    postMessage({ type: 'startMeeting', topic, participants, mode });
  }

  function handleTabChange(tab: SidebarTab) {
    setActiveTab(tab);
    if (tab === 'history') {
      // Refresh history when switching to the tab
      setHistoryDetail(null);
      postMessage({ type: 'getHistory', page: 0 });
    }
  }

  const activeCount = members.filter(m => m.active).length;

  const tabStyle = (tab: SidebarTab): React.CSSProperties => ({
    flex: 1,
    padding: '6px 0',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--color-state-active)' : '2px solid transparent',
    background: 'none',
    color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '4px' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-base)', marginBottom: '4px' }}>
        <button style={tabStyle('team')} onClick={() => handleTabChange('team')}>Team</button>
        <button style={tabStyle('history')} onClick={() => handleTabChange('history')}>History</button>
      </div>

      {activeTab === 'team' ? (
        <>
          <ProviderSelect onProviderChange={handleProviderChange} />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <TeamList members={members} onToggle={handleToggle} />
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-base)', paddingTop: '8px' }}>
            <CostEstimate
              estimate={costEstimate}
              participantCount={activeCount}
              totalCount={members.length}
            />
            <MeetingConfig
              onStart={handleStartMeeting}
              disabled={meetingInProgress || activeCount === 0}
              hasApiKey={hasApiKey}
            />
          </div>
        </>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <HistoryView
            postMessage={postMessage}
            items={historyItems}
            total={historyTotal}
            page={historyPage}
            detail={historyDetail}
          />
        </div>
      )}
    </div>
  );
}
