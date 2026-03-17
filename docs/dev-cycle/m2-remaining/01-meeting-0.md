# 🏁 [M2 잔여 작업] — 팀 회의 결과 (사이클 #0)

╔══════════════════════════════════════════╗
║  🔵 개발 사이클: m2-remaining            ║
║  현재 단계: MEETING 완료                  ║
║  반복: 0/3                               ║
╚══════════════════════════════════════════╝

## 대상 기능
M2(회의 실행 엔진) 마일스톤 잔여 작업:
1. **ProgressBar.tsx** — MeetingHeader에서 분리하여 독립 컴포넌트화
2. **SummaryView.tsx** — 회의 요약 전용 컴포넌트 (현재 App.tsx 인라인)
3. **MeetingSummary 자동 생성** — `buildQuickSummary()`/`buildDeepSummary()`에서 agreements/conflicts/nextActions 빈 배열 해소
4. **M2 Quality Gate** — 11개 체크리스트 충족 확인

---

## 팀원별 의견

### 지민 (PD)
M2 Gate 기준으로 검토하면 핵심 미충족 항목은 3개: ProgressBar 분리, SummaryView 독립, MeetingSummary 자동 생성. 나머지 8개 항목(Quick/Deep E2E, 6-state 전이, seq 연속, rAF 배치, 부분실패 격리, AbortController, 재시작, 낙관적 UI)은 코드상 구현 완료 상태지만, **버그 3건이 Gate 통과를 위협**한다.

- **일정 영향**: 3~3.5일 예상. ProgressBar/SummaryView는 1일, MeetingSummary LLM 호출은 1.5~2일.
- **범위 판단**: 전부 v1/M2 범위 내. 추가 스코프 없음.
- **Gate 영향**: M2 Gate 항목 중 "8 에이전트 병렬 실행" 관련 combinedSignal 버그는 반드시 수정 필요.
- **리스크**: MeetingSummary LLM 추가 호출 시 비용 증가 — low tier 모델로 제한 권장.

### 현우 (기획자① — 리서치)
사용자 관점에서 가장 필요한 건 **SummaryView**. 현재 회의가 끝나면 비용/시간만 보이는데, 핵심 합의사항이나 액션아이템이 보여야 사용자가 회의 결과를 활용할 수 있다.

- 합의점/충돌/액션아이템은 **구조화된 형태**로 보여야 함 (단순 텍스트 나열 X)
- 액션아이템에는 담당자(팀원 이름)가 매핑되면 가장 좋다
- "다운로드/복사" 기능은 v2로 분류

### 소연 (기획자② — 전략)
MeetingSummary 자동 생성의 **기술적 접근법**이 핵심 의사결정 사항. 두 가지 옵션:
1. **정규식 파싱** — 비용 0, 하지만 LLM 출력 형식 의존도 높아 불안정
2. **LLM 추가 호출** — low tier 모델로 비용 최소화, 품질 안정적

→ **LLM 추가 호출 권장**. 정규식은 유지보수 부담이 크고, 프롬프트 변경 시마다 파싱 로직 수정 필요.

### 태준 (개발자① — BE)
`meeting-service.ts` 현재 버그 3건 발견:

1. **combinedSignal 결함** (L229): `signal.aborted ? signal : timeoutController.signal` — parent abort가 이미 발생한 경우에만 parent signal 사용. 정상 경우엔 timeoutController.signal만 전달되므로 parent abort가 provider stream에 전파 안 됨. `onParentAbort` 리스너가 있지만 타이밍 이슈.
   - **수정안**: `AbortSignal.any([signal, timeoutController.signal])` 사용 (Node 20+) 또는 수동 복합 시그널.
2. **retrying 라벨 버그** (AgentCard L64): `${state.attempt}/${state.attempt}` — 분모도 현재 시도 횟수. `maxRetry`가 필요.
3. **cancelled 상태 미사용**: `AgentState`에 `cancelled` 타입 정의됐으나, `meetingCancelled` 핸들러가 `idle`로 리셋.

MeetingSummary LLM 추가 호출 구현:
- `buildQuickSummary`/`buildDeepSummary` 내부에서 모든 에이전트 응답을 concat → low tier 모델에 요약 요청
- 새 private method `generateSummaryViaLLM(allResponses: string): Promise<{agreements, conflicts, nextActions}>`
- 프롬프트: "다음 팀 회의 내용에서 합의점, 충돌점, 액션아이템을 JSON으로 추출하라"

### 미래 (개발자② — FE)
UI 컴포넌트 설계 의견:

**ProgressBar.tsx**:
- props: `progress: number`, `phase: 'running' | 'done' | 'cancelled'`
- ARIA 속성 필수: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- 애니메이션: transition 0.3s ease 유지, done 상태에서 성공 색상
- `data-testid="progress-bar"` 추가

**SummaryView.tsx**:
- 프로그레시브 디스클로저: 기본은 접힌 상태, 클릭으로 펼침
- 섹션 3개: 합의점(agreements), 충돌점(conflicts), 액션아이템(nextActions)
- 비용/시간 정보는 하단 메타 영역에 유지
- 빈 배열이면 "요약 생성 중..." 또는 해당 섹션 숨김
- 컬러 코딩: 합의=success, 충돌=warning, 액션=info

### 윤서 (QA)
**M2 Quality Gate 11항목 검증 계획**:

| # | 항목 | 현재 상태 | 비고 |
|---|------|---------|------|
| 1 | Quick 모드 E2E | ✅ 구현됨 | 실제 API 테스트 필요 |
| 2 | Deep 모드 E2E | ✅ 구현됨 | 실제 API 테스트 필요 |
| 3 | AgentCard 6-state 전이 | ⚠️ cancelled 미사용 | 버그 |
| 4 | seq 연속성 | ⚠️ retry 시 seq 리셋 문제 | 버그 |
| 5 | rAF 배치 렌더 | ✅ useChunkBuffer | 정상 |
| 6 | 부분 실패 격리 | ✅ 구현됨 | 정상 |
| 7 | AbortController 취소 | ⚠️ combinedSignal 결함 | 버그 |
| 8 | 취소 후 재시작 | ✅ 구현됨 | combinedSignal 수정 후 재검증 |
| 9 | 낙관적 UI | ✅ 구현됨 | 정상 |
| 10 | seq gap 경고 | ✅ 구현됨 | 정상 |
| 11 | 30+ msg/sec 무손실 | ✅ useChunkBuffer | 스트레스 테스트 필요 |

→ **3건 버그 수정 후 재검증 필수**. 특히 combinedSignal은 CRITICAL.

### 다은 (UI)
ProgressBar 디자인 토큰:
- 높이: 3px (현행 유지, 비침투적)
- 배경: `--color-border-subtle`
- 활성: `--color-state-active` (running), `--color-state-success` (done)
- 보더 라디우스: 2px
- 트랜지션: `width 0.3s ease`

SummaryView 디자인:
- 카드 형태: `border: 1px solid var(--color-border-subtle)`, `background: var(--color-bg-elevated)`
- 섹션 헤더: 12px semi-bold, 아이콘 prefix
- 합의점: ✅ 아이콘 + `--color-state-success`
- 충돌점: ⚠️ 아이콘 + `--color-state-warning`
- 액션아이템: 📌 아이콘 + `--color-state-info`
- 접기/펼치기: chevron 아이콘 회전 애니메이션

### 승호 (UX)
접근성 + 사용자 흐름:

**ProgressBar 접근성**:
- `role="progressbar"` 필수
- `aria-valuenow={progress}`, `aria-valuemin={0}`, `aria-valuemax={100}`
- `aria-label="회의 진행률"` — 스크린리더 지원
- 완료 시 "회의 완료" 알림 (`aria-live="polite"` 또는 toast)

**SummaryView UX 흐름**:
1. 회의 완료 → 자동으로 요약 카드 나타남 (fade-in)
2. 기본 접힌 상태: 비용/시간 + "요약 보기" 버튼
3. 펼치면: 합의점 → 충돌점 → 액션아이템 순서
4. 각 아이템은 불릿 리스트로 가독성 확보
5. 빈 섹션은 숨김 (빈 상태 메시지 불필요)

**MeetingSummary 로딩 UX**:
- 회의 완료 후 LLM 요약 호출 중이면: 스켈레톤 로더 표시
- 실패 시: "요약을 생성할 수 없습니다" + retry 버튼
- 소요 시간 기대치: low tier 모델이라 2~5초

---

## 주요 합의점

1. **MeetingSummary는 LLM 추가 호출로 생성** — 정규식 파싱이 아닌 low tier 모델 사용 (소연, 태준, 현우 동의)
2. **ProgressBar에 ARIA 속성 필수** (미래, 승호, 다은 동의)
3. **SummaryView는 프로그레시브 디스클로저** — 기본 접힘, 클릭 펼침 (미래, 승호, 다은 동의)
4. **combinedSignal 버그는 CRITICAL로 즉시 수정** (태준, 윤서 동의)
5. **retrying 라벨, cancelled 상태도 함께 수정** (태준, 윤서 동의)

## 주요 충돌 지점

| 항목 | 의견 A | 의견 B |
|------|--------|--------|
| SummaryView 초기 상태 | 승호: 접힌 상태 | 현우: 펼쳐진 상태가 정보 접근성 좋음 |
| 요약 실패 시 UI | 승호: retry 버튼 | 미래: 실패 시 비용/시간만 보여주기 (현행 fallback) |

→ **결론**: 기본 접힌 상태 채택 (Panel 공간 절약). 요약 실패 시 비용/시간 fallback + retry 버튼 병행.

## 역할별 작업 항목 정리

| 담당자 | 역할 | 작업 항목 | 선행 작업 |
|--------|------|---------|---------|
| 태준 | BE | combinedSignal 버그 수정 | 없음 |
| 태준 | BE | `generateSummaryViaLLM()` 구현 | 없음 |
| 태준 | BE | `buildQuickSummary`/`buildDeepSummary` LLM 호출 연동 | generateSummaryViaLLM |
| 미래 | FE | ProgressBar.tsx 분리 + ARIA | 없음 |
| 미래 | FE | SummaryView.tsx 구현 | MeetingSummary 타입 확정 |
| 미래 | FE | retrying 라벨 버그 수정 | 없음 |
| 미래 | FE | cancelled 상태 연결 | 없음 |
| 윤서 | QA | M2 Gate 11항목 검증 | 모든 개발 완료 |

## 서로에게 던진 질문들

- **지민 → 태준**: LLM 추가 호출 시 기존 스트리밍 완료 콜백 타이밍과 충돌 없는가?
- **현우 → 미래**: SummaryView에서 "복사" 버튼은 v2인가, v1에 최소한 넣을 수 있는가?
- **소연 → 태준**: low tier 모델 호출 시 요약 품질이 어느 정도 보장되는가?
- **태준 → 미래**: `AbortSignal.any()` 사용하려면 Electron의 Node 버전이 20+ 인가?
- **미래 → 다은**: SummaryView의 접기/펼치기에 별도 아이콘 에셋이 필요한가?
- **윤서 → 태준**: retry 시 seq 리셋 문제 — Panel의 `lastSeqMap`과 어떻게 동기화하는가?
- **다은 → 승호**: 스켈레톤 로더 디자인 토큰이 현재 정의돼 있는가?
- **승호 → 윤서**: 스크린리더로 progressbar 변화를 실시간 감지하는 테스트가 가능한가?

## 기술 의존성

```
combinedSignal 수정 ─────┐
                          ├─→ QA 검증 (Gate 11항목)
generateSummaryViaLLM ───┐│
  └─→ buildQuickSummary  ├┤
  └─→ buildDeepSummary   │├─→ SummaryView.tsx
                          ││
ProgressBar.tsx (독립) ───┤│
retrying 라벨 수정 ───────┤│
cancelled 상태 연결 ──────┘│
                           │
                    전체 완료 → M2 Gate 검증
```
