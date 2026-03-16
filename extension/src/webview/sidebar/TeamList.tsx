import React from 'react';
import { MemberCard } from './MemberCard';
import type { TeamMemberView } from '../../types/messages';

interface TeamListProps {
  members: TeamMemberView[];
  onToggle: (id: string) => void;
}

export function TeamList({ members, onToggle }: TeamListProps): React.ReactElement {
  const activeCount = members.filter(m => m.active).length;

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
        <span>Team ({members.length})</span>
        <span>{activeCount}/{members.length}</span>
      </div>
      {members.map(m => (
        <MemberCard key={m.id} member={m} onToggle={onToggle} />
      ))}
    </div>
  );
}
