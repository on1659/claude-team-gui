# Claude Team GUI — VS Code Extension 아키텍처

> 작성일: 2026-03-13
> 근거: meeting-vscode-extension-ux 3종 회의 결과 + 멀티 모델 지원 요구

---

## 1. 핵심 설계 원칙

| 원칙 | 설명 |
|------|------|
| **Provider Agnostic** | LLM 제공자를 추상화. Claude 이외 모델(OpenAI, Gemini 등)로 교체 가능 |
| **Sidebar + Panel 분리** | 사이드바 = 팀 관리 + 회의 설정, 패널 = 회의 결과 표시 |
| **Host 독점 통신** | 모든 API 호출은 Extension Host에서만. Webview는 렌더링 전용 |
| **VS Code 네이티브** | CSS 변수 기반 테마 연동, SecretStorage 기반 키 관리 |

---

## 2. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│ VS Code Extension Host (Node.js)                            │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Extension     │  │ Meeting      │  │ LLM Provider      │  │
│  │ Entry         │  │ Service      │  │ Registry          │  │
│  │ (activate)    │  │              │  │                   │  │
│  └──────┬───────┘  └──────┬───────┘  │ ┌───────────────┐ │  │
│         │                 │          │ │ Anthropic      │ │  │
│         │                 │          │ │ Provider       │ │  │
│  ┌──────┴───────┐         │          │ └───────────────┘ │  │
│  │ Sidebar      │         │          │ ┌───────────────┐ │  │
│  │ Provider     │◄────────┤          │ │ OpenAI        │ │  │
│  └──────┬───────┘         │          │ │ Provider      │ │  │
│         │          ┌──────┴───────┐  │ └───────────────┘ │  │
│  ┌──────┴───────┐  │ Panel        │  │ ┌───────────────┐ │  │
│  │ postMessage  │  │ Manager      │  │ │ Gemini        │ │  │
│  │ (typed)      │  └──────────────┘  │ │ Provider      │ │  │
│  └──────┬───────┘                    │ └───────────────┘ │  │
│         │                            └───────────────────┘  │
│         ▼                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Secret       │  │ Profile      │  │ Config            │  │
│  │ Storage      │  │ Manager      │  │ Service           │  │
│  │ (API Keys)   │  │ (team.json)  │  │ (settings.json)   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │ postMessage                  │ postMessage
         ▼                              ▼
┌─────────────────┐            ┌─────────────────────┐
│ Sidebar Webview │            │ Panel Webview        │
│ (React)         │            │ (React)              │
│                 │            │                      │
│ - TeamList      │            │ - MeetingHeader      │
│ - MemberCard    │            │ - ProgressBar        │
│ - CostEstimate  │            │ - AgentGrid          │
│ - MeetingConfig │            │   - AgentCard (×8)   │
│                 │            │ - SummaryView        │
└─────────────────┘            └──────────────────────┘
```

---

## 3. LLM Provider 추상화

### 3.1 Provider Interface

```typescript
// src/types/llm.ts

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMStreamEvent {
  type: 'text_delta' | 'done' | 'error';
  text?: string;
  error?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface LLMProvider {
  readonly id: string;        // 'anthropic' | 'openai' | 'gemini'
  readonly name: string;      // 'Anthropic' | 'OpenAI' | 'Google Gemini'

  /** Provider별 사용 가능한 모델 목록 */
  getModels(): LLMModel[];

  /** 스트리밍 응답 — AsyncGenerator로 chunk 전달 */
  streamMessage(
    model: string,
    messages: LLMMessage[],
    options?: LLMRequestOptions
  ): AsyncGenerator<LLMStreamEvent>;

  /** API 키 유효성 검증 */
  validateKey(apiKey: string): Promise<boolean>;
}

export interface LLMModel {
  id: string;           // 'claude-opus-4-6', 'gpt-4o', 'gemini-2.5-pro'
  name: string;         // 사용자 표시명
  tier: ModelTier;      // 'high' | 'medium' | 'low'
  inputCostPer1K: number;
  outputCostPer1K: number;
}

export type ModelTier = 'high' | 'medium' | 'low';

export interface LLMRequestOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  signal?: AbortSignal;
}
```

### 3.2 Provider Registry

```typescript
// src/services/llm-registry.ts

export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();
  private activeProviderId: string = 'anthropic';

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  getActive(): LLMProvider {
    return this.providers.get(this.activeProviderId)!;
  }

  setActive(providerId: string): void {
    if (!this.providers.has(providerId)) throw new Error(`Unknown provider: ${providerId}`);
    this.activeProviderId = providerId;
  }

  getAll(): LLMProvider[] {
    return [...this.providers.values()];
  }
}
```

### 3.3 Tier 매핑 (Provider-Agnostic)

팀원의 `salary` 필드가 `ModelTier`로 매핑되고, 각 Provider가 tier에 맞는 모델을 반환:

| salary (team.json) | ModelTier | Anthropic | OpenAI | Gemini |
|---------------------|-----------|-----------|--------|--------|
| `high` | `high` | claude-opus-4-6 | gpt-4o | gemini-2.5-pro |
| `medium` | `medium` | claude-sonnet-4-6 | gpt-4o-mini | gemini-2.0-flash |
| `low` | `low` | claude-haiku-4-5 | gpt-4.1-nano | gemini-2.0-flash-lite |

```typescript
// Provider 내부에서 tier → 모델 매핑
function getModelForTier(tier: ModelTier): string {
  const models = provider.getModels();
  return models.find(m => m.tier === tier)?.id ?? models[0].id;
}
```

---

## 4. 메시지 프로토콜 (Webview ↔ Extension Host)

### 4.1 Webview → Host

```typescript
export type WebviewMessage =
  | { type: 'startMeeting'; topic: string; participants: string[]; mode: MeetingMode }
  | { type: 'cancelMeeting'; meetingId: string }
  | { type: 'getTeam' }
  | { type: 'toggleMember'; memberId: string }
  | { type: 'retryAgent'; meetingId: string; agentId: string }
  | { type: 'copyResult'; meetingId: string; format: 'markdown' | 'json' }
  | { type: 'getProviders' }
  | { type: 'setProvider'; providerId: string };

export type MeetingMode = 'quick' | 'deep';
// quick = meeting-multi (단일 API 호출, 역할극)
// deep  = meeting-team  (팀원별 병렬 API 호출)
```

### 4.2 Host → Webview

```typescript
export type HostMessage =
  | { type: 'teamData'; members: TeamMember[] }
  | { type: 'agentStream'; meetingId: string; agentId: string; seq: number; chunk: string }
  | { type: 'agentDone'; meetingId: string; agentId: string; result: AgentResult }
  | { type: 'agentError'; meetingId: string; agentId: string; error: string; retryable: boolean }
  | { type: 'meetingDone'; meetingId: string; summary: MeetingSummary }
  | { type: 'costUpdate'; estimated: CostEstimate }
  | { type: 'providerList'; providers: ProviderInfo[]; activeId: string };

export interface ProviderInfo {
  id: string;
  name: string;
  hasKey: boolean;   // SecretStorage에 키가 있는지
  models: { id: string; name: string; tier: ModelTier }[];
}
```

---

## 5. 디렉토리 구조

```
extension/
├── package.json              # Extension manifest
├── tsconfig.json
├── vite.config.ts            # Webview 빌드
├── src/
│   ├── extension.ts          # activate/deactivate
│   ├── types/
│   │   ├── llm.ts            # LLMProvider interface, LLMModel, etc.
│   │   ├── messages.ts       # WebviewMessage, HostMessage
│   │   └── team.ts           # TeamMember, MeetingConfig
│   ├── services/
│   │   ├── llm-registry.ts   # Provider 등록/조회
│   │   ├── meeting-service.ts # 회의 실행 로직
│   │   ├── profile-manager.ts # team.json 로드/저장
│   │   └── config-service.ts  # Extension 설정 관리
│   ├── providers/
│   │   ├── anthropic.ts      # AnthropicProvider (v1 기본)
│   │   ├── openai.ts         # OpenAIProvider (v2)
│   │   └── gemini.ts         # GeminiProvider (v2)
│   ├── host/
│   │   ├── sidebar-provider.ts
│   │   └── panel-manager.ts
│   └── webview/
│       ├── sidebar/          # React — 사이드바 UI
│       │   ├── App.tsx
│       │   ├── TeamList.tsx
│       │   ├── MemberCard.tsx
│       │   ├── CostEstimate.tsx
│       │   └── MeetingConfig.tsx
│       ├── panel/            # React — 패널 UI
│       │   ├── App.tsx
│       │   ├── MeetingHeader.tsx
│       │   ├── ProgressBar.tsx
│       │   ├── AgentGrid.tsx
│       │   ├── AgentCard.tsx
│       │   └── SummaryView.tsx
│       └── shared/
│           ├── PixelAvatar.tsx
│           ├── vscode-theme.css
│           └── hooks/
│               └── useVscodeMessage.ts
├── media/
│   └── icon.svg              # Activity Bar 아이콘
└── data/
    └── team.json             # 기본 팀원 프로필 (mockup에서 이동)
```

---

## 6. API 키 관리 (Provider별)

```typescript
// SecretStorage 키 네이밍 규칙
const SECRET_KEYS = {
  anthropic: 'claude-team.apiKey.anthropic',
  openai:    'claude-team.apiKey.openai',
  gemini:    'claude-team.apiKey.gemini',
} as const;
```

- Extension Host의 `SecretStorage`에서만 관리
- Webview에는 `hasKey: boolean`만 전달 (키 값 절대 미전달)
- Provider 전환 시 해당 Provider 키 존재 여부 확인 → 없으면 입력 프롬프트

---

## 7. 회의 실행 흐름

### 7.1 빠른 회의 (quick / meeting-multi)

```
[사용자] 주제 입력 + 참여자 선택 + "빠른 회의" 선택
    │
    ▼
[Extension Host] 단일 API 호출
    - 시스템 프롬프트에 8명 역할 주입
    - provider.streamMessage(tierModel, messages)
    │
    ▼
[Panel Webview] 단일 스트림 → 역할별 파싱 → AgentCard에 분배
```

비용: ~$0.01~0.03 (1회 호출)

### 7.2 심층 회의 (deep / meeting-team)

```
[사용자] 주제 입력 + 참여자 선택 + "심층 회의" 선택
    │
    ▼
[Extension Host] 참여자 수만큼 병렬 API 호출
    - 200ms stagger로 rate limit 방지
    - 각 팀원의 tier에 맞는 모델 사용
    - Promise.allSettled로 부분 실패 허용
    │
    ▼
[Panel Webview] 팀원별 독립 스트림 → 각 AgentCard에 직접 표시
```

비용: ~$0.05~0.15 (N회 호출)

---

## 8. 비용 추정 로직

```typescript
function estimateCost(
  participants: TeamMember[],
  mode: MeetingMode,
  provider: LLMProvider
): CostEstimate {
  const models = provider.getModels();

  if (mode === 'quick') {
    // 단일 호출 — medium tier 모델 사용
    const model = models.find(m => m.tier === 'medium')!;
    const estimatedTokens = 2000 + participants.length * 500; // 입력
    const estimatedOutput = participants.length * 400;         // 출력
    return {
      inputTokens: estimatedTokens,
      outputTokens: estimatedOutput,
      cost: estimatedTokens / 1000 * model.inputCostPer1K
           + estimatedOutput / 1000 * model.outputCostPer1K,
    };
  }

  // deep — 팀원별 개별 호출
  let total = { inputTokens: 0, outputTokens: 0, cost: 0 };
  for (const member of participants) {
    const model = models.find(m => m.tier === member.salary)!;
    const input = 1500;
    const output = 800;
    total.inputTokens += input;
    total.outputTokens += output;
    total.cost += input / 1000 * model.inputCostPer1K
                + output / 1000 * model.outputCostPer1K;
  }
  return total;
}
```

---

## 9. v1 스코프

### v1 포함
- [x] Anthropic Provider (기본)
- [x] 빠른 회의 + 심층 회의 2종
- [x] 사이드바 + 패널 분리
- [x] 픽셀아트 아바타 (React PixelAvatar)
- [x] VS Code CSS 변수 테마 연동
- [x] SecretStorage API 키 관리
- [x] 비용 예측 (정적 계산)
- [x] 결과 Markdown 복사/저장

### v2 이후
- [ ] OpenAI / Gemini Provider 추가
- [ ] Provider 선택 UI (사이드바 드롭다운)
- [ ] 프로필 GUI 편집
- [ ] 회의 이력 관리
- [ ] office.html 픽셀아트 씬 (Extension 내부)
- [ ] 커스텀 Provider 플러그인 시스템

---

## 10. 기술 스택

| 항목 | 결정 | 비고 |
|------|------|------|
| Extension Host | TypeScript + Node.js | VS Code Extension API |
| Webview | React + Vite + TypeScript | 사이드바/패널 각각 빌드 |
| 스타일 | VS Code CSS 변수 + Tailwind | shadcn은 v2 (CSS 충돌) |
| LLM SDK | @anthropic-ai/sdk (v1) | v2에서 openai, @google/generative-ai 추가 |
| 상태관리 | React useState/useReducer | Zustand 불가 (Webview 간 상태 공유 X) |
| 빌드 | esbuild (Host) + Vite (Webview) | |

---

## 11. 3종 회의 결과 반영 매핑

| 회의 결론 | 이 문서 반영 위치 |
|-----------|-------------------|
| Sidebar+Panel 분리 (전원 합의) | §2 아키텍처, §5 디렉토리 |
| fire-and-forget + seq (절충) | §4 메시지 프로토콜 (seq 필드) |
| VS Code CSS 변수 매핑 (다은) | §10 기술 스택 |
| API 키 SecretStorage (윤서 CRITICAL) | §6 API 키 관리 |
| "빠른/심층 회의" 용어 (승호) | §4.1 MeetingMode, §7 회의 흐름 |
| 비용 선택권 (소연) | §8 비용 추정, §9 v1 스코프 |
| stagger 200ms (태준) | §7.2 심층 회의 흐름 |
| Provider 추상화 (사용자 요구) | §3 LLM Provider 추상화 (**신규**) |
