import type { ModelTier } from './llm';
import type { MeetingMode } from './messages';

/**
 * 팀원 데이터 — data/team.json에서 로드
 * Webview에는 TeamMemberView로 변환해서 전달
 */
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  employment: 'permanent' | 'contract';
  experience: number;
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead';
  salary: ModelTier;
  active: boolean;
  description: string;
  criteria: string;

  /** meeting-team 프로필 확장 필드 */
  analysisFocus?: string[];
  criticalRules?: string[];
  communicationStyle?: string;
  resultFormat?: string;
  /** data/skills/ 내 스킬 파일명 (e.g. "skill-pd.md") */
  skillFile?: string;
  /** 런타임에 ProfileManager가 채우는 스킬 콘텐츠 */
  skillContent?: string;
}

/** 회의 설정 */
export interface MeetingConfig {
  id: string;
  topic: string;
  mode: MeetingMode;
  participants: TeamMember[];
  createdAt: number;
}

/** team.json 파일 스키마 */
export interface TeamData {
  version: number;
  members: TeamMember[];
}
