# 🏁 [M3 Export·QA·패키징] — 팀 회의 결과 (사이클 #0)

╔══════════════════════════════════════════╗
║  개발 사이클: m3-export-qa-packaging      ║
║  현재 단계: 팀 회의 완료                  ║
║  반복: 0/3                               ║
╚══════════════════════════════════════════╝

## 팀원별 의견

**지민 (PD)** — 배포 전 마지막 사이클이므로 테스트 순서가 핵심. SEC 먼저, 이후 ERR → STR → DoD → 패키징 순으로 진행해야 리스크 누적을 막을 수 있음. STR 테스트는 Pass 기준(성능 수치)을 먼저 정의해야 하며, Windows/macOS 병렬 테스트가 필요. 예상 사용 시나리오는 v1 배포 기준으로 E2E 단일 시나리오 문서화 권장.

**현우 (기획자①)** — 사용자 경험 관점에서 ERR-02/04/06 오류 메시지가 아직 개발자용 텍스트임. "API 키를 확인해주세요" 같은 친근한 메시지로 교체 필요. "첫 회의 1분 이내" KPI를 README에 명시하고 실제로 측정해야 함. README는 30초 컷테스트로 유효성 검증 권장.

**소연 (기획자②)** — README는 문서가 아닌 랜딩 페이지로 설계해야 함. "설치 → API 키 입력 → 첫 회의" 3단계 플로우로 압축. console.log 47건 제거 여부 팀 결정 필요 (OutputChannel 전환 vs 전체 제거). v1 릴리즈 시나리오는 단일 E2E 시나리오로 문서화.

**태준 (개발자① BE)** — SEC-01: 현재 Webview 메시지에 런타임 화이트리스트 검증 없음 → `extension.ts`/`SidebarProvider.ts`의 `handleMessage()`에 허용 타입 배열 화이트리스트 추가 필수. DoD#7: `SecretStorage.store()` 실패 시 롤백 패턴 미구현 → 저장 전 기존 키 읽기 후 실패 시 복원 필요. ERR-07: 동시 키 업데이트 시 mutex 또는 직렬화 처리 필요. console.log 제거가 가장 시급한 배포 블로커.

**미래 (개발자② FE)** — ProgressBar의 `width: ${progress}%` 스타일에 클램핑 없음 → `Math.min(100, Math.max(0, progress))` 적용 필요 (aria는 이미 클램핑됨). cancelled 에이전트 `attempt: 1` 대신 `attempt: 0`이 의미상 맞음. STR-02 성능 검증은 Chrome DevTools로 rAF 프레임 직접 확인 필요. `_quick` agentId의 lastSeqMap 잔류는 무해하나 정리하면 깔끔함.

**윤서 (QA)** — 권장 테스트 순서: SEC-01~03 → DoD#5(AbortController) → ERR-01~03 → STR-01/STR-03 → Windows 교차 테스트 → STR-04/ERR-07/ERR-10(동시성) → DoD v2 전체 체크. AbortController는 반드시 Anthropic 대시보드에서 실제 API 호출 차단 확인 필요. STR Pass 기준: rAF 프레임 드롭 없음 + 16ms 이내.

**다은 (UI)** — `@keyframes blink`와 `cursorBlink`가 코드베이스 어디에도 정의되지 않음 (AgentCard.tsx에서 참조만 함) → CSS 파일에 추가 필수. ActionBar 이모지에 `aria-hidden="true"` + 버튼에 `aria-label` 필요. SummaryView 토글 버튼에 `aria-expanded`/`aria-controls` 누락. ProgressBar cancelled 상태는 `null` 반환 대신 `opacity: 0` 처리로 레이아웃 점프 방지. AgentCard error body에 `role="alert"` 필요.

**승호 (UX)** — ActionBar 비활성화 버튼에 tooltip "회의가 완료되면 사용할 수 있습니다" 추가 필요. cancelled 상태 후 재시작 경로 불명확 → UI 가이던스 필요. SummaryView 빈 상태 3가지 변형 (회의 중/오류/데이터 없음) 정의 필요. README 첫 사용자 플로우는 반드시 1분 이내 목표 달성 확인. App.tsx cancelled→meetingStarted 암묵적 리셋은 동작은 맞으나 주석 문서화 필요.

---

## 주요 합의점

1. **console.log 47건 전체 제거** — 배포 전 필수. 팀 전원 동의.
2. **SEC-01 런타임 화이트리스트** — 보안상 필수, handleMessage()에 추가.
3. **DoD#7 SecretStorage 롤백** — 사용자 데이터 보호를 위해 필수.
4. **@keyframes blink/cursorBlink CSS 정의** — 현재 참조만 되고 미정의, 추가 필수.
5. **ProgressBar width 클램핑** — aria는 이미 클램핑됨, style도 동일하게 처리.
6. **테스트 순서**: SEC → ERR → STR → DoD v2 순서로 진행.

## 주요 충돌 지점

| 주제 | 태준 (BE) | 미래 (FE) | 결론 |
|------|----------|----------|------|
| console.log 처리 | OutputChannel 전환 권장 | 전체 제거로 충분 | 전체 제거 (v1 범위) |
| cancelled attempt 값 | 관심 없음 | 0이 의미상 맞음 | 0으로 수정 |
| lastSeqMap 정리 | 보안 관점 아님 | 정리 권장 | 정리 (선택사항) |

## 역할별 작업 항목 정리

| 담당자 | 역할 | 작업 항목 | 선행 작업 |
|--------|------|---------|---------|
| 태준 | BE | SEC-01: handleMessage 화이트리스트 추가 | 없음 |
| 태준 | BE | DoD#7: SecretStorage 롤백 패턴 구현 | 없음 |
| 태준 | BE | console.log 제거 (서비스 레이어) | 없음 |
| 미래 | FE | ProgressBar width 클램핑 수정 | 없음 |
| 미래 | FE | cancelled attempt 0으로 수정 | 없음 |
| 미래 | FE | console.log 제거 (패널 레이어) | 없음 |
| 다은 | UI | @keyframes blink/cursorBlink CSS 추가 | 없음 |
| 다은 | UI | ActionBar 이모지 aria-hidden + aria-label | 없음 |
| 다은 | UI | SummaryView aria-expanded/aria-controls | 없음 |
| 다은 | UI | ProgressBar cancelled→opacity:0 | 없음 |
| 다은 | UI | AgentCard error role="alert" | 없음 |
| 현우 | 기획 | ERR 오류 메시지 UX 텍스트 정의 | 없음 |
| 승호 | UX | ActionBar tooltip 텍스트 정의 | 없음 |
| 윤서 | QA | SEC/STR/ERR/DoD 25항목 테스트 실행 | 모든 수정 완료 후 |
| 지민 | PD | WBS 확정, 패키징 체크리스트 작성 | 없음 |

## 서로에게 던진 질문들

- **지민 → 태준**: "SEC-01 런타임 검증 누락이 실제로 어떤 공격 벡터를 열어주나요?"
- **현우 → 다은**: "disabled 버튼 tooltip을 네이티브 title 속성으로 할지 커스텀으로 할지?"
- **소연 → 전체**: "console.log를 OutputChannel로 전환하는 게 v1 범위인가요, v2인가요?"
- **태준 → 미래**: "SecretStorage 롤백 실패 시 UI에 어떻게 알려줄 건가요?"
- **미래 → 윤서**: "STR-02 성능 기준 수치가 구체적으로 얼마인가요?"
- **윤서 → 태준**: "AbortController 검증을 Anthropic 대시보드 없이 할 방법이 있나요?"
- **다은 → 승호**: "cancelled 상태 재시작 버튼을 ActionBar에 추가할까요, 아니면 다른 곳에?"
- **승호 → 현우**: "README에서 '첫 회의 1분 이내' KPI를 측정 방법과 함께 명시할 건가요?"

## 기술 의존성

```
SEC-01 화이트리스트 추가 ─────────────────┐
DoD#7 SecretStorage 롤백 ────────────────┤
ProgressBar 클램핑 ──────────────────────┤
cancelled attempt 수정 ──────────────────┤→ QA 테스트 실행 → .vsix 패키징
@keyframes CSS 추가 ────────────────────┤
ActionBar aria 수정 ────────────────────┤
SummaryView aria 수정 ──────────────────┤
console.log 제거 (전체) ────────────────┘
```

모든 코드 수정이 완료된 후 QA 테스트, QA 통과 후 .vsix 패키징.
