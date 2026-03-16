import React from 'react';
import { AgentCard } from './AgentCard';
import type { AgentState } from './types';

interface AgentInfo {
  id: string;
  name: string;
  roleLabel: string;
}

interface AgentGridProps {
  agents: AgentInfo[];
  states: Record<string, AgentState>;
  onRetry?: (agentId: string) => void;
}

export function AgentGrid({ agents, states, onRetry }: AgentGridProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '8px',
        padding: '8px',
      }}
    >
      {agents.map(agent => (
        <AgentCard
          key={agent.id}
          agentId={agent.id}
          name={agent.name}
          roleLabel={agent.roleLabel}
          state={states[agent.id] ?? { type: 'idle' }}
          onRetry={onRetry ? () => onRetry(agent.id) : undefined}
        />
      ))}
    </div>
  );
}
