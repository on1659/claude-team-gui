import type { TokenUsage, ModelTier } from './llm';

/** 회의 모드 */
export type MeetingMode = 'quick' | 'deep';

/** Full meeting history entry */
export interface HistoryEntry {
  meetingId: string;
  topic: string;
  timestamp: number;
  mode: 'quick' | 'deep';
  participants: { id: string; name: string; roleLabel: string }[];
  agentResults: { agentId: string; name: string; roleLabel: string; content: string; model: string }[];
  summary: { totalCost: number; totalDurationMs: number };
}

/** Lightweight list item for browsing history */
export interface HistoryListItem {
  meetingId: string;
  topic: string;
  timestamp: number;
  mode: 'quick' | 'deep';
  participantCount: number;
}

/** Webview에서 Host로 보내는 메시지 */
export type WebviewMessage =
  // 팀 관리
  | { type: 'getTeam' }
  | { type: 'toggleMember'; memberId: string }

  // 회의 실행
  | { type: 'startMeeting'; topic: string; participants: string[]; mode: MeetingMode }
  | { type: 'cancelMeeting'; meetingId: string }
  | { type: 'retryAgent'; meetingId: string; agentId: string }

  // 결과 처리
  | { type: 'copyResult'; meetingId: string; format: 'markdown' | 'json' }
  | { type: 'saveResult'; meetingId: string }

  // Provider 관리
  | { type: 'getProviders' }
  | { type: 'setProvider'; providerId: string }
  | { type: 'setApiKey'; providerId: string; apiKey: string }

  // OAuth 로그인
  | { type: 'login'; providerId: string }
  | { type: 'logout'; providerId: string }

  // 회의 기록
  | { type: 'getHistory'; page: number }
  | { type: 'loadHistory'; meetingId: string };

/** 팀원 정보 (Webview 표시용) */
export interface TeamMemberView {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  experience: number;
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead';
  salary: 'low' | 'medium' | 'high';
  active: boolean;
  description: string;
}

/** 에이전트 결과 */
export interface AgentResult {
  content: string;
  tokenUsage: TokenUsage;
  durationMs: number;
  model: string;
}

/** 회의 요약 */
export interface MeetingSummary {
  agreements: string[];
  conflicts: { topic: string; opinions: { agentId: string; opinion: string }[] }[];
  nextActions: string[];
  totalCost: number;
  totalDurationMs: number;
}

/** 비용 추정 */
export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  breakdown?: Record<string, { tokens: number; cost: number; model: string }>;
}

/** Provider 인증 방식 */
export type AuthMode = 'none' | 'apiKey';

/** Provider 정보 */
export interface ProviderInfo {
  id: string;
  name: string;
  hasKey: boolean;
  authMode: AuthMode;
  models: { id: string; name: string; tier: ModelTier }[];
}

/** Host에서 Webview로 보내는 메시지 */
export type HostMessage =
  // 팀 데이터
  | { type: 'teamData'; members: TeamMemberView[] }

  // 회의 스트리밍
  | { type: 'meetingStarted'; meetingId: string; participants: string[]; topic: string; mode: MeetingMode }
  | { type: 'agentStream'; meetingId: string; agentId: string; seq: number; chunk: string }
  | { type: 'agentDone'; meetingId: string; agentId: string; result: AgentResult }
  | { type: 'agentError'; meetingId: string; agentId: string; error: string; retryable: boolean }
  | { type: 'meetingDone'; meetingId: string; summary: MeetingSummary }
  | { type: 'meetingCancelled'; meetingId: string }

  // 비용
  | { type: 'costUpdate'; estimated: CostEstimate }

  // Provider
  | { type: 'providerList'; providers: ProviderInfo[]; activeId: string }
  | { type: 'apiKeyValidated'; providerId: string; valid: boolean; error?: string }

  // OAuth
  | { type: 'loginStarted'; providerId: string }
  | { type: 'loginDone'; providerId: string }
  | { type: 'loginFailed'; providerId: string; error: string }
  | { type: 'logoutDone'; providerId: string }

  // 결과 처리
  | { type: 'copyDone' }
  | { type: 'copyFailed'; error: string }
  | { type: 'saveDone'; filePath: string }
  | { type: 'saveFailed'; error: string }

  // 회의 기록
  | { type: 'historyList'; items: HistoryListItem[]; total: number; page: number }
  | { type: 'historyDetail'; entry: HistoryEntry };
