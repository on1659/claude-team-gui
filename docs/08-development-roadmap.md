# Claude Team GUI — Development Roadmap v1.0

> 작성일: 2026-03-24
> 작성 방법: 8인 멀티에이전트 회의 (기획x2, 개발x2, QA, UI, UX, PD) 결과 종합
> 타겟: AI 관심 개발자 (1차)

---

## 1. 현재 상태 진단

### 있는 것
| 기능 | 상태 | 파일 |
|------|------|------|
| MeetingSummary 정형 스키마 | O | `types/messages.ts` |
| Markdown 저장 (수동) | O | `services/meeting-result-store.ts` |
| 멀티 LLM (Anthropic/OpenAI/Gemini) | O | `providers/` |
| 아이소메트릭 오피스 시각화 | O | `webview/panel/game/` |
| 실시간 스트리밍 회의 | O | `services/meeting-service.ts` |

### 없는 것 (핵심 문제)
| 부재 | 영향 |
|------|------|
| 회의 → 작업 연결 파이프라인 | "ChatGPT와 뭐가 달라?" |
| GitHub Issue 연동 | 결과물이 텍스트로 끝남 |
| 코드 컨텍스트 주입 | AI가 내 코드를 모르고 일반론만 말함 |
| 회의 템플릿 | 매번 처음부터 설정해야 함 |
| 온보딩 플로우 | 첫 실행 경험 부재 |

### 핵심 진단 한 줄
> **"경험은 팔리는데 결과가 안 팔린다."** 기술 완성도 90%이지만 제품 완성도는 50%.

---

## 2. 제품 포지셔닝

### 한 문장 정의
> "코드 앞에서 막혔을 때, ChatGPT에 혼자 묻는 대신 — 관점이 다른 AI 전문가 8명이 당신의 코드를 보고 동시에 토론한다."

### 차별화 축 2가지
1. **다양한 관점의 동시성** — 1:1 대화가 줄 수 없는 것
2. **내 코드를 아는 AI** — 범용 챗봇이 할 수 없는 것

### 핵심 사용자 시나리오

| 시나리오 | 설명 | 차별 요소 |
|----------|------|-----------|
| **A. 아키텍처 결정 전 브리핑** | 파일 2~3개 선택 → "이 구조로 가도 되냐?" 회의 | 코드를 보고 보안/성능/UX 관점 동시 리뷰 |
| **B. PR 올리기 전 크리틱** | 변경 파일 → "뭔가 빠진 거 없냐?" 회의 | 리뷰어 없어도 리뷰받은 것처럼 |
| **C. 막힌 버그 토론** | 관련 파일 → "왜 이게 안 되냐?" 회의 | 서로 다른 가설을 주장/반박 |

---

## 3. 로드맵

### Phase 1 — "첫 번째 진짜 사용자" (2026-03-24 ~ 04-04, 12일)

**목표: 내가 실제로 써서 GitHub Issue까지 만드는 시나리오 1개 완성**

| 순서 | 기능 | 기간 | 상세 |
|------|------|------|------|
| 1 | 코드 컨텍스트 주입 | 3일 | 열린 파일 목록 + git branch + 최근 커밋 3개를 에이전트 프롬프트에 자동 삽입. 파일 내용은 넣지 않고 파일명+언어+라인수만 요약 (토큰 제어) |
| 2 | 액션아이템 스키마 강화 | 2일 | `nextActions: string[]` → `ActionItem{ task, assignee?, priority, dueDate? }[]`. LLM JSON 강제 출력 + Zod 런타임 검증 + fallback |
| 3 | GitHub Issue 원클릭 생성 | 5일 | `vscode.authentication.getSession('github')` → GitHub REST API. Extension Host에 `GitHubService` 신설. Webview → Host 메시지 패싱 |
| - | ~~워크스페이스 자동 저장~~ | 보류 | Phase 2로 이동 |
| - | ~~온보딩 플로우~~ | 보류 | Phase 2로 이동 |

**기술 포인트:**
- 컨텍스트 주입: `vscode.window.activeTextEditor` + `child_process.exec('git log --oneline -3')`
- JSON 강제 출력: OpenAI `response_format`, Anthropic `prefill`, Gemini `responseMimeType` 각각 처리
- GitHub 인증: VS Code 내장 GitHub 인증 활용 (OAuth 직접 구현 회피)
- 현재 레포 감지: `git remote get-url origin` 파싱 → owner/repo 추출

**Phase 1 완료 기준 (KPI):**
- [ ] 자기 프로젝트에서 회의 1회 진행 → GitHub Issue 3개 이상 생성
- [ ] 생성된 Issue를 수정 없이 바로 사용 가능한 품질
- [ ] 회의 중 에이전트가 현재 코드 컨텍스트를 인지하고 있음이 확인됨

---

### Phase 2 — "5명의 사용자" (2026-04-05 ~ 04-25, 3주)

**목표: 외부 사용자 5명이 가이드 없이 혼자 쓸 수 있는 상태**

| 순서 | 기능 | 기간 | 상세 |
|------|------|------|------|
| 1 | 워크스페이스 자동 저장 + 히스토리 | 4일 | 회의 완료 시 `docs/meetings/YYYY-MM-DD-{topic}.md` 자동 생성. 이전 회의 agreements를 다음 회의 컨텍스트로 자동 연결 |
| 2 | 회의 템플릿 2종 | 5일 | 아키텍처 리뷰 / 버그 트리아지. JSON 외부화 `.claude/meeting-templates/`. 스키마: `{ id, name, roles, outputFormat, systemPromptOverride? }` |
| 3 | UX 개선 — "Moment of Action" | 4일 | 회의 완료 후 전환 화면: 액션아이템 카드 → [Issue 내보내기] [파일 저장] CTA. 컨텍스트 배지 ("파일 3개 감지됨") |
| 4 | 사용자 피드백 수집 | 1주 | 5명 초대, 실사용 관찰, 피드백 정리. 개발 병행 아님 |

**Phase 2 완료 기준 (KPI):**
- [ ] 5명 중 3명 "다음 주에도 쓰겠다" 응답
- [ ] 사용자가 스스로 템플릿 선택 → 회의 시작 가능 (가이드 없이)
- [ ] README만 보고 5분 안에 첫 회의 시작 가능

---

### Phase 3 — "Marketplace 출시" (2026-04-26 ~ 05-10, 2주)

**목표: VS Code Marketplace 공개**

| 항목 | 상세 |
|------|------|
| 온보딩 플로우 | GitHub Token 안내 + 샘플 회의 1회 자동 실행 |
| 설치 후 5분 경험 보장 | 첫 실행 → 템플릿 선택 → 3분 회의 → Issue 생성까지 |
| README + 데모 영상 | GIF 3개 (회의 진행 / Issue 생성 / 컨텍스트 주입) |
| 템플릿 1종 추가 | 스프린트 계획 |
| 안정화 + 엣지케이스 수정 | Phase 2 피드백 기반 |

**출시 기준 (3가지 모두 충족):**
1. **혼자 써도 유용** — 주 1회 이상 실제 사용
2. **결과물이 연결됨** — 회의 → Issue → 커밋으로 이어진 사례 1건+
3. **타인이 설치 가능** — README만 보고 5분 안에 첫 회의 완료

---

## 4. 절대 하지 않을 것

| 유혹 | 이유 |
|------|------|
| 범용 에이전트 실행 (OpenClaw 방향) | 1인 개발로 불가능. 제품이 없어진다 |
| 아이소메트릭 UI 추가 개선 | 이미 충분한 차별점. 여기에 더 쓰는 건 낭비 |
| 비개발자 타겟 확장 | Phase 3 이후 재검토 |
| 멀티 LLM 추가 (Llama, Mistral 등) | 3사면 충분. 유지보수 부채만 증가 |

---

## 5. 기술 상세

### 5.1 액션아이템 스키마

```typescript
// Before
interface MeetingSummary {
  agreements: string[];
  conflicts: { topic: string; opinions: string[] }[];
  nextActions: string[];  // ← 자유 텍스트
}

// After
interface ActionItem {
  task: string;
  assignee?: string;      // GitHub 유저명
  priority: 'P1' | 'P2' | 'P3';
  dueDate?: string;       // ISO 8601
}

interface MeetingSummary {
  agreements: string[];
  conflicts: { topic: string; opinions: string[] }[];
  decisions: string[];           // 신규: 명확한 결정사항 분리
  actionItems: ActionItem[];     // 변경: 정형화
  unresolvedItems?: string[];    // 신규: 미결사항
}
```

### 5.2 GitHub Issue 생성 흐름

```
[Webview]                    [Extension Host]              [GitHub API]
    |                              |                            |
    |-- CREATE_ISSUE(ActionItem) ->|                            |
    |                              |-- getSession('github') ->  |
    |                              |<- accessToken -------------|
    |                              |-- POST /repos/o/r/issues ->|
    |                              |<- 201 { html_url } --------|
    |<- ISSUE_CREATED(url) --------|                            |
    |                              |                            |
```

### 5.3 코드 컨텍스트 주입 구조

```typescript
interface WorkspaceContext {
  openFiles: { path: string; language: string; lines: number }[];
  gitBranch: string;
  recentCommits: { hash: string; message: string }[];  // 최근 3개
  gitDiff?: string;  // staged diff 요약 (500자 제한)
}
```

**토큰 제어 규칙:**
- 파일 내용은 주입하지 않음 (파일명+메타데이터만)
- 커밋 메시지 최근 3개만
- git diff는 500자로 truncate
- 8명 에이전트 전원에게 동일 컨텍스트 1회 주입

### 5.4 회의 템플릿 스키마

```typescript
interface MeetingTemplate {
  id: string;
  name: string;                    // "아키텍처 리뷰"
  description: string;
  icon: string;                    // Codicon name
  roles: {
    role: string;
    expertise: string;
    perspective: string;           // 에이전트 시스템 프롬프트 보강
  }[];
  outputFormat: 'standard' | 'review' | 'triage';
  systemPromptOverride?: string;
}
```

---

## 6. UI/UX 설계 가이드

### 6.1 공통 원칙
| 원칙 | 규칙 |
|------|------|
| 컬러 | `var(--vscode-*)` 토큰 100%. 하드코딩 금지 |
| 타이포 | 호스트 주입 폰트 그대로 |
| 애니메이션 | 200ms 이하, ease-out |
| z-index | 토스트/다이얼로그는 게임 캔버스보다 상위 (z-index: 9999) |
| 접근성 | 하이컨트라스트 + 키보드 네비게이션 필수 |

### 6.2 신규 컴포넌트

**액션아이템 카드**
```
[ ☐ ] [ P1 ] 액션 내용 텍스트 .............. [ → GitHub ]
```
- 높이 36px, 수평 행. 우선순위 뱃지 컬러: P1=error, P2=warning, P3=default

**GitHub Issue 다이얼로그**
- 사이드 패널 슬라이드인 (width: 360px, 오른쪽)
- 모달 아님 (VS Code 패러다임 준수)

**자동 저장 토스트**
- 우측 하단, 2.5초 후 fade-out, 최대 3개 스택

**컨텍스트 배지**
- 회의 시작 버튼 옆 "파일 3개 감지됨" 배지. 클릭 시 드롭다운 상세

### 6.3 사용자 여정 (After)

```
[준비] 템플릿 선택(1-클릭) → 역할 미리보기(수정 가능, 기본값으로 넘어감)
  ↓   컨텍스트 배지 ("파일 3개 감지됨" — 클릭 시 상세)
[진행] 회의 시작 → 에이전트 발언 → 아이소메트릭 오피스 시각화
[전환] 회의 완료 → "Moment of Action" 화면
  →   액션아이템 카드 자동 분류
  →   [GitHub Issue로 내보내기] [파일로 저장] — CTA
[완료] 선택 실행 → 확인 토스트 → 사이드바 복귀
```

---

## 7. QA 전략

### Phase 1 테스트

| 대상 | 방법 | 자동화 |
|------|------|--------|
| 스키마 파싱 | Zod 검증 + LLM 응답 샘플 20건 | 100% |
| GitHub API 에러 처리 | MSW Mock (201/401/403/429/500) | 90% |
| 토큰 만료 시나리오 | 실제 계정 E2E 1회 | 수동 |
| 컨텍스트 토큰 제어 | 파일 크기 경계값 (1K/1M/10M/50M/100M+) | 100% |

### 엣지케이스 체크리스트

- [ ] LLM이 필수 필드 누락 시 fallback 동작
- [ ] 토픽명 특수문자 (`feat/login: OAuth & "Google"`) → 파일명 변환
- [ ] Windows 예약어 (CON, PRN, AUX) 토픽명
- [ ] 빈 워크스페이스에서 컨텍스트 주입
- [ ] 바이너리 파일이 열려있을 때 컨텍스트 수집
- [ ] GitHub rate limit (429) 처리 + 사용자 알림
- [ ] 오프라인 상태에서 Issue 생성 시도

---

## 8. 주요 쟁점 & 결정

| 쟁점 | 결정 | 이유 |
|------|------|------|
| GitHub Issue vs 코드 컨텍스트 우선순위 | **코드 컨텍스트 먼저** | Issue 품질은 회의 품질에 의존. 컨텍스트가 회의 품질을 올림 |
| OAuth 직접 구현 vs VS Code 내장 활용 | **VS Code 내장** | 구현 시간 3배 차이. 내장 인증으로 충분 |
| 파일 내용 주입 여부 | **메타데이터만** | 8명 x 파일 내용 = 토큰 폭발. 파일명+언어+라인수로 충분 |
| 워크스페이스 저장 시점 | **Phase 2로 이동** | Phase 1은 Issue 생성에 집중. 저장은 차별화 요소 아님 |
| 템플릿 종류 | **2종 먼저** (아키텍처/버그) | 3종 이상은 선택 피로. 사용 데이터 보고 추가 |

---

## 9. 타임라인 요약

```
03/24 ─────── Phase 1: "첫 번째 진짜 사용자" ─────── 04/04
              컨텍스트 주입(3d) → 스키마(2d) → GitHub Issue(5d)
              KPI: 자기 프로젝트에서 Issue 3개 생성

04/05 ─────── Phase 2: "5명의 사용자" ──────────── 04/25
              자동저장(4d) → 템플릿(5d) → UX개선(4d) → 피드백(1w)
              KPI: 5명 중 3명 "다음 주에도 쓰겠다"

04/26 ─────── Phase 3: "Marketplace 출시" ─────── 05/10
              온보딩 → README → 데모 → 안정화
              KPI: README만 보고 5분 안에 첫 회의 완료
```

**총 예상 기간: ~7주 (2026-05-10 출시 목표)**

---

## 10. 회의 참여자 핵심 발언 요약

| 역할 | 핵심 한 줄 |
|------|------------|
| 기획#1 | "90%는 기술 완성도이지 제품 완성도가 아니다. 온보딩 플로우가 반드시 필요" |
| 기획#2 | "사용자는 '더 나은 답'을 원하는데 우리는 '더 편한 기록'을 만들고 있다" |
| 개발#1 | "스키마 먼저 굳히고 → 컨텍스트 → GitHub 순서가 기술 부채 없이 안전" |
| 개발#2 | "Webview→Extension 메시지 패싱 correlationId 없으면 콜백 지옥" |
| QA | "지금 필요한 건 기능 추가가 아니라 출력 스펙 정의. 형식 없으면 품질 없다" |
| UI | "var(--vscode-*) 100% 사용, 하드코딩 금지. 하이컨트라스트 필수" |
| UX | "회의 완료 후 'Moment of Action' 전환 화면이 핵심 가치를 증명할 자리" |
| PD | "기능이 아니라 시나리오 1개를 완성하라. 그게 작동하면 나머지는 쌓인다" |
