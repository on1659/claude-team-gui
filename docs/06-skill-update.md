# 스킬 업데이트 추적 문서

> 팀 에이전트 스킬 파일의 변경 이력과 남은 작업을 추적합니다.

---

## 변경 이력

### 2026-03-12 — 1차 스킬 강화

#### skill-ui.md (다은 · UI)
- [x] 디자인 스타일 방향 추가 (Linear/Raycast/Warp 톤)
- [x] 컬러 팔레트 정의 (Brand, Gray, Functional, Dark Mode)
- [x] 간격 시스템 (4px 그리드, 16토큰)
- [x] 보더 라디우스 스케일 (7단계)
- [x] 그림자/엘리베이션 시스템 (xs~xl)
- [x] 반응형 레이아웃 전략 강화

#### skill-frontend.md (미래 · FE)
- [x] 폴더 구조 정의 (src/renderer/)
- [x] 파일 네이밍 컨벤션
- [x] 컴포넌트 설계 원칙 (Presentational/Container, 크기 기준)
- [x] Custom Hooks 패턴 (useAgentStream, useMeeting)
- [x] Import 순서 규칙 (5그룹)
- [x] 에러 바운더리 전략 (3계층)
- [x] 코드 분할/성능 최적화
- [x] **디자인 패턴 섹션 추가** — Observer, State Machine, Compound Component, Mediator

#### skill-backend.md (태준 · BE)
- [x] 폴더 구조 정의 (src/main/ + src/shared/)
- [x] 모듈화 원칙 (3-Layer, 단방향 의존성)
- [x] 서비스 계층 패턴 (DI, AnthropicService)
- [x] IPC 핸들러 패턴 (registerAllHandlers)
- [x] Shared Types (IpcChannelMap, 채널 상수, 기본값)
- [x] 에러 처리 전략 (3단계)
- [x] **디자인 패턴 섹션 추가** — Observer, Strategy, Facade, Builder

#### meeting-team-profiles.md (전원)
- [x] **Critical Rules 추가** — 8명 전원에 각 직군별 절대 규칙 추가
- [x] **Communication Style 추가** — 8명 전원에 의사소통 스타일 추가

---

### 참고: agency-agents 레포 분석 결과

적용한 패턴:
- **Critical Rules**: 각 에이전트에 "절대로 해서는 안 되는 것" 명시 → meeting-team-profiles.md에 적용
- **Communication Style**: 역할별 의사소통 톤/형식 정의 → meeting-team-profiles.md에 적용

미적용 (부적합):
- Quality Gate: 에이전트 간 순차 검증 구조 → 우리는 병렬 실행이라 구조가 다름
- Handoff Template: 에이전트 간 작업 인수인계 → meeting-team에서는 동시 실행 후 통합이므로 불필요

---

### 2026-03-12 — 2차 정밀 검토 (10개 이슈 수정)

#### #1 [불일치] skill-ui.md 사이드바 크기 통일
- [x] 앱 레이아웃 섹션 200px → 240px 수정 (반응형 섹션과 통일)

#### #2 [누락] skill-pd.md — Quality Gate + 리스크 매트릭스
- [x] Quality Gate 섹션 추가 (M1/M2/M3 각 게이트 기준)
- [x] 리스크 매트릭스 추가 (6개 항목, 확률×영향×대응)
- [x] 회의 중 확인할 것 4개 → 8개 확장
- [x] 의견 형식에 Gate 영향/의존성 추가

#### #3 [누락] skill-qa.md — 테스트 자동화 + 데이터 관리 + 시나리오 확장
- [x] 테스트 자동화 전략 섹션 (자동/수동 구분, 도구)
- [x] 테스트 데이터 관리 섹션 (fixtures/ 구조)
- [x] 테스트 시나리오 5개 → 10개 확장
- [x] 회의 중 확인할 것 + 의견 형식 보강

#### #4 [누락] skill-frontend.md — 테스트 전략
- [x] 테스트 전략 섹션 추가 (컴포넌트/훅/스토어 테스트 패턴, Mock 규칙)

#### #5 [누락] skill-backend.md — 로깅 전략
- [x] 로깅 전략 섹션 추가 (구조화 로깅, 레벨별 대상, 보안 금지 항목)

#### #6 [누락] skill-ui.md — 아이콘 사용 가이드
- [x] lucide-react 아이콘 매핑 (팀원/회의/설정/상태별)
- [x] 크기 규칙 (인라인/버튼/카드/빈상태)
- [x] 접근성 (aria-hidden, aria-label, sr-only)

#### #7 [누락] skill-ux.md — 마이크로카피 + 단축키
- [x] 마이크로카피 가이드 (버튼 라벨, placeholder, 상태 메시지, 에러 공식)
- [x] 키보드 단축키 맵 (전역/네비게이션/카드)

#### #8 [보강] skill-planner-research.md — 정량 기준 강화
- [x] 성공 지표 테이블화 (5개 지표 + 측정 방법 + 시점)
- [x] 기능 검증 체크리스트 5가지 추가
- [x] 회의 중 확인할 것 + 의견 형식 보강

#### #9 [보강] skill-planner-strategy.md — 경쟁 분석 프레임워크
- [x] 경쟁 분석 프레임워크 추가 (직접/간접 경쟁, 비교 축, 차별화 포인트)
- [x] 회의 중 확인할 것 + 의견 형식 보강

#### #10 추적 문서 업데이트
- [x] 이 문서에 2차 작업 내용 반영

---

### 2026-03-12 — 3차 교차 비교 (10개 불일치 수정)

스킬 파일 간 교차 비교를 통해 용어, 상태값, 정책, 데이터 흐름의 불일치 10건 식별 및 수정.

#### #1 [불일치] AgentResult.status 값 통일
- [x] skill-backend.md: `'success'` → `'done'` (FE 카드 상태와 통일)
- [x] `elapsedMs` 필드 추가 (UX 투명성 — 응답 소요 시간 표시용)

#### #2 [누락] skill-backend.md — NetworkError 클래스
- [x] 에러 처리 전략에 `NetworkError` 클래스 추가 (기존: AgentTimeoutError, RateLimitError만)

#### #3 [불일치] Meeting.status vs AgentCard.status 혼동 방지
- [x] skill-frontend.md State Machine 패턴에 두 상태 기계 구분 주석 추가
  - Meeting.status: `'idle' | 'running' | 'partial' | 'done' | 'error'` (전체 회의)
  - AgentCard status: `'idle' | 'selected' | 'running' | 'done' | 'error'` (개별 카드)
  - 에이전트 1개 error여도 Meeting은 running 가능

#### #4 [불일치] skill-ux.md 톤 불일치 (합니다체 → 해요체)
- [x] 오류 UX 원칙 섹션의 Good 예시를 해요체로 통일
  - "올바르지 않습니다" → "유효하지 않아요"
  - "재시도합니다" → "재시도해요"

#### #5 [보강] skill-backend.md — retry 정책 상세화
- [x] Anthropic API 섹션에 에러 유형별 retry 정책 테이블 추가
  - 타임아웃 3회/2초, 레이트리밋 3회/exponential, 네트워크 0회, 인증 0회, 알 수 없음 2회

#### #6 [불일치] skill-frontend.md — lib/ipc.ts 래퍼 예외 명시
- [x] IPC 패턴 섹션에 onAgentUpdate 예외 주석 추가
  - invoke(요청-응답) → lib/ipc.ts 래퍼 사용
  - on(이벤트 구독) → useAgentStream 훅에서 window.api 직접 호출 (cleanup 관리)

#### #7 [보강] skill-backend.md — 성능 목표 명확화
- [x] 성능 목표 테이블에 "목표 vs 한계" 열 분리
  - 8 에이전트 병렬: 60초 목표(QA/PD 기준), 120초 초과 시 전체 타임아웃

#### #8 [불일치] BE↔FE 데이터 형식 차이 문서화
- [x] skill-frontend.md Zustand Store에 변환 주석 추가
  - BE: `results: AgentResult[]` (배열) → FE: `results: Map<string, AgentResult>` (Map)
  - 변환: meetingStore 액션 내부에서 `new Map(results.map(r => [r.memberId, r]))`

#### #9 [보강] skill-backend.md — 에러 핸들러 케이스 확장
- [x] 네트워크 끊김, 인증 실패(401), 토큰 초과(400) 케이스 추가

#### #10 추적 문서 업데이트
- [x] 이 문서에 3차 작업 내용 반영

---

### 2026-03-12 — 4차 데이터 흐름 정합성 검토 (10개 이슈 수정)

스킬 파일 간 데이터 흐름, 상수, 타입, 시그널 경로의 정합성을 검증하여 10건 수정.

#### #1 [불일치] skill-qa.md 타임아웃 retry 횟수
- [x] "retry 1회" → "retry 최대 3회 (2초 간격)" (skill-backend.md와 통일)

#### #2 [불일치] skill-qa.md 네트워크 끊김 처리
- [x] "받은 내용 저장, 에러 표시" → "NetworkError → 전체 중단 + 자동 재연결 대기 (retry 없음)"

#### #3 [불일치] meeting-team-profiles.md 미래 Critical Rule 예외
- [x] "window.api 직접 호출 금지" 룰에 "(예외: onAgentUpdate 이벤트 구독은 훅에서 직접)" 추가

#### #4 [누락] skill-backend.md defaults.ts 상수 추가
- [x] `MEETING_TIMEOUT_MS: 120_000` (전체 회의 hard limit)
- [x] `NETWORK_POLL_MS: 3_000` (네트워크 재연결 감지 polling 간격)

#### #5 [불일치] skill-qa.md 상태 다이어그램 범위
- [x] Meeting.status와 AgentCard status를 구분하여 재작성
  - Meeting: done → running 불가
  - AgentCard: error → running 허용 (retry)

#### #6 [불일치] AgentStatus 타입 위치 통일
- [x] skill-frontend.md: `@/types/renderer` → `@shared/types/agent` 로 변경
- [x] skill-backend.md: agent.ts 주석에 "(BE/FE 공유)" 명시

#### #7 [누락] 회의 완료 시그널 흐름 문서화
- [x] skill-backend.md IPC 핸들러에 5단계 시그널 흐름 주석 추가
- [x] skill-frontend.md useMeeting 훅에 long-running invoke 패턴 주석 추가
  - invoke Promise 해결 = 전체 회의 완료 (별도 meeting-complete 이벤트 불필요)

#### #8 [불일치] skill-ux.md 네트워크 polling 간격 BE 연동
- [x] skill-backend.md defaults.ts에 `NETWORK_POLL_MS: 3_000` 추가 (#4에서 함께 처리)

#### #9 [보강] skill-qa.md 성능 기준 120초 hard limit
- [x] "정상 완료 60초 내" → "목표 60초 내, 120초 초과 시 전체 타임아웃"

#### #10 추적 문서 업데이트
- [x] 이 문서에 4차 작업 내용 반영

---

## 현재 상태 요약

| 스킬 파일 | 1차 | 2차 | 3차 | 4차 | 상태 |
|-----------|-----|-----|-----|-----|------|
| skill-pd.md (지민) | 디자인 패턴 | +3 섹션 | — | — | 완료 |
| skill-planner-research.md (현우) | — | +2 섹션 | — | — | 완료 |
| skill-planner-strategy.md (소연) | — | +1 섹션 | — | — | 완료 |
| skill-backend.md (태준) | +3 섹션 | 로깅 전략 | +5 수정 | +3 수정 | 완료 |
| skill-frontend.md (미래) | +3 섹션 | 테스트 전략 | +3 수정 | +2 수정 | 완료 |
| skill-qa.md (윤서) | — | +3 섹션 | — | +4 수정 | 완료 |
| skill-ui.md (다은) | +6 섹션 | +1 수정 + 아이콘 | — | — | 완료 |
| skill-ux.md (승호) | — | +2 섹션 | 톤 통일 | — | 완료 |
| meeting-team-profiles.md | +16 항목 | — | — | +1 수정 | 완료 |

## 남은 작업

| 항목 | 대상 파일 | 상태 |
|------|-----------|------|
| (현재 식별된 추가 작업 없음) | — | — |
