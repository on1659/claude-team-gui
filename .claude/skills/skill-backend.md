# 개발자① BE (태준) — 이 프로젝트 컨텍스트

## 확정된 기술 스택

- **프레임워크**: Electron (메인 프로세스 = Node.js)
- **API**: Anthropic SDK 직접 호출 (`@anthropic-ai/sdk`)
- **API 키**: OS 키체인 (`keytar`) — 렌더러 노출 절대 금지
- **데이터**: profiles.json (meeting-team-profiles.md → JSON 마이그레이션)
- **병렬 실행**: `Promise.all` (8 에이전트 동시)

---

## 폴더 구조 (메인 프로세스)

```text
src/
├── main/                        # Electron 메인 프로세스
│   ├── index.ts                 # 앱 진입점 (BrowserWindow 생성)
│   ├── ipc/                     # IPC 핸들러 (렌더러 요청 처리)
│   │   ├── index.ts             # 전체 핸들러 등록 (registerAllHandlers)
│   │   ├── profileHandlers.ts   # read-profiles
│   │   ├── meetingHandlers.ts   # run-meeting, cancel-meeting
│   │   └── settingsHandlers.ts  # check-api-key, set-api-key, remove-api-key
│   │
│   ├── services/                # 비즈니스 로직 (IPC에서 호출)
│   │   ├── anthropicService.ts  # Anthropic SDK 래퍼 (단일/병렬/스트리밍)
│   │   ├── profileService.ts    # profiles.json CRUD
│   │   ├── meetingService.ts    # 회의 실행 오케스트레이션
│   │   └── keychainService.ts   # keytar 래퍼 (API 키 저장/조회/삭제)
│   │
│   ├── models/                  # 데이터 검증 / 변환
│   │   ├── profileParser.ts     # JSON 파싱 + 스키마 검증
│   │   └── meetingBuilder.ts    # 회의 파라미터 → 프롬프트 조립
│   │
│   └── utils/                   # 메인 프로세스 유틸리티
│       ├── logger.ts            # 구조화 로깅
│       ├── retry.ts             # 재시도 로직 (exponential backoff)
│       └── paths.ts             # 앱 경로 해석 (개발/패키징 분기)
│
├── shared/                      # Main + Renderer 공유 (순수 타입/상수만)
│   ├── types/
│   │   ├── team.ts              # TeamMember, TeamRole
│   │   ├── meeting.ts           # Meeting, MeetingType, MeetingStatus
│   │   ├── agent.ts             # AgentResult, AgentStatus (BE/FE 공유)
│   │   └── ipc.ts               # IPC 채널명 상수 + 파라미터/리턴 타입
│   └── constants/
│       ├── channels.ts          # IPC 채널명 (문자열 상수)
│       └── defaults.ts          # 기본값 (타임아웃, 재시도 횟수 등)
│
├── preload/
│   └── preload.ts               # contextBridge 설정 (window.api 노출)
│
└── renderer/                    # (프론트엔드 — skill-frontend.md 참고)
```

---

## 모듈화 원칙

```text
계층 분리 (3-Layer):
  IPC Handlers → Services → Utils/Models
  (진입점)       (비즈니스)   (순수 함수)

  IPC 핸들러: 요청 파싱 + 응답 포맷만. 로직 금지.
  서비스: 비즈니스 로직 집중. 다른 서비스 호출 가능.
  유틸/모델: 순수 함수. 상태 없음. 테스트 용이.

의존성 방향 (단방향):
  ipc/ → services/ → models/, utils/
  shared/ ← 누구나 참조 가능 (역참조 금지)
  renderer/ ↛ main/ (IPC로만 통신, 직접 import 금지)
  main/ ↛ renderer/ (이벤트 emit만 가능)

파일 크기 기준:
  200줄 초과 → 분할 검토
  함수 1개가 50줄 초과 → 헬퍼 추출 또는 분리
  서비스 파일에 3개 이상 도메인 → 서비스 분리

export 규칙:
  - named export만 (default export 금지)
  - 폴더별 index.ts로 barrel export (내부 구조 은닉)
  - 예: import { AnthropicService } from '@main/services'
  - 순환 참조 발생 시 shared/에 인터페이스 추출

네이밍:
  서비스: [도메인]Service.ts       (anthropicService.ts)
  핸들러: [도메인]Handlers.ts      (meetingHandlers.ts)
  모델:   [도메인][역할].ts        (profileParser.ts, meetingBuilder.ts)
  유틸:   [기능].ts                (retry.ts, logger.ts)
  타입:   [도메인].ts              (team.ts, meeting.ts)
```

---

## 서비스 계층 패턴

```typescript
// anthropicService.ts — Anthropic SDK 래퍼
// 단일 진입점: 다른 모듈에서 SDK를 직접 호출하지 않음
export class AnthropicService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  // 단일 에이전트 호출 (스트리밍)
  async runAgent(params: AgentParams, onChunk: ChunkCallback): Promise<AgentResult> { ... }

  // 병렬 에이전트 호출
  async runParallel(agents: AgentParams[], onChunk: ChunkCallback): Promise<AgentResult[]> {
    return Promise.allSettled(agents.map(a => this.runAgent(a, onChunk)));
  }
}

// meetingService.ts — 회의 오케스트레이션
// AnthropicService를 조합해서 회의 전체 흐름 관리
export class MeetingService {
  constructor(
    private anthropic: AnthropicService,
    private profiles: ProfileService,
  ) {}

  async startMeeting(params: MeetingParams): Promise<void> { ... }
  async cancelMeeting(): Promise<void> { ... }
}

// 서비스 규칙:
//   - 생성자 주입 (DI) → 테스트 시 mock 교체 용이
//   - 서비스끼리 직접 import 금지 → 생성자로 주입받음
//   - 상태는 최소화 (실행 중 여부 정도만)
//   - 에러는 throw → IPC 핸들러에서 catch 후 AgentResult로 변환
```

---

## IPC 핸들러 패턴

```typescript
// ipc/meetingHandlers.ts
import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { MeetingParams } from '@shared/types/meeting';

export function registerMeetingHandlers(meetingService: MeetingService) {
  // invoke → handle (요청-응답)
  ipcMain.handle(IPC_CHANNELS.RUN_MEETING, async (_event, params: MeetingParams) => {
    try {
      await meetingService.startMeeting(params);
      return { success: true };
    } catch (error) {
      return { success: false, error: serializeError(error) };
    }
  });

  // 스트리밍 → webContents.send (서버 → 클라이언트 push)
  // meetingService 내부에서 BrowserWindow.webContents.send('agent-update', chunk)
  //
  // 회의 완료 시그널 흐름:
  //   1. FE: window.api.runMeeting(params) 호출 (invoke)
  //   2. BE: meetingService.startMeeting() 내부에서 Promise.all로 8 에이전트 병렬 실행
  //   3. 실행 중: webContents.send('agent-update', chunk) 로 개별 스트리밍
  //   4. 전체 완료: Promise.all 해결 → handle 응답 { success: true } 반환
  //   5. FE: invoke Promise 해결 = 전체 회의 완료 시그널
  //   → 별도 'meeting-complete' 이벤트 불필요 (invoke 응답 자체가 완료 시그널)
}

// ipc/index.ts — 전체 등록
export function registerAllHandlers(services: AppServices) {
  registerProfileHandlers(services.profile);
  registerMeetingHandlers(services.meeting);
  registerSettingsHandlers(services.keychain);
}

// 핸들러 규칙:
//   - 핸들러 안에 비즈니스 로직 금지 (서비스 호출만)
//   - try/catch로 감싸서 에러를 렌더러 친화적 형태로 반환
//   - IPC 채널명은 shared/constants/channels.ts에서 상수로 관리
//   - 파라미터/리턴 타입은 shared/types/ipc.ts에 정의
```

---

## Shared Types (Main ↔ Renderer 공유)

```typescript
// shared/types/ipc.ts — IPC 채널별 파라미터/리턴 타입 맵
export interface IpcChannelMap {
  'read-profiles': { params: void; result: TeamMember[] };
  'run-meeting': { params: MeetingParams; result: { success: boolean } };
  'cancel-meeting': { params: void; result: void };
  'check-api-key': { params: void; result: boolean };
  'set-api-key': { params: { key: string }; result: void };
  'remove-api-key': { params: void; result: void };
}

// shared/constants/channels.ts — 채널명 상수
export const IPC_CHANNELS = {
  READ_PROFILES: 'read-profiles',
  RUN_MEETING: 'run-meeting',
  CANCEL_MEETING: 'cancel-meeting',
  CHECK_API_KEY: 'check-api-key',
  SET_API_KEY: 'set-api-key',
  REMOVE_API_KEY: 'remove-api-key',
  AGENT_UPDATE: 'agent-update',     // 스트리밍 이벤트 (Main → Renderer)
} as const;

// shared/constants/defaults.ts — 기본 설정값
export const DEFAULTS = {
  AGENT_TIMEOUT_MS: 30_000,
  MEETING_TIMEOUT_MS: 120_000,    // 전체 회의 hard limit (8 에이전트 병렬)
  NETWORK_POLL_MS: 3_000,         // 네트워크 재연결 감지 polling 간격
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY_MS: 2_000,
  RATE_LIMIT_DELAY_MS: 5_000,
  MAX_PARALLEL_AGENTS: 8,
} as const;

// 공유 규칙:
//   - shared/에는 순수 타입과 상수만 (로직, 클래스 금지)
//   - 런타임 코드 금지 (import 시 번들 오염 방지)
//   - Main과 Renderer 양쪽에서 import 가능해야 함
```

---

## 에러 처리 전략

```typescript
// 3단계 에러 처리

// 1단계: 서비스 내부 — 도메인 에러 클래스
export class AgentTimeoutError extends Error {
  constructor(public memberId: string) {
    super(`Agent ${memberId} timed out`);
    this.name = 'AgentTimeoutError';
  }
}

export class RateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super(`Rate limited, retry after ${retryAfterMs}ms`);
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Network connection lost');
    this.name = 'NetworkError';
  }
}

// 2단계: IPC 핸들러 — catch 후 직렬화
// 서비스가 throw → 핸들러가 catch → AgentResult로 변환
catch (error) {
  if (error instanceof AgentTimeoutError) {
    return { status: 'timeout', memberId: error.memberId, retryable: true };
  }
  if (error instanceof RateLimitError) {
    return { status: 'error', code: 'RATE_LIMIT', retryable: true };
  }
  return { status: 'error', code: 'UNKNOWN', retryable: false };
}

// 3단계: 렌더러 — UI 표현
// AgentResult.status에 따라 카드 상태 전환 (skill-frontend.md 참고)
```

---

## 로깅 전략

```typescript
// utils/logger.ts — 구조화 로깅 (JSON 포맷)

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;       // 'anthropic' | 'meeting' | 'keychain' | 'ipc'
  message: string;
  data?: Record<string, unknown>;
}

// 로그 대상별 레벨:
//   anthropic:  info (요청/응답 메타), error (실패)
//   meeting:    info (시작/완료/취소), warn (부분 실패), error (전체 실패)
//   keychain:   info (저장/삭제), error (접근 실패)
//   ipc:        debug (채널 호출), error (핸들러 에러)

// 절대 로그에 포함 금지:
//   - API 키 (전체 또는 부분)
//   - 에이전트 응답 전문 (토큰 수만 기록)
//   - 사용자 입력 원문 (주제의 해시만 기록)

// 로그 출력:
//   개발: console (electron-log 또는 직접 출력)
//   패키징: 파일 로그 (app.getPath('logs')/app.log)
//   최대 크기: 10MB 로테이션

// 사용 예:
//   logger.info('meeting', '회의 시작', { type: 'meeting-team', agentCount: 8 });
//   logger.error('anthropic', '에이전트 타임아웃', { memberId: 'jimin', elapsed: 31000 });
```

---

## 핵심 아키텍처 패턴

### Electron IPC 구조

```text
Renderer (React) → ipcRenderer.invoke → Main Process → Anthropic API
                                      → 파일 시스템 (profiles.json)
                                      → 키체인 (API Key)
```

### 에러 응답 형식 (통일)

```typescript
interface AgentResult {
  memberId: string;
  status: 'done' | 'error' | 'timeout';  // 'done' = FE 카드 상태와 통일
  content?: string;
  error?: { code: string; retryable: boolean };
  tokensUsed?: number;
  elapsedMs?: number;    // 응답 소요 시간 (UX 투명성 표시용)
}
```

---

## 데이터 모델 (이 프로젝트)

```typescript
interface TeamMember {
  id: string;
  name: string;
  role: 'PD' | 'PLANNER_RESEARCH' | 'PLANNER_STRATEGY' | 'BACKEND' | 'FRONTEND' | 'QA' | 'UI' | 'UX';
  employment: '정규직' | '비정규직' | '프리랜서';
  profile: string;       // 프롬프트용 프로필 전문
  skillFile?: string;    // 스킬 파일 경로
}

interface Meeting {
  id: string;
  topic: string;
  type: 'meeting' | 'meeting-multi' | 'meeting-agent' | 'meeting-team';
  participantIds: string[];
  results: AgentResult[];
  totalTokens: number;
  status: 'idle' | 'running' | 'partial' | 'done' | 'error';
  createdAt: string;
}
```

---

## 성능 목표 (이 프로젝트)

| 작업 | 목표 | 한계 |
|------|------|------|
| profiles.json 읽기 | < 100ms | — |
| API 단일 에이전트 | < 30초 | → timeout + retry |
| 8 에이전트 병렬 | < 60초 (QA/PD 기준) | 120초 초과 시 전체 타임아웃 |

---

## Anthropic API 특수 케이스 처리

```text
- 429 (레이트 리밋): exponential backoff (초기 5초, 최대 3회 retry)
- 타임아웃 (30초): 해당 에이전트만 retry (최대 3회, DEFAULTS.MAX_RETRY_COUNT 따름)
- 부분 실패 (N/8 성공): 실패한 에이전트만 재시도, 나머지는 표시
- 스트리밍 중단: 받은 내용까지 저장 후 에러 표시
- 네트워크 끊김: NetworkError throw → 전체 중단 + 자동 재연결 감지
- 인증 실패 (401): 즉시 중단, 설정 화면으로 유도 (retry 없음)
- 토큰 초과 (400): 프롬프트 축소 불가 → 에러 표시 (retry 없음)
- 알 수 없는 오류: 최대 2회 retry 후 에러 표시

retry 정책 요약:
  에러 유형       최대 retry   간격
  타임아웃         3회         2초 (RETRY_DELAY_MS)
  레이트 리밋      3회         exponential (5→10→20초)
  네트워크 끊김    0회         자동 재연결 대기
  인증 실패       0회         —
  알 수 없는 오류  2회         2초
```

---

## API 키 관리 (keytar)

```typescript
// keychainService.ts에서 래핑 — 직접 keytar 호출 금지
export class KeychainService {
  private readonly SERVICE = 'claude-team-gui';
  private readonly ACCOUNT = 'anthropic-api-key';

  async getApiKey(): Promise<string | null> {
    return keytar.getPassword(this.SERVICE, this.ACCOUNT);
  }

  async setApiKey(apiKey: string): Promise<void> {
    await keytar.setPassword(this.SERVICE, this.ACCOUNT, apiKey);
  }

  async removeApiKey(): Promise<void> {
    await keytar.deletePassword(this.SERVICE, this.ACCOUNT);
  }

  async hasApiKey(): Promise<boolean> {
    return (await this.getApiKey()) !== null;
  }
}
// 렌더러에는 절대 전달하지 않음 — 메인 프로세스에서만 사용
```

---

## 디자인 패턴 (이 프로젝트)

```typescript
// 1. Observer 패턴 — 에이전트 스트리밍
// Main → Renderer 방향의 실시간 이벤트 전달
// 구현: webContents.send('agent-update', chunk) → ipcRenderer.on('agent-update', cb)
//
// 적용 위치:
//   meetingService.ts: 스트리밍 chunk 발생 시 BrowserWindow.webContents.send
//   ipc/meetingHandlers.ts: 이벤트 등록/해제
//
// 왜 Observer인가:
//   - 발행자(Main)는 구독자(Renderer) 구현을 모름
//   - 1:N 전달 가능 (여러 AgentCard가 동시 구독)
//   - 구독 해제(cleanup)로 메모리 릭 방지

// 2. Strategy 패턴 — 회의 타입별 실행 전략
// 4가지 회의 방식을 동일 인터페이스로 교체 가능하게
interface MeetingStrategy {
  execute(params: MeetingParams): Promise<MeetingResult>;
}

class TeamMeetingStrategy implements MeetingStrategy { /* 프로필+스킬 병렬 */ }
class AgentMeetingStrategy implements MeetingStrategy { /* 역할 기반 병렬 */ }
class MultiMeetingStrategy implements MeetingStrategy { /* 순차 역할극 */ }
class QuickMeetingStrategy implements MeetingStrategy { /* 3역할 빠른 */ }

// meetingService.ts에서 type에 따라 전략 선택:
//   const strategy = this.strategies.get(params.type);
//   return strategy.execute(params);
//
// 왜 Strategy인가:
//   - 새 회의 타입 추가 시 기존 코드 수정 없음 (OCP)
//   - 각 전략의 테스트가 독립적

// 3. Facade 패턴 — AnthropicService
// Anthropic SDK의 복잡한 API를 단순 인터페이스로 래핑
//
// 외부에서 보는 인터페이스:
//   anthropic.runAgent(params, onChunk) → AgentResult
//   anthropic.runParallel(agents, onChunk) → AgentResult[]
//
// 내부에서 숨기는 것:
//   - SDK 초기화, 인증, 헤더 설정
//   - 스트리밍 파싱 (SSE → chunk)
//   - 재시도 로직 (429, timeout)
//   - 토큰 카운팅
//
// 다른 서비스(meetingService)는 SDK 존재를 모름

// 4. Builder 패턴 — meetingBuilder
// 회의 파라미터 → Anthropic API 프롬프트 조립
//
// models/meetingBuilder.ts:
class MeetingPromptBuilder {
  private systemPrompt = '';
  private context = '';
  private members: TeamMember[] = [];

  withTopic(topic: string): this { /* ... */ return this; }
  withMembers(members: TeamMember[]): this { /* ... */ return this; }
  withSkills(skills: Map<string, string>): this { /* ... */ return this; }
  withMeetingType(type: MeetingType): this { /* ... */ return this; }
  build(): AgentParams[] { /* 최종 프롬프트 배열 생성 */ }
}

// 사용:
//   new MeetingPromptBuilder()
//     .withTopic(params.topic)
//     .withMembers(selectedMembers)
//     .withSkills(skillFiles)
//     .withMeetingType(params.type)
//     .build();
//
// 왜 Builder인가:
//   - 프롬프트 조립 순서와 조합이 가변적
//   - 필수/선택 파라미터 구분 명확
//   - 테스트 시 원하는 조합만 빌드 가능
```

---

## 회의 중 확인할 것

1. Electron 메인 프로세스에서 처리해야 하는가, 렌더러에서 가능한가?
2. 병렬 에이전트 실패 시 어떻게 처리하는가?
3. API 키가 어떤 경로로도 노출되지 않는가?
4. 프론트엔드가 필요한 인터페이스가 정의됐는가?
5. 이 로직이 서비스 계층에 있는가, IPC 핸들러에 섞여있지 않은가?
6. shared/ 타입과 실제 구현이 일치하는가?
7. 에러 클래스가 적절한 수준으로 분류되어 있는가?

## 의견 형식

- **구현 방안**: (메인/렌더러 어디서, 어떤 서비스/핸들러)
- **모듈 위치**: (ipc/ / services/ / models/ / shared/ 중 어디)
- **의존성**: (어떤 서비스를 주입받아야 하는가)
- **예상 공수**: (일 단위)
- **리스크**: (Anthropic API 제약, Electron IPC 주의점)
- **인터페이스**: (렌더러에 노출할 IPC 채널 + 타입)
