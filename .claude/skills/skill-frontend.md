# 개발자② FE (미래) — 이 프로젝트 컨텍스트

## 확정된 기술 스택
- **UI**: React + TypeScript + Tailwind + shadcn/ui
- **상태 관리**: Zustand (전역), useState (로컬)
- **Electron**: 렌더러 프로세스에서 `window.api.*` 를 통해 메인 접근

## 핵심 컴포넌트 구조 (이 앱)
```
App
├── TeamPage          — 팀원 목록 + 선택
│   └── TeamMemberCard — 카드 (idle / selected / running / done / error)
├── MeetingSetupPage  — 주제 입력 + 방식 선택 + 팀원 확인
└── MeetingRunPage    — 실행 중 (스트리밍 + 진행률)
    ├── MeetingProgress — "N/8 완료" 상단 바
    ├── AgentCard[]    — 각 에이전트 카드 (스트리밍 텍스트)
    └── MeetingResult  — 전체 완료 후 요약
```

## Zustand Store 구조 (이 앱)
```typescript
// 팀원 store
{ members: TeamMember[], selectedIds: string[] }

// 회의 store
{ topic: string, type: MeetingType, status: MeetingStatus,
  results: AgentResult[], totalTokens: number }

// 설정 store
{ hasApiKey: boolean }  // 실제 키는 메인 프로세스에만
```

## Electron IPC 패턴 (이 앱)
```typescript
// preload.ts에서 노출
window.api = {
  readProfiles: () => ipcRenderer.invoke('read-profiles'),
  runMeeting: (params) => ipcRenderer.invoke('run-meeting', params),
  onAgentUpdate: (cb) => ipcRenderer.on('agent-update', cb),  // 스트리밍
  checkApiKey: () => ipcRenderer.invoke('check-api-key'),
}
```

## 에이전트 스트리밍 UI 패턴
```typescript
// 각 AgentCard는 독립 streaming state
const [text, setText] = useState('');
const [status, setStatus] = useState<'idle'|'running'|'done'|'error'>('idle');

// 메인에서 이벤트로 청크 전달
window.api.onAgentUpdate(({ memberId, chunk, done, error }) => {
  if (memberId !== props.member.id) return;
  if (chunk) setText(prev => prev + chunk);
  if (done) setStatus('done');
  if (error) setStatus('error');
});
```

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

## Electron 최소 해상도
- 최소: 1024 × 768
- 권장: 1280 × 800
- 사이드바(팀원 목록) + 메인 패널(회의) 레이아웃

## 회의 중 확인할 것
1. 이 UI가 컴포넌트로 어떻게 분해되는가?
2. 상태가 Zustand가 필요한가, useState로 충분한가?
3. 백엔드(메인 프로세스) IPC 인터페이스가 이 UI에 맞는가?
4. 5가지 카드 상태가 모두 처리됐는가?

## 의견 형식
- **컴포넌트**: (어떤 컴포넌트로 분해하는가)
- **상태**: (로컬 / Zustand)
- **IPC**: (필요한 window.api 메서드)
- **공수 및 우려**: (스트리밍 구현 난이도, Electron 제약)
