import type { MeetingService } from './meeting-service';
import type { MeetingHistoryService } from './meeting-history-service';
import type { HistoryEntry } from '../types/messages';
import type { AgentResult, MeetingSummary, HostMessage } from '../types/messages';

/** Per-agent result stored in the result store */
interface AgentResultEntry {
  name: string;
  roleLabel: string;
  content: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
  durationMs: number;
  model: string;
}

/** Complete meeting result data */
interface MeetingResultData {
  meetingId: string;
  topic: string;
  mode: 'quick' | 'deep';
  participants: Map<string, { name: string; roleLabel: string }>;
  agentResults: Map<string, AgentResultEntry>;
  summary: MeetingSummary | null;
  timestamp: number;
}

export class MeetingResultStore {
  private results = new Map<string, MeetingResultData>();
  private historyService: MeetingHistoryService | null = null;

  /** Wire a MeetingHistoryService to persist completed meetings */
  setHistoryService(service: MeetingHistoryService): void {
    this.historyService = service;
  }

  /**
   * Subscribe to MeetingService events to capture agentDone and meetingDone.
   * Call this once after MeetingService is created.
   */
  subscribeTo(meetingService: MeetingService): void {
    meetingService.onEvent((message: HostMessage) => {
      switch (message.type) {
        case 'agentDone':
          this.handleAgentDone(message.meetingId, message.agentId, message.result);
          break;
        case 'meetingDone':
          this.handleMeetingDone(message.meetingId, message.summary);
          break;
      }
    });
  }

  /**
   * Start tracking a meeting. Called from SidebarProvider when startMeeting happens,
   * so the store knows the topic and participant names/roles.
   */
  trackMeeting(
    meetingId: string,
    topic: string,
    participants: { id: string; name: string; roleLabel: string }[],
    mode: 'quick' | 'deep' = 'deep',
  ): void {
    const participantMap = new Map<string, { name: string; roleLabel: string }>();
    for (const p of participants) {
      participantMap.set(p.id, { name: p.name, roleLabel: p.roleLabel });
    }

    this.results.set(meetingId, {
      meetingId,
      topic,
      mode,
      participants: participantMap,
      agentResults: new Map(),
      summary: null,
      timestamp: Date.now(),
    });
  }

  /** Get raw result data for a meeting */
  getResult(meetingId: string): MeetingResultData | undefined {
    return this.results.get(meetingId);
  }

  /** Format a meeting result as Markdown for copy/save */
  formatAsMarkdown(meetingId: string): string | null {
    const data = this.results.get(meetingId);
    if (!data) return null;
    if (data.agentResults.size === 0 && !data.summary) return null;

    const lines: string[] = [];

    // Header
    lines.push('# 팀 회의 결과');
    lines.push(`- 일시: ${new Date(data.timestamp).toLocaleString('ko-KR')}`);
    lines.push(`- 주제: ${data.topic}`);
    lines.push('');
    lines.push('---');

    // Per-agent results
    for (const [, entry] of data.agentResults) {
      lines.push('');
      lines.push(`## ${entry.name} (${entry.roleLabel})`);
      lines.push('');
      lines.push(entry.content);
      lines.push('');
      lines.push('---');
    }

    // Summary
    if (data.summary) {
      lines.push('');
      lines.push('## 회의 요약');
      lines.push(`- 총 비용: $${data.summary.totalCost.toFixed(4)}`);
      lines.push(`- 소요 시간: ${(data.summary.totalDurationMs / 1000).toFixed(1)}초`);

      if (data.summary.agreements.length > 0) {
        lines.push('');
        lines.push('### 합의사항');
        for (const a of data.summary.agreements) {
          lines.push(`- ${a}`);
        }
      }

      if (data.summary.conflicts.length > 0) {
        lines.push('');
        lines.push('### 의견 충돌');
        for (const c of data.summary.conflicts) {
          lines.push(`- **${c.topic}**`);
          for (const o of c.opinions) {
            lines.push(`  - ${o.agentId}: ${o.opinion}`);
          }
        }
      }

      if (data.summary.nextActions.length > 0) {
        lines.push('');
        lines.push('### 다음 단계');
        for (const n of data.summary.nextActions) {
          lines.push(`- ${n}`);
        }
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  private handleAgentDone(meetingId: string, agentId: string, result: AgentResult): void {
    const data = this.results.get(meetingId);
    if (!data) return;

    const participant = data.participants.get(agentId);
    const name = participant?.name ?? agentId;
    const roleLabel = participant?.roleLabel ?? '';

    data.agentResults.set(agentId, {
      name,
      roleLabel,
      content: result.content,
      tokenUsage: result.tokenUsage,
      durationMs: result.durationMs,
      model: result.model,
    });
  }

  private handleMeetingDone(meetingId: string, summary: MeetingSummary): void {
    const data = this.results.get(meetingId);
    if (!data) return;
    data.summary = summary;

    // Persist to history
    if (this.historyService) {
      const entry: HistoryEntry = {
        meetingId: data.meetingId,
        topic: data.topic,
        timestamp: data.timestamp,
        mode: data.mode,
        participants: Array.from(data.participants.entries()).map(([id, p]) => ({
          id,
          name: p.name,
          roleLabel: p.roleLabel,
        })),
        agentResults: Array.from(data.agentResults.entries()).map(([agentId, r]) => ({
          agentId,
          name: r.name,
          roleLabel: r.roleLabel,
          content: r.content,
          model: r.model,
        })),
        summary: {
          totalCost: summary.totalCost,
          totalDurationMs: summary.totalDurationMs,
        },
      };
      this.historyService.save(meetingId, entry).catch(() => {
        // History save failure is non-critical
      });
    }
  }
}
