import React from 'react';
import { PixelAvatar } from '../shared/PixelAvatar';
import type { TeamMemberView } from '../../types/messages';

interface MemberCardProps {
  member: TeamMemberView;
  onToggle: (id: string) => void;
}

const LEVEL_LABELS: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
};

const SALARY_LABELS: Record<string, string> = {
  low: 'Haiku',
  medium: 'Sonnet',
  high: 'Opus',
};

export function MemberCard({ member, onToggle }: MemberCardProps): React.ReactElement {
  return (
    <div
      className={`mc ${member.active ? 'sel' : 'off'}`}
      onClick={() => onToggle(member.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        borderRadius: '4px',
        cursor: 'pointer',
        opacity: member.active ? 1 : 0.4,
        background: member.active ? 'var(--mc-selected-bg)' : 'transparent',
      }}
    >
      <input
        type="checkbox"
        checked={member.active}
        onChange={() => onToggle(member.id)}
        onClick={e => e.stopPropagation()}
        style={{ accentColor: 'var(--color-state-active)' }}
      />
      <PixelAvatar id={member.id} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: '12px' }}>
            {member.name}
          </span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            {member.roleLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <span
            style={{
              fontSize: '10px',
              color: `var(--level-${member.experienceLevel})`,
              fontWeight: 500,
            }}
          >
            {LEVEL_LABELS[member.experienceLevel] ?? member.experienceLevel} {member.experience}y
          </span>
          <span
            style={{
              fontSize: '10px',
              color: `var(--salary-${member.salary})`,
              padding: '0 4px',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.05)',
            }}
          >
            {SALARY_LABELS[member.salary] ?? member.salary}
          </span>
        </div>
      </div>
    </div>
  );
}
