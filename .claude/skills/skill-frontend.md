# 개발자 (프론트엔드) 전문 스킬셋

## 컴포넌트 설계 원칙

### 컴포넌트 분류
```
Page        → 라우트 단위. 데이터 fetching 담당
Container   → 상태 관리 + 비즈니스 로직
Component   → 순수 UI. props만 받음 (재사용 가능)
Hook        → 상태/사이드이펙트 로직 분리
```

### 재사용성 체크리스트
- [ ] 이 컴포넌트가 다른 곳에서도 쓰일 수 있는가?
- [ ] props가 최소화됐는가? (불필요한 props 없음)
- [ ] 내부 상태가 꼭 필요한가? (vs 부모에서 관리)
- [ ] 디자인 시스템 컴포넌트를 쓰고 있는가?

### 컴포넌트 네이밍
- Page: `MeetingPage`, `TeamPage`
- 공통 UI: `Button`, `Card`, `Modal`
- 기능 컴포넌트: `TeamMemberCard`, `MeetingResultPanel`
- Hook: `useMeeting`, `useTeamMembers`, `useApiKey`

## 상태 관리

### 상태 위치 결정 원칙
```
로컬 UI 상태 → useState (이 컴포넌트만 씀)
  예) 모달 열림/닫힘, 입력 필드 값

공유 상태 → Zustand store (여러 컴포넌트가 씀)
  예) 팀원 목록, 현재 선택된 팀원, API 키

서버 상태 → React Query / SWR (서버 데이터 캐싱)
  예) API 응답 결과, 회의 기록
```

### Zustand Store 설계
```typescript
// 좋은 예
const useTeamStore = create<TeamStore>((set) => ({
  members: [],
  selectedIds: [],
  addMember: (member) => set((s) => ({ members: [...s.members, member] })),
  selectMember: (id) => set((s) => ({ selectedIds: [...s.selectedIds, id] })),
}));

// 피할 것: 하나의 store에 모든 것 넣기
```

## 성능 최적화

### 렌더링 최적화
- `React.memo`: props가 바뀌지 않으면 리렌더 안 함
- `useMemo`: 계산 비싼 값 캐싱
- `useCallback`: 함수 참조 안정화 (자식에 props로 넘길 때)
- 가상화: 긴 리스트는 `react-virtual` 사용

### 번들 사이즈 관리
- 코드 분할: `React.lazy()` + `Suspense`
- 트리 쉐이킹: named export 사용 (`import { Button }` not `import ui from 'ui'`)
- 이미지: WebP 포맷, lazy loading
- 목표: 초기 번들 < 200KB gzipped

### Electron 특화 최적화
- IPC 호출은 최소화 (Main ↔ Renderer 통신 비용)
- 파일 I/O는 메인 프로세스에서 (렌더러에서 직접 접근 금지)
- 메모리 누수: 이벤트 리스너 cleanup 필수

## 프론트엔드 체크리스트

### PR 제출 전 확인
- [ ] 컴포넌트가 독립적으로 동작하는가?
- [ ] 로딩/에러/빈 상태가 처리됐는가?
- [ ] 반응형(또는 Electron이면 최소 해상도)이 대응됐는가?
- [ ] 키보드 접근이 가능한가? (Tab, Enter, Escape)
- [ ] 콘솔 에러가 없는가?

### Electron IPC 패턴
```typescript
// 렌더러 → 메인: 파일 읽기 요청
const profiles = await window.api.readProfiles();

// 메인: 실제 파일 시스템 접근
ipcMain.handle('read-profiles', async () => {
  return fs.readFileSync(profilePath, 'utf-8');
});
```

## 팀 회의 중 프론트엔드 개발자 역할

**반드시 확인해야 할 것:**
1. UI 구조가 컴포넌트로 어떻게 분해되는가?
2. 상태를 어디서 관리하는가? (로컬 vs 전역)
3. 백엔드 API 인터페이스가 UI에 맞는가?
4. 구현 공수가 현실적인가?

**의견 제시 형식:**
- 컴포넌트 구조: (어떻게 나눌 것인가)
- 상태 관리: (어디서, 어떻게)
- API 연동: (인터페이스 맞는지, 변환 필요 여부)
- 공수 및 우려: (어렵거나 시간 많이 걸리는 부분)
