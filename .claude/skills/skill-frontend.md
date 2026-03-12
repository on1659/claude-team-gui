# 개발자② FE (미래) — 이 프로젝트 컨텍스트

## 확정된 기술 스택
- **UI**: React + TypeScript + Tailwind + shadcn/ui
- **상태 관리**: Zustand (전역), useState (로컬)
- **Electron**: 렌더러 프로세스에서 `window.api.*` 를 통해 메인 접근

---

## 폴더 구조 (렌더러 프로세스)

```
src/renderer/
├── app/                      # 앱 진입점
│   ├── App.tsx               # 루트 (라우팅, 프로바이더)
│   └── main.tsx              # ReactDOM.createRoot
│
├── components/               # UI 컴포넌트 (presentational)
│   ├── ui/                   # shadcn/ui 원본 (수정 최소화)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   ├── team/                 # 팀원 관련
│   │   ├── TeamMemberCard.tsx
│   │   ├── TeamMemberList.tsx
│   │   └── TeamMemberAvatar.tsx
│   ├── meeting/              # 회의 관련
│   │   ├── MeetingProgress.tsx
│   │   ├── AgentCard.tsx
│   │   ├── AgentStreamText.tsx
│   │   ├── MeetingResult.tsx
│   │   └── MeetingTypeSelector.tsx
│   └── layout/               # 레이아웃 셸
│       ├── Sidebar.tsx
│       ├── MainPanel.tsx
│       └── AppShell.tsx
│
├── pages/                    # 라우트 단위 페이지 (container)
│   ├── TeamPage.tsx          # 팀원 목록 + 선택
│   ├── MeetingSetupPage.tsx  # 주제 입력 + 방식 선택
│   ├── MeetingRunPage.tsx    # 실행 중 (스트리밍)
│   └── SettingsPage.tsx      # API 키 설정
│
├── hooks/                    # Custom Hooks
│   ├── useAgentStream.ts     # 에이전트 스트리밍 구독
│   ├── useMeeting.ts         # 회의 실행/중단 로직
│   ├── useTeamMembers.ts     # 팀원 로드/선택
│   └── useApiKey.ts          # API 키 상태 확인
│
├── stores/                   # Zustand 스토어
│   ├── teamStore.ts
│   ├── meetingStore.ts
│   └── settingsStore.ts
│
├── lib/                      # 유틸리티 (순수 함수)
│   ├── ipc.ts                # window.api 타입 래퍼
│   ├── format.ts             # 날짜, 토큰 수 포맷
│   └── cn.ts                 # Tailwind clsx 유틸 (shadcn 기본)
│
├── types/                    # 렌더러 전용 타입
│   └── renderer.d.ts         # window.api 타입 선언
│
└── styles/
    └── globals.css            # Tailwind 디렉티브 + CSS 변수
```

---

## 파일 네이밍 컨벤션

```
컴포넌트 파일:    PascalCase.tsx        (TeamMemberCard.tsx)
훅 파일:         camelCase.ts          (useAgentStream.ts) — 반드시 use 접두사
스토어 파일:      camelCase.ts          (meetingStore.ts) — 반드시 Store 접미사
유틸리티 파일:    camelCase.ts          (format.ts)
타입 파일:        camelCase.d.ts        (renderer.d.ts)
테스트 파일:      원본명.test.tsx        (TeamMemberCard.test.tsx)
인덱스 파일:      index.ts              — barrel export용 (components/team/index.ts)

금지:
  - kebab-case 파일명 (shadcn/ui 원본 제외)
  - 파일명에 타입 접미사: *.component.tsx, *.hook.ts (폴더 구조로 구분)
  - default export (named export만 사용 → 리팩토링/검색 용이)
```

---

## 컴포넌트 설계 원칙

```
1. Presentational / Container 분리:
   pages/  → Container: 데이터 fetch, store 연결, 에러 처리
   components/ → Presentational: props만 받아서 렌더링
   → 컴포넌트 재사용성 극대화, 테스트 용이

2. 단일 책임:
   컴포넌트 1개 = 역할 1개
   TeamMemberCard는 카드 렌더링만 — 선택 로직은 부모(TeamPage)에서
   AgentCard는 스트리밍 표시만 — 스트리밍 구독은 훅(useAgentStream)에서

3. 컴포넌트 크기 기준:
   150줄 초과 → 분할 검토
   props 8개 초과 → 객체 props 또는 컴포넌트 분할
   조건부 렌더링 3단계 초과 → 하위 컴포넌트로 추출

4. Props 인터페이스:
   컴포넌트와 같은 파일에 정의 (별도 types 파일 금지)
   interface [컴포넌트명]Props { ... }
   export 해서 부모에서 참조 가능하게

5. Composition 패턴:
   조건부 내부 구조 → children / render props
   예: AgentCard 내부에 idle/running/done/error 별 슬롯
   → <AgentCard.Streaming />, <AgentCard.Result /> 같은 compound pattern 고려
```

---

## Custom Hooks 패턴

```typescript
// 훅 추출 기준: "이 로직이 2곳 이상에서 쓰이거나, 컴포넌트를 50줄 이상 키우면"

// useAgentStream.ts — 에이전트 스트리밍 구독
export function useAgentStream(memberId: string) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<AgentStatus>('idle');

  useEffect(() => {
    const cleanup = window.api.onAgentUpdate(({ memberId: id, chunk, done, error }) => {
      if (id !== memberId) return;
      if (chunk) setText(prev => prev + chunk);
      if (done) setStatus('done');
      if (error) setStatus('error');
    });
    return cleanup;  // 반드시 cleanup 반환
  }, [memberId]);

  return { text, status } as const;
}

// useMeeting.ts — 회의 실행 전체 오케스트레이션
export function useMeeting() {
  const { topic, type, selectedIds } = useMeetingStore();
  const start = async () => {
    // window.api.runMeeting()은 long-running invoke:
    //   호출 시점 → 스트리밍 시작 (agent-update 이벤트로 수신)
    //   Promise 해결 시점 → 전체 회의 완료 (별도 complete 이벤트 불필요)
    const result = await window.api.runMeeting({ topic, type, selectedIds });
    // result.success === true → Meeting.status를 'done' 또는 'partial'로 전이
  };
  const cancel = async () => { ... };
  return { start, cancel, isRunning, progress };
}

// 훅 규칙:
//   - 반드시 use 접두사
//   - 내부에서 다른 훅 호출 가능 (Zustand, useState, useEffect)
//   - cleanup 함수 반드시 반환 (메모리 릭 방지)
//   - 에러 상태를 반환값에 포함 (throw 금지 — ErrorBoundary가 처리)
```

---

## Import 순서 규칙

```typescript
// 1. React / 외부 라이브러리
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. 내부 라이브러리 / 유틸
import { cn } from '@/lib/cn';
import { formatTokens } from '@/lib/format';

// 3. 컴포넌트
import { Button } from '@/components/ui/button';
import { TeamMemberCard } from '@/components/team/TeamMemberCard';

// 4. 훅 / 스토어
import { useAgentStream } from '@/hooks/useAgentStream';
import { useMeetingStore } from '@/stores/meetingStore';

// 5. 타입 (type-only import)
import type { TeamMember } from '@shared/types';
import type { AgentStatus } from '@shared/types/agent';

// 각 그룹 사이 빈 줄 1개.
// eslint-plugin-import/order 또는 prettier-plugin-organize-imports로 자동 정렬.
// @ = src/renderer (tsconfig paths alias)
// @shared = src/shared (Main/Renderer 공유)
```

---

## 에러 바운더리 전략

```
계층:
  App (최상위)
  └── AppErrorBoundary           — 앱 전체 크래시 → "문제가 발생했습니다" + [새로고침]
      ├── Sidebar
      │   └── SidebarErrorBoundary — 사이드바 크래시 → 나머지는 정상
      └── MainPanel
          ├── MeetingRunPage
          │   └── AgentCardErrorBoundary — 개별 카드 크래시 → 해당 카드만 에러 표시
          └── ...

원칙:
  - ErrorBoundary는 사용자가 "부분 실패"를 인지할 수 있는 단위로 배치
  - 에이전트 카드 1개 실패 → 나머지 7개는 정상 동작해야 함
  - fallback UI에 반드시 복구 액션 포함 ([재시도] 또는 [새로고침])
  - 에러 로그는 console.error + 추후 텔레메트리 연결 가능하도록 onError 콜백
```

---

## 핵심 컴포넌트 구조 (이 앱)

```
App
├── AppShell (Sidebar + MainPanel)
│   ├── Sidebar
│   │   └── TeamMemberList
│   │       └── TeamMemberCard[]
│   └── MainPanel
│       ├── TeamPage          — 팀원 목록 + 선택
│       ├── MeetingSetupPage  — 주제 입력 + 방식 선택 + 팀원 확인
│       └── MeetingRunPage    — 실행 중 (스트리밍 + 진행률)
│           ├── MeetingProgress — "N/8 완료" 상단 바
│           ├── AgentCard[]    — 각 에이전트 카드 (스트리밍 텍스트)
│           │   └── AgentStreamText — 스트리밍 텍스트 렌더링
│           └── MeetingResult  — 전체 완료 후 요약
├── Toast (Portal)
├── Tooltip (Portal)
└── Modal (Portal)
```

---

## Zustand Store 구조 (이 앱)

```typescript
// 팀원 store — src/renderer/stores/teamStore.ts
interface TeamStore {
  members: TeamMember[];
  selectedIds: string[];
  loadMembers: () => Promise<void>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
}

// 회의 store — src/renderer/stores/meetingStore.ts
interface MeetingStore {
  topic: string;
  type: MeetingType;
  status: MeetingStatus;
  results: Map<string, AgentResult>;   // memberId → result (Map으로 O(1) 조회)
  totalTokens: number;
  setTopic: (topic: string) => void;
  setType: (type: MeetingType) => void;
  updateResult: (memberId: string, result: Partial<AgentResult>) => void;
  reset: () => void;
}

// 설정 store — src/renderer/stores/settingsStore.ts
interface SettingsStore {
  hasApiKey: boolean;
  theme: 'light' | 'dark' | 'system';
  showTokenUsage: boolean;
  checkApiKey: () => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

// 스토어 규칙:
//   - 액션은 스토어 내부에 정의 (외부에서 set() 직접 호출 금지)
//   - selector로 필요한 것만 구독: const topic = useMeetingStore(s => s.topic)
//   - 비동기 액션도 스토어 내부에 (async 메서드)
//   - devtools 미들웨어 적용 (개발 중 상태 추적)
//
// BE↔FE 데이터 변환 주의:
//   BE: results: AgentResult[] (배열) — IPC로 전달되는 형태
//   FE: results: Map<string, AgentResult> (Map) — memberId로 O(1) 조회
//   변환: IPC 응답 수신 시 배열을 Map으로 변환
//     const map = new Map(results.map(r => [r.memberId, r]));
//   → 이 변환은 meetingStore의 액션 내부에서 처리
```

---

## Electron IPC 패턴 (이 앱)

```typescript
// preload.ts에서 노출
window.api = {
  readProfiles: () => ipcRenderer.invoke('read-profiles'),
  runMeeting: (params) => ipcRenderer.invoke('run-meeting', params),
  cancelMeeting: () => ipcRenderer.invoke('cancel-meeting'),
  onAgentUpdate: (cb) => ipcRenderer.on('agent-update', cb),  // 스트리밍
  checkApiKey: () => ipcRenderer.invoke('check-api-key'),
  setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),
  removeApiKey: () => ipcRenderer.invoke('remove-api-key'),
}

// 렌더러에서 사용 시 반드시 lib/ipc.ts 래퍼를 통해 호출
// → 타입 안전성 + 에러 핸들링 일원화
//
// 예외: onAgentUpdate (스트리밍 이벤트 구독)
//   lib/ipc.ts 래퍼는 invoke (요청-응답) 패턴 전용
//   on (이벤트 구독) 패턴은 훅(useAgentStream)에서 window.api.onAgentUpdate 직접 호출
//   → cleanup 함수 반환이 필요하므로 래퍼보다 훅에서 직접 관리가 적합
```

---

## 코드 분할 / 성능 최적화

```
Lazy Loading:
  - 페이지 단위: React.lazy(() => import('./pages/SettingsPage'))
  - 모달 컴포넌트: 사용 시점에 로드
  - 무거운 라이브러리 (마크다운 렌더링 등): 동적 import

Memoization 기준:
  - React.memo: 리스트 아이템 (TeamMemberCard, AgentCard) — 반드시 적용
  - useMemo: 8개 에이전트 결과 필터링/정렬 같은 O(n) 연산
  - useCallback: 자식에게 전달하는 이벤트 핸들러 (불필요한 리렌더 방지)
  - 과도한 memo 금지: 단순 컴포넌트는 memo 없이 (성능 측정 후 판단)

스트리밍 최적화:
  - requestAnimationFrame으로 DOM 업데이트 배치
  - 텍스트 누적은 ref로 (setState 호출 빈도 제한 — 100ms throttle)
  - 완료된 카드는 더 이상 업데이트 안 함 (early return)
```

---

## 에이전트 스트리밍 UI 패턴

```typescript
// useAgentStream 훅으로 추출 (위 Custom Hooks 섹션 참고)
// AgentCard에서는 훅 반환값만 소비:
function AgentCard({ member }: AgentCardProps) {
  const { text, status } = useAgentStream(member.id);
  return (
    <Card className={cn(cardVariants[status])}>
      {status === 'running' && <AgentStreamText text={text} />}
      {status === 'done' && <AgentResult text={text} />}
      {status === 'error' && <AgentError onRetry={...} />}
    </Card>
  );
}
```

---

## TeamMemberCard 상태 (5가지)
```
idle     — 기본 (이름, 역할, 고용형태 배지)
selected — 선택됨 (하이라이트, 체크)
running  — 실행 중 (스피너, 스트리밍 텍스트 시작)
done     — 완료 (결과 텍스트, 완료 아이콘)
error    — 실패 (에러 아이콘, retry 버튼)
```

## 회의 모드 선택 UI (확정)
```
회의 시작 시 선택 — 런타임 전환 없음
○ meeting      (빠른 3역할)
○ meeting-multi (8역할 순차)
● meeting-team  (기본값, 프로필+스킬 주입)
○ meeting-agent (8역할 독립)
```

## 테스트 전략

```typescript
// 도구: Vitest + React Testing Library

// 1. 컴포넌트 테스트 — Presentational 컴포넌트 위주
// __tests__/ 폴더 없이 같은 디렉토리에 *.test.tsx
import { render, screen } from '@testing-library/react';
import { TeamMemberCard } from './TeamMemberCard';

test('선택 상태에서 체크 아이콘 표시', () => {
  render(<TeamMemberCard member={mockMember} selected={true} />);
  expect(screen.getByRole('img', { name: /선택됨/ })).toBeInTheDocument();
});

// 2. 훅 테스트 — renderHook으로 상태 변화 검증
import { renderHook, act } from '@testing-library/react';
import { useMeeting } from './useMeeting';

test('start 호출 시 status가 running으로 전환', async () => {
  const { result } = renderHook(() => useMeeting());
  await act(() => result.current.start());
  expect(result.current.isRunning).toBe(true);
});

// 3. Store 테스트 — Zustand 스토어 직접 테스트
import { useMeetingStore } from './meetingStore';

test('updateResult로 특정 멤버 결과 업데이트', () => {
  const { updateResult, results } = useMeetingStore.getState();
  updateResult('jimin', { status: 'done', content: '결과' });
  expect(useMeetingStore.getState().results.get('jimin')?.status).toBe('done');
});

// 테스트 범위:
//   필수: 카드 상태 5가지 렌더링, 훅 cleanup, 스토어 액션
//   선택: 페이지(Container) — IPC mock 필요하므로 E2E로 커버
//   금지: shadcn/ui 원본 컴포넌트 테스트 (이미 검증됨)
//
// Mock 규칙:
//   window.api → vi.fn() (preload 모킹)
//   Zustand store → 테스트마다 초기 상태 리셋
//   타이머 → vi.useFakeTimers() (스트리밍 throttle 테스트)
```

---

## Electron 최소 해상도
- 최소: 1024 × 768
- 권장: 1280 × 800
- 사이드바(팀원 목록) + 메인 패널(회의) 레이아웃

## 디자인 패턴 (이 프로젝트)

```typescript
// 1. Observer 패턴 — useAgentStream
// Main 프로세스의 스트리밍 이벤트를 구독하는 훅
//
// 적용: hooks/useAgentStream.ts
//   window.api.onAgentUpdate(callback) → 구독
//   return cleanup                     → 해제
//
// 왜 Observer인가:
//   - 에이전트 8개가 동시에 스트리밍 → 각 카드가 독립 구독
//   - 컴포넌트 마운트/언마운트에 따라 자동 구독/해제
//   - 발행자(Main)와 구독자(AgentCard)가 느슨하게 결합

// 2. State Machine 패턴 — AgentCard 5-상태
// 주의: Meeting.status와 AgentCard.status는 별개의 상태 기계
//   Meeting.status: 'idle' | 'running' | 'partial' | 'done' | 'error' (전체 회의)
//   AgentCard status: 'idle' | 'selected' | 'running' | 'done' | 'error' (개별 카드)
//   → 에이전트 1개 error여도 Meeting은 running (다른 에이전트 진행 중)
//   → 모든 에이전트 done/error 시 Meeting이 done 또는 partial로 전이
// 상태 전이가 명확히 정의된 유한 상태 기계
//
// 상태 전이:
//   idle → selected      (사용자 선택)
//   selected → running   (회의 시작)
//   running → done       (스트리밍 완료)
//   running → error      (에러 발생)
//   error → running      (재시도)
//   done → idle          (리셋)
//
// 적용: components/meeting/AgentCard.tsx
//   const cardVariants: Record<AgentStatus, string> = {
//     idle: 'border-slate-200',
//     selected: 'border-indigo-400 bg-indigo-50/50',
//     running: 'border-blue-400 animate-pulse',
//     done: 'border-green-400',
//     error: 'border-red-400',
//   };
//
// 왜 State Machine인가:
//   - 잘못된 전이 방지 (idle에서 done으로 직행 불가)
//   - 각 상태별 렌더링이 명확히 분리
//   - 디버깅 시 현재 상태와 전이 이력 추적 가능

// 3. Compound Component 패턴 — AgentCard 하위 구조
// 부모 컴포넌트가 컨텍스트를 제공하고, 자식이 선택적으로 소비
//
// 적용: components/meeting/AgentCard.tsx
//   <AgentCard member={member} status={status}>
//     <AgentCard.Header />        — 이름, 역할, 상태 아이콘
//     <AgentCard.StreamText />    — running 상태에서만 표시
//     <AgentCard.Result />        — done 상태에서만 표시
//     <AgentCard.Error />         — error 상태에서 retry 버튼 포함
//   </AgentCard>
//
// 왜 Compound인가:
//   - 상태별 내부 구조를 유연하게 교체 가능
//   - 각 하위 컴포넌트가 독립 테스트 가능
//   - AgentCard의 150줄 제한 준수 (하위로 분산)

// 4. Mediator 패턴 — Zustand Store
// 컴포넌트 간 직접 통신 대신 Store를 통해 중앙 조율
//
// 적용: stores/meetingStore.ts
//   MeetingSetupPage → meetingStore.setTopic()
//   MeetingSetupPage → meetingStore.setType()
//   MeetingRunPage ← meetingStore.status (구독)
//   AgentCard → meetingStore.updateResult()
//   MeetingProgress ← meetingStore.results (구독)
//
// 왜 Mediator인가:
//   - 컴포넌트가 서로를 모름 (느슨한 결합)
//   - 상태 변경 흐름이 Store 한 곳에서 추적됨
//   - selector로 필요한 상태만 구독 → 불필요한 리렌더 방지
```

---

## 회의 중 확인할 것
1. 이 UI가 컴포넌트로 어떻게 분해되는가?
2. 상태가 Zustand가 필요한가, useState로 충분한가?
3. 백엔드(메인 프로세스) IPC 인터페이스가 이 UI에 맞는가?
4. 5가지 카드 상태가 모두 처리됐는가?
5. 이 파일이 150줄을 넘는가? → 분할 필요
6. default export를 쓰고 있지 않은가?
7. 훅으로 추출할 로직이 컴포넌트 안에 남아있지 않은가?
8. ErrorBoundary 배치가 적절한가?

## 의견 형식
- **컴포넌트**: (어떤 컴포넌트로 분해하는가 — 폴더 위치 포함)
- **상태**: (로컬 useState / Zustand store / 훅 추출)
- **IPC**: (필요한 window.api 메서드)
- **모듈화**: (분할 기준, 재사용 가능 여부)
- **성능**: (memo 필요 여부, 스트리밍 최적화)
- **공수 및 우려**: (스트리밍 구현 난이도, Electron 제약)
