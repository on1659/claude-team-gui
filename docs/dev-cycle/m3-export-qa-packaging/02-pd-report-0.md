# PD 보고서: M3 Export·QA·패키징 (사이클 #0)

╔══════════════════════════════════════════╗
║  개발 사이클: m3-export-qa-packaging      ║
║  현재 단계: PD 보고서                     ║
║  반복: 0/3                               ║
╚══════════════════════════════════════════╝

## Go/No-Go 판단

**GO**
- 식별된 버그 8건이 모두 명확하고 수정 범위가 작음 (최대 10줄 수준)
- 테스트 시나리오 25건과 DoD v2 8건이 이미 정의되어 있어 QA 실행 즉시 가능
- 패키징 선행 작업(console.log 제거, 보안 검증)이 동시에 처리 가능

---

## 작업 분해 (WBS)

| # | 담당자 | 작업 | 예상 공수 | 선행 작업 | 우선순위 |
|---|--------|-----|---------|---------|---------|
| 1 | 태준 (BE) | SEC-01: handleMessage 런타임 화이트리스트 | S | 없음 | P0 |
| 2 | 태준 (BE) | DoD#7: SecretStorage 저장 실패 시 롤백 | S | 없음 | P0 |
| 3 | 태준+미래 | console.log 전체 제거 (47건) | M | 없음 | P0 |
| 4 | 미래 (FE) | ProgressBar width 클램핑 추가 | XS | 없음 | P1 |
| 5 | 미래 (FE) | cancelled 에이전트 attempt: 1→0 수정 | XS | 없음 | P1 |
| 6 | 다은 (UI) | @keyframes blink/cursorBlink CSS 정의 | S | 없음 | P1 |
| 7 | 다은 (UI) | ActionBar 이모지 aria-hidden + aria-label | XS | 없음 | P1 |
| 8 | 다은 (UI) | SummaryView aria-expanded/aria-controls | XS | 없음 | P1 |
| 9 | 다은 (UI) | ProgressBar cancelled→opacity:0 | XS | 없음 | P2 |
| 10 | 다은 (UI) | AgentCard error body role="alert" | XS | 없음 | P2 |
| 11 | 윤서 (QA) | SEC-01~07 보안 테스트 | M | 1~10 완료 | P0 |
| 12 | 윤서 (QA) | STR-01~08 스트리밍 성능 테스트 | M | 1~10 완료 | P1 |
| 13 | 윤서 (QA) | ERR-01~10 에러 핸들링 테스트 | M | 1~10 완료 | P1 |
| 14 | 윤서 (QA) | DoD v2 8항목 검증 | M | 11~13 완료 | P0 |
| 15 | 지민 (PD) | .vsix 패키징 (vsce package) | S | 14 완료 | P0 |

공수 기준: XS=15분 이내, S=30분 이내, M=1시간 이내

---

## 개발 범위 확정

### 이번 사이클 포함

**P0 — 배포 블로커 (반드시 완료)**
- SEC-01 런타임 화이트리스트 검증
- DoD#7 SecretStorage 롤백
- console.log 전체 제거
- SEC/STR/ERR/DoD 전체 테스트 (25+8건)
- .vsix 패키징 (≤10MB, sourcemap 제외)

**P1 — QA 통과를 위한 수정**
- ProgressBar width 클램핑
- cancelled attempt 0 수정
- @keyframes blink/cursorBlink CSS
- ActionBar/SummaryView 접근성 속성

**P2 — 선택적 개선**
- ProgressBar cancelled opacity:0
- AgentCard error role="alert"

### 제외 (다음 사이클 또는 미정)

- OutputChannel 전환 (console.log 제거로 대체)
- SummaryView 빈 상태 3가지 변형 (v2)
- cancelled 상태 재시작 버튼 (v2)
- ActionBar disabled tooltip (브라우저 기본 title로 대체 가능)

---

## 리스크 매트릭스

| 리스크 | 확률 | 영향 | 대응 전략 |
|--------|------|------|---------|
| .vsix 10MB 초과 | 낮음 | 높음 | sourcemap 제외 + node_modules 포함 여부 확인 |
| Windows 파일 경로 이슈 (saveResult) | 중간 | 높음 | vscode.workspace.fs API 사용으로 크로스플랫폼 보장 |
| AbortController 실제 API 차단 미확인 | 낮음 | 중간 | QA 시 Anthropic 대시보드 토큰 카운트로 검증 |
| SEC-01 수정 후 정상 메시지 차단 | 낮음 | 높음 | 화이트리스트 타입 목록 사전 전수 검토 |
| @keyframes 미정의로 animation 깨짐 | 높음 | 중간 | 이미 식별됨, P1에서 즉시 수정 |

---

## 예상 사용 시나리오

### 개발 전 (As-Is)
1. 사용자가 VS Code Extension 사이드바에서 회의를 시작
2. 회의 진행 중 AgentCard에서 스트리밍 텍스트를 보지만 커서 애니메이션이 없음 (keyframes 미정의)
3. 회의 완료 후 ActionBar "📋 Markdown 복사" 버튼 클릭
4. 복사는 되지만 내부적으로 console.log가 수십 건 출력 (개발자 도구에 노출)
5. API 키를 새 키로 교체 시도 시 store() 실패 → 기존 키도 사라질 수 있음

### 개발 후 (To-Be)
1. 사용자가 Extension 설치 후 "API 키 입력 → 팀 구성 → 첫 회의" 3단계로 1분 이내 시작
2. 회의 진행 중 AgentCard 커서가 부드럽게 깜박임 (keyframes 정상 적용)
3. 회의 완료 후 ActionBar 버튼으로 Markdown 복사 또는 파일 저장 (Windows/macOS 동일 동작)
4. API 키 교체 시 롤백 보장 — store() 실패해도 기존 키 유지
5. 회의 취소 후 새 회의 시작 시 상태 완전 초기화 (attempt 0, phase idle)
6. .vsix 설치 → API 키 입력 → 팀 로드 → 회의 시작 E2E 1분 이내 달성
