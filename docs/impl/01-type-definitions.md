# 01. 타입 정의 — LLM, 메시지 프로토콜, 팀 데이터

> 이 문서의 타입은 **코드에 그대로 복붙 가능한 수준**으로 작성됨
> 아키텍처 문서 대비 변경사항: CRITICAL #4 (LLMMessage), MEDIUM #11 (stopReason) 반영

---

## 1. LLM 타입 (`src/types/llm.ts`)

### 1.1 LLMMessage

**변경 사유**: 기존 `content: string`은 Anthropic/OpenAI/Gemini의 system prompt 처리 방식 차이를 추상화할 수 없음.

```typescript
/** 메시지 내 콘텐츠 블록 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; mediaType: string; data: string } };

/**
 * LLM 메시지
 * - role: 'user' | 'assistant' (system은 LLMRequestOptions.system으로 분리)
 * - content: 단순 문자열 또는 ContentBlock 배열
 *   - string: 편의용 shorthand (내부에서 [{ type: 'text', text: content }]로 변환)
 *   - ContentBlock[]: 멀티모달 지원 시 사용
 */
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}
```

**왜 `role: 'system'`을 제거했는가?**

| Provider | system prompt 처리 |
|----------|-------------------|
| Anthropic | `messages` 배열과 별도 `system` 필드 |
| OpenAI | `messages[0].role === 'system'` |
| Gemini | `systemInstruction` 별도 매개변수 |

3사 모두 다르므로, interface 수준에서 system role을 messages에 넣으면 각 Provider adapter가 복잡해짐. `LLMRequestOptions.system`으로 분리하고, 각 Provider가 자기 방식으로 변환.

### 1.2 LLMStreamEvent

**변경 사유**: 기존에 `stopReason` 없어서 `end_turn` vs `max_tokens` 구분 불가.

```typescript
/** 스트리밍 종료 사유 */
export type StopReason =
  | 'end_turn'       // 정상 완료
  | 'max_tokens'     // 토큰 한도 도달
  | 'stop_sequence'  // stop sequence 매칭
  | 'tool_use'       // tool use 요청 (v2)
  | null;            // 알 수 없음

/** 토큰 사용량 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * 스트리밍 이벤트
 * AsyncGenerator가 순차적으로 yield
 */
export type LLMStreamEvent =
  | { type: 'delta'; chunk: string }
  | { type: 'done'; stopReason: StopReason; usage: TokenUsage }
  | { type: 'error'; code: string; message: string; retryable: boolean };
```

**Provider별 매핑**:

| 이벤트 | Anthropic | OpenAI | Gemini |
|--------|-----------|--------|--------|
| delta | `content_block_delta` → `delta.text` | `choices[0].delta.content` | `candidates[0].content.parts[0].text` |
| done | `message_delta` → `stop_reason` + `usage` | `choices[0].finish_reason` + `usage` | `candidates[0].finishReason` + `usageMetadata` |
| error | SDK exception → code + message | SDK exception → code + message | SDK exception → code + message |

### 1.3 LLMModel

```typescript
/** 모델 등급 — team.json의 salary와 1:1 매핑 */
export type ModelTier = 'high' | 'medium' | 'low';

/** LLM 모델 정보 */
export interface LLMModel {
  id: string;              // 'claude-opus-4-6'
  name: string;            // 'Claude Opus 4.6'
  tier: ModelTier;
  inputCostPer1M: number;  // USD per 1M input tokens
  outputCostPer1M: number; // USD per 1M output tokens
  contextWindow: number;   // 최대 입력 토큰
  maxOutputTokens: number; // 최대 출력 토큰
}
```

### 1.4 LLMRequestOptions

```typescript
/** API 요청 옵션 */
export interface LLMRequestOptions {
  /** system prompt — Provider별로 다른 방식으로 주입됨 */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** 취소 신호 — AbortController.signal 전달 */
  signal?: AbortSignal;
}
```

### 1.5 LLMProvider Interface

```typescript
/**
 * LLM Provider 인터페이스
 * v1: AnthropicProvider만 구현
 * v2: OpenAIProvider, GeminiProvider 추가
 */
export interface LLMProvider {
  readonly id: string;    // 'anthropic' | 'openai' | 'gemini'
  readonly name: string;  // 'Anthropic' | 'OpenAI' | 'Google Gemini'

  /** Provider가 지원하는 모델 목록 */
  getModels(): LLMModel[];

  /**
   * API 키 설정 — ConfigService에서 SecretStorage 키를 로드한 후 호출
   * 이 메서드 호출 전에는 streamMessage() 사용 불가
   */
  setApiKey(apiKey: string): void;

  /**
   * 스트리밍 메시지 전송
   * AsyncGenerator로 chunk를 순차 전달
   * signal로 중간 취소 가능
   *
   * 에러 처리 전략:
   * - retryable 에러 (429, 500, timeout) → yield { type: 'error', retryable: true }
   * - non-retryable 에러 (401, 400) → yield { type: 'error', retryable: false }
   * - 취소 (AbortError) → throw DOMException (caller가 catch)
   */
  streamMessage(
    model: string,
    messages: LLMMessage[],
    options?: LLMRequestOptions
  ): AsyncGenerator<LLMStreamEvent>;

  /** API 키 유효성 검증 (최소 비용 모델로 ping) */
  validateKey(apiKey: string): Promise<boolean>;

  /**
   * 토큰 수 추정
   * - Anthropic: POST /v1/messages/count_tokens API
   * - OpenAI: tiktoken 로컬 추정
   * - Gemini: countTokens API
   * - fallback: Math.ceil(text.length / 4)
   */
  countTokens?(text: string): Promise<number>;
}
```

---

## 2. 메시지 프로토콜 (`src/types/messages.ts`)

### 2.1 Webview → Extension Host

```typescript
/** 회의 모드 */
export type MeetingMode = 'quick' | 'deep';
// quick = 빠른 회의 (meeting-multi, API 1회, 역할극)
// deep  = 심층 회의 (meeting-team, 팀원별 병렬 API)

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
  | { type: 'setApiKey'; providerId: string; apiKey: string };
```

### 2.2 Extension Host → Webview

```typescript
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

/** Provider 정보 */
export interface ProviderInfo {
  id: string;
  name: string;
  hasKey: boolean;  // SecretStorage에 키가 있는지 (키 값 절대 미전달)
  models: { id: string; name: string; tier: ModelTier }[];
}

/** Host에서 Webview로 보내는 메시지 */
export type HostMessage =
  // 팀 데이터
  | { type: 'teamData'; members: TeamMemberView[] }

  // 회의 스트리밍
  | { type: 'meetingStarted'; meetingId: string; participants: string[] }
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

  // 결과 처리
  | { type: 'copyDone' }
  | { type: 'saveDone'; filePath: string };
```

---

## 3. 팀 데이터 (`src/types/team.ts`)

### 3.1 TeamMember (Extension Host 내부용)

```typescript
/**
 * 팀원 데이터 — data/team.json에서 로드
 * Webview에는 TeamMemberView로 변환해서 전달
 */
export interface TeamMember {
  id: string;
  name: string;
  role: string;          // 'PD' | 'PLANNER_RESEARCH' | 'BACKEND' 등
  roleLabel: string;     // '프로젝트 디렉터' | '기획 · 리서치' 등
  employment: 'permanent' | 'contract';
  experience: number;    // 연차 (년)
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead';
  salary: ModelTier;     // 'low' | 'medium' | 'high' — LLM 모델 tier와 1:1
  active: boolean;       // 기본 참여 여부
  description: string;   // 역할 설명 (system prompt에 주입)
  criteria: string;      // 판단 기준 (system prompt에 주입)
}
```

### 3.2 MeetingConfig

```typescript
/** 회의 설정 */
export interface MeetingConfig {
  id: string;            // UUID
  topic: string;
  mode: MeetingMode;
  participants: TeamMember[];
  createdAt: number;     // Date.now()
}
```

### 3.3 team.json 스키마

```json
{
  "version": 1,
  "members": [
    {
      "id": "jimin",
      "name": "지민",
      "role": "PD",
      "roleLabel": "프로젝트 디렉터",
      "employment": "permanent",
      "experience": 10,
      "experienceLevel": "senior",
      "salary": "high",
      "active": true,
      "description": "프로젝트 전체 책임자. 일정, 리소스, 목표 달성을 총괄",
      "criteria": "일정 준수 / 리소스 현실성 / 목표 정합성"
    }
  ]
}
```

**경로**: `data/team.json` (Extension 번들 내)
**로드**: `vscode.Uri.file(path.join(context.extensionPath, 'data', 'team.json'))`

> ⚠️ 이슈 #6 해결: 배포 후 `context.extensionPath` 기반 절대 경로로 접근해야 함. 상대 경로 사용 금지.

---

## 4. 아키텍처 문서 대비 변경 이력

| 항목 | 아키텍처 (01-architecture.md) | 구현 문서 (여기) | 변경 사유 |
|------|------------------------------|------------------|-----------|
| LLMMessage.role | `'system' \| 'user' \| 'assistant'` | `'user' \| 'assistant'` | system → options.system 분리 (이슈 #4) |
| LLMMessage.content | `string` | `string \| ContentBlock[]` | 멀티모달 확장성 (이슈 #4) |
| LLMStreamEvent.type | `'text_delta' \| 'done' \| 'error'` | `'delta' \| 'done' \| 'error'` | 네이밍 단순화 |
| LLMStreamEvent | usage만 있음 | stopReason 추가 | 이슈 #11 |
| LLMModel | inputCostPer1K | inputCostPer1M | 업계 표준 (per 1M tokens) |
| WebviewMessage | copyResult만 | saveResult, setApiKey 추가 | 이슈 #3, Provider 관리 |
| HostMessage | 없음 | meetingStarted, meetingCancelled, copyDone, saveDone 추가 | 낙관적 UI (이슈 #2), Markdown (이슈 #3) |
