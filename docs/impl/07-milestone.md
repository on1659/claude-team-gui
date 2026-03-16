# 07. 마일스톤 — 일정, 리스크, 품질 게이트

> 총 16일 (3.2주) 계획. M0~M3 순차 진행, 각 마일스톤에 품질 게이트 포함
> 참고: QA 공수 7~8일은 M2/M3에 분산 배치

---

## 1. 마일스톤 개요

```
M0 (2일)  ─── M1 (5일) ─── M2 (6일) ─── M3 (3일)
문서/환경      기반+사이드바    회의 실행       결과+패키징
                                (크리티컬 패스)
```

| 마일스톤 | 기간 | 핵심 산출물 | 의존성 |
|----------|------|-------------|--------|
| **M0** 문서 정리 + 환경 구축 | 2일 | 빌드 파이프라인, 타입 정의 | 없음 |
| **M1** 프로젝트 기반 + Sidebar | 5일 | Extension 등록, Sidebar Webview, Provider 추상화 | M0 |
| **M2** 회의 실행 엔진 | 6일 | MeetingService, Panel Webview, 스트리밍 | M1 |
| **M3** 결과 + QA + 패키징 | 3일 | Markdown 내보내기, QA 통과, .vsix | M2 |

---

## 2. M0 — 문서 정리 + 환경 구축 (2일)

### 목표
구현 시작 전 빌드 파이프라인과 타입 체계를 확립하여, 이후 마일스톤에서 "빌드가 안 된다"는 문제를 원천 차단.

### 상세 태스크

| 일차 | 태스크 | 세부 내용 | 산출물 |
|------|--------|-----------|--------|
| D1 | **프로젝트 초기화** | `extension/` 디렉토리 생성, `package.json` 작성 (02-extension-manifest.md 기준), `tsconfig.json` 구성, ESLint/Prettier 설정 | package.json, tsconfig.json, .eslintrc, .prettierrc |
| D1 | **esbuild 설정** | Host 빌드 파이프라인 (`esbuild.config.mjs`), external: `['vscode']`, watch 모드 | esbuild.config.mjs, `npm run build:host` 동작 |
| D1 | **Vite 설정** | Webview 빌드 파이프라인 (멀티 엔트리포인트: sidebar + panel), React 18 + TypeScript | vite.config.ts, `npm run build:webview` 동작 |
| D2 | **타입 정의** | 01-type-definitions.md 기준 전체 타입 파일 작성 | `src/types/llm.ts`, `messages.ts`, `team.ts` |
| D2 | **디자인 토큰** | 04-webview-ui-spec.md §1 기준 3계층 CSS 변수 파일 | `primitive.css`, `semantic.css`, `component.css` |
| D2 | **빌드 검증** | Host + Webview 양쪽 빌드 성공 확인, watch 모드 동작 확인 | 빌드 성공 로그, tasks.json, launch.json |

### 품질 게이트 (M0 완료 조건)

```
[M0-QG] 전부 통과해야 M1 진입
──────────────────────────────────────────
[ ] npm run build:host — 에러 0건
[ ] npm run build:webview — 에러 0건
[ ] tsc --noEmit — 타입 에러 0건
[ ] ESLint — warning 허용, error 0건
[ ] F5 (VS Code Extension 디버깅) 시 Extension Host 실행
[ ] Sidebar에 빈 Webview 로드 (React 마운트 확인)
```

---

## 3. M1 — 프로젝트 기반 + Sidebar (5일)

### 목표
Extension이 VS Code에 정상 등록되고, Sidebar에서 팀원 목록 + 회의 설정이 동작하며, Provider 추상화 계층이 완성.

### 상세 태스크

| 일차 | 태스크 | 세부 내용 | 산출물 |
|------|--------|-----------|--------|
| D3 | **Extension 진입점** | `activate()` 함수, `SidebarProvider` 등록, `PanelManager` 골격, contributes 연결 | `extension.ts`, `sidebar-provider.ts`, `panel-manager.ts` |
| D3 | **팀 데이터 로드** | `profile-manager.ts` — `data/team.json` 로드, TeamMember[] 파싱, 유효성 검증 | `profile-manager.ts`, 에러 시 기본값 폴백 |
| D4 | **LLM Provider 추상화** | `LLMProvider` 인터페이스, `LLMRegistry`, `AnthropicProvider` 전체 구현 (05-provider-abstraction.md 기준) | `providers/anthropic.ts`, `llm-registry.ts` |
| D4 | **SecretStorage 키 관리** | `config-service.ts` — Provider별 키 저장/조회/삭제, `validateKey()`, `hasKey` 상태 Webview 전달 | `config-service.ts`, SEC-01~03 사전 검증 |
| D5 | **Sidebar UI: TeamList** | 팀원 카드 목록, 활성/비활성 토글, 선택 상태 관리 | `TeamList.tsx`, `MemberCard.tsx` |
| D5 | **Sidebar UI: PixelAvatar** | 16×16 그리드 SVG 아바타, 사이드바 36px / 패널 32px 대응 | `PixelAvatar.tsx` |
| D6 | **Sidebar UI: MeetingConfig** | 주제 입력, 모드 선택 (quick/deep), "회의 시작" 버튼, 비용 예측 표시 | `MeetingConfig.tsx`, `CostEstimate.tsx` |
| D6 | **postMessage 프로토콜** | `useVscodeMessage` 훅, Host ↔ Sidebar 양방향 통신, 메시지 타입 안전성 | `useVscodeMessage.ts`, 메시지 흐름 검증 |
| D7 | **Provider 통합 테스트** | AnthropicProvider로 실제 API 호출, 스트리밍 수신 확인 | Provider E2E 테스트 로그, 에러 핸들링 |
| D7 | **M1 통합 검증** | Sidebar 전체 플로우: 팀원 선택 → 주제 입력 → 모드 선택 → 비용 표시 → "시작" 클릭 시 Host 수신 | 통합 테스트 결과 |

### 품질 게이트 (M1 완료 조건)

```
[M1-QG] 전부 통과해야 M2 진입
──────────────────────────────────────────
[ ] Extension activate → Sidebar 정상 표시
[ ] 팀원 8명 카드 렌더링 + 활성/비활성 토글
[ ] PixelAvatar SVG 렌더링 정상 (사이드바 크기)
[ ] API 키 입력 → SecretStorage 저장 → hasKey: true 확인
[ ] API 키 미입력 → 회의 시작 차단 + 입력 프롬프트
[ ] AnthropicProvider.streamMessage() 동작 (실 키 테스트)
[ ] Sidebar → Host postMessage 왕복 확인
[ ] SEC-01~03 사전 검증 (키 미노출)
```

---

## 4. M2 — 회의 실행 엔진 (6일) ⚠️ 크리티컬 패스

### 목표
quick/deep 양쪽 회의 모드가 완전히 동작하고, Panel Webview에서 스트리밍 결과가 실시간으로 표시.

### 왜 크리티컬 패스인가
- **프로젝트 핵심 기능**: 회의 실행 없이는 Extension의 존재 이유가 없음
- **기술 난도 최고**: 8명 동시 스트리밍 + 상태머신 + 디바운스 + 취소
- **통합 복잡도**: Host ↔ Panel 양방향 통신, Provider 호출, 에러 격리 동시 처리
- **M3 전체가 M2에 의존**: 결과가 없으면 Markdown 내보내기도, QA도 불가

### 상세 태스크

| 일차 | 태스크 | 세부 내용 | 산출물 |
|------|--------|-----------|--------|
| D8 | **MeetingService 코어** | 03-meeting-flow.md 기준 — meetingId 생성, AbortController 관리, 회의 모드 분기 | `meeting-service.ts` 골격 |
| D8 | **Quick 모드 구현** | single API call, role-play 시스템 프롬프트, 응답 파싱 (역할별 섹션 분리) | quick 모드 E2E 동작 |
| D9 | **Deep 모드 구현** | N명 병렬 API call, 200ms stagger 적용, 각 에이전트 독립 AbortController | deep 모드 병렬 호출 동작 |
| D9 | **스트리밍 → postMessage** | Host에서 chunk 수신 → seq 번호 부여 → Webview 전달, 이벤트 타입별 분기 (delta/done/error) | 스트리밍 데이터 흐름 확인 |
| D10 | **Panel UI: AgentGrid + AgentCard** | 04-webview-ui-spec.md §3 기준, 6상태 머신 (idle→selected→streaming→done/error→retrying/cancelled) | `AgentGrid.tsx`, `AgentCard.tsx` |
| D10 | **AgentCard 상태 전환** | useReducer 기반 상태머신, 각 상태별 시각 효과 (색상, 애니메이션, opacity) | AgentCard 6상태 전환 시각 확인 |
| D11 | **rAF 디바운스** | Webview 측 `requestAnimationFrame` 배치 처리, seq 순서 보장 정렬 | STR-01~02 사전 검증 |
| D11 | **낙관적 UI** | 03-meeting-flow.md §4 기준 3단계: 즉시 반응 → 카드 전환 → 스트리밍 시작 | 낙관적 UI 체감 확인 |
| D12 | **에러 격리 + retry** | 부분 실패 → 해당 AgentCard만 error, 독립 retry, max 3회 | ERR-01~04, ERR-09~10 검증 |
| D12 | **AbortController 취소 경로** | 03-meeting-flow.md §6 기준 — "회의 중단" 버튼 → 전체 abort → Provider별 stream.abort() | STR-06~08, DoD #5 검증 |
| D13 | **Panel UI: 나머지** | MeetingHeader (주제+모드+진행률), ProgressBar (완료/전체 카운트), SummaryView (회의 요약) | 전체 Panel UI 완성 |
| D13 | **M2 통합 검증** | quick + deep 양쪽, 8명 동시, 부분 실패, 취소, seq 연속성 전부 테스트 | 통합 테스트 결과, 이슈 목록 |

### 품질 게이트 (M2 완료 조건)

```
[M2-QG] 전부 통과해야 M3 진입 — 이 게이트가 프로젝트 성패를 결정
──────────────────────────────────────────
[ ] Quick 모드: 1회 API 호출 → 역할별 파싱 → 8명 AgentCard 표시
[ ] Deep 모드: 8명 병렬 API 호출 → 200ms stagger → 독립 스트리밍
[ ] AgentCard 6상태 전환 정상 (idle→streaming→done, idle→streaming→error→retrying→done)
[ ] 8명 동시 seq 연속성 (STR-01)
[ ] rAF 배치 렌더 — 개별 setState 없음 (STR-02)
[ ] 부분 실패 격리 — 1명 error 시 나머지 7명 정상 (ERR-01~03)
[ ] AbortController 취소 → 전체 stream abort (STR-06)
[ ] 취소 후 재시작 가능 (STR-07)
[ ] 낙관적 UI 3단계 체감 (버튼 즉시 → 카드 전환 → 스트리밍)
[ ] seq 갭 발생 시 console.warn + 이어붙이기 (STR-04)
[ ] 초당 30+ 메시지 유실 0건 (STR-03)
```

---

## 5. M3 — 결과 + QA + 패키징 (3일)

### 목표
결과 내보내기, 전체 QA 체크리스트 통과, .vsix 패키징 및 배포 준비.

### 상세 태스크

| 일차 | 태스크 | 세부 내용 | 산출물 |
|------|--------|-----------|--------|
| D14 | **ActionBar + Markdown 복사** | 04-webview-ui-spec.md §5 기준 — 클립보드 복사 (raw MD), 피드백 토스트 | `ActionBar.tsx`, 복사 동작 확인 |
| D14 | **Markdown 저장** | VS Code SaveDialog → UTF-8 파일 저장, 기본 파일명 `meeting-{date}-{topic}.md`, 덮어쓰기 confirm | 저장 동작 + ERR-08 검증 |
| D14 | **빈 결과/스트리밍 중 처리** | 결과 없는 상태에서 복사/저장 시도 → 비활성 또는 경고 | 엣지케이스 처리 확인 |
| D15 | **SEC 테스트** | SEC-01~07 전체 실행 | 보안 테스트 결과서 |
| D15 | **STR + ERR 테스트** | STR-01~08, ERR-01~10 전체 실행 | 기능/에러 테스트 결과서 |
| D15 | **버그 수정** | 테스트에서 발견된 이슈 즉시 수정 | 이슈 트래커 업데이트 |
| D16 | **DoD v2 최종 확인** | 06-qa-checklist.md §1 기준 8개 항목 전수 검증 | DoD 체크리스트 서명 |
| D16 | **릴리즈 체크리스트** | 06-qa-checklist.md §3 기준 CRITICAL/HIGH/MEDIUM 전부 | 릴리즈 승인 |
| D16 | **.vsix 패키징** | `vsce package`, 소스맵 미포함, console.log 제거, 파일 크기 10MB 이하 | `.vsix` 파일 |

### 품질 게이트 (M3 완료 = 릴리즈 조건)

```
[M3-QG] 전부 통과해야 릴리즈
──────────────────────────────────────────
[ ] DoD v2 전 8항목 통과
[ ] SEC-01~07 전원 PASS
[ ] STR-01~08 전원 PASS
[ ] ERR-01~10 전원 PASS
[ ] 릴리즈 체크리스트 CRITICAL 전원 PASS
[ ] 릴리즈 체크리스트 HIGH 전원 PASS
[ ] .vsix 파일 크기 ≤ 10MB
[ ] Windows + macOS 양쪽 동작 확인
```

---

## 6. 리스크 매트릭스

### 리스크 식별 및 대응 방안

| # | 리스크 | 영향도 | 발생 확률 | 등급 | 관련 마일스톤 | 대응 방안 | 트리거 조건 |
|---|--------|--------|-----------|------|---------------|-----------|-------------|
| R1 | **8명 동시 스트리밍 성능 병목** | HIGH | MEDIUM | 🔴 HIGH | M2 D10~D11 | rAF 배치 렌더로 1차 해결. 그래도 FPS < 30이면 AgentCard를 Canvas 기반으로 전환 | STR-03 실패 시 |
| R2 | **Anthropic API rate limit** | HIGH | LOW | 🟡 MEDIUM | M2 D9 | Deep 모드 200ms stagger가 1차 방어. 429 시 지수 백오프 (1s → 2s → 4s, max 3회) | ERR-04 연속 발생 시 |
| R3 | **Quick 모드 역할 파싱 실패** | MEDIUM | MEDIUM | 🟡 MEDIUM | M2 D8 | 역할 구분자 패턴 (`### 이름 (역할)`) 미매칭 시 전체 텍스트를 첫 번째 에이전트에 할당 + 파싱 실패 로그 | 파싱 결과 에이전트 수 ≠ 참여자 수 |
| R4 | **Webview 간 상태 비공유** | MEDIUM | HIGH | 🟡 MEDIUM | M1 D6 | Sidebar ↔ Panel은 Host를 통해서만 통신. 상태 동기화 필요 시 Host가 양쪽에 브로드캐스트 | Zustand 등 공유 상태 라이브러리 사용 불가 확인 |
| R5 | **SecretStorage 플랫폼 차이** | LOW | LOW | 🟢 LOW | M1 D4 | VS Code 공식 API이므로 플랫폼 독립. 단, Linux keyring 미설치 환경에서 경고 가능 → README에 명시 | Linux 환경 테스트 시 |
| R6 | **Vite 멀티 엔트리포인트 빌드 이슈** | MEDIUM | LOW | 🟢 LOW | M0 D1 | 02-extension-manifest.md 설정 그대로 적용. 문제 시 sidebar/panel 별도 Vite 인스턴스로 분리 | 빌드 에러 발생 시 |
| R7 | **seq 갭 누적으로 메모리 증가** | LOW | LOW | 🟢 LOW | M2 D11 | 갭 감지 + 로그만 남기고 이어붙이기. agentDone에서 전체 텍스트 수신하므로 최종 정합성 보장 | 갭 10건 이상 연속 발생 시 |
| R8 | **프로젝트 일정 지연** | HIGH | MEDIUM | 🔴 HIGH | 전체 | M2가 크리티컬 패스. M2에서 2일 이상 지연 시 M3 QA 범위 축소 (MEDIUM 회귀 테스트 → v1.1 이후) | M2 D11 미완료 시 |

### 리스크 등급 기준

| 등급 | 의미 | 대응 시점 |
|------|------|-----------|
| 🔴 HIGH | 프로젝트 일정 또는 핵심 기능에 직접 영향 | 발생 즉시 대응, 사전 완화 조치 필수 |
| 🟡 MEDIUM | 품질 또는 사용자 경험에 영향 | 해당 마일스톤 내 해결 |
| 🟢 LOW | 알려진 제약, 우회 가능 | 발생 시 대응 |

---

## 7. 일정 컨틴전시 계획

### M2 지연 시나리오별 대응

| 지연 | 상태 | 대응 |
|------|------|------|
| **1일** | 정상 범위 | M3에서 MEDIUM 회귀 테스트 1일→0.5일로 압축 |
| **2일** | 주의 | M3 MEDIUM 회귀 테스트 전체 v1.1로 연기. M3를 2일로 압축 (CRITICAL+HIGH만) |
| **3일 이상** | 위험 | Quick 모드만 v1 릴리즈. Deep 모드는 v1.1로 분리. M3 QA도 Quick 범위만 |

### 스코프 축소 우선순위 (버릴 순서)

최후의 수단으로 스코프를 축소할 때, 아래 순서로 v1.1 이후로 미룸:

```
축소 1순위 (영향 최소):
  - MEDIUM 회귀 테스트 (Extension reload, postMessage 충돌)
  - PixelAvatar → 텍스트 이니셜 대체 (예: "지" "현" 원형 배지)

축소 2순위 (사용자 체감 있음):
  - Deep 모드 → Quick 모드만 v1 출시
  - AgentCard retry (error 표시까지만, retry 버튼 없음)

축소 3순위 (최후):
  - Markdown 저장 → 복사만 유지
  - 비용 예측 → 제거
```

---

## 8. 마일스톤별 의존성 그래프

```
M0-D1: package.json + esbuild + Vite
  │
  ├── M0-D2: 타입 정의 + CSS 토큰
  │     │
  │     ├── M1-D3: Extension 진입점 + 팀 데이터
  │     │     │
  │     │     ├── M1-D4: Provider 추상화 + SecretStorage
  │     │     │     │
  │     │     │     ├── M1-D5~D6: Sidebar UI
  │     │     │     │     │
  │     │     │     │     └── M1-D7: Provider 통합 테스트
  │     │     │     │           │
  │     │     │     │           ├── M2-D8: MeetingService + Quick
  │     │     │     │           │     │
  │     │     │     │           │     ├── M2-D9: Deep 모드 + 스트리밍
  │     │     │     │           │     │     │
  │     │     │     │           │     │     ├── M2-D10: AgentGrid + AgentCard
  │     │     │     │           │     │     │     │
  │     │     │     │           │     │     │     ├── M2-D11: rAF 디바운스 + 낙관적 UI
  │     │     │     │           │     │     │     │     │
  │     │     │     │           │     │     │     │     ├── M2-D12: 에러 격리 + 취소
  │     │     │     │           │     │     │     │     │     │
  │     │     │     │           │     │     │     │     │     ├── M2-D13: Panel 나머지 UI + 통합
  │     │     │     │           │     │     │     │     │     │     │
  │     │     │     │           │     │     │     │     │     │     ├── M3-D14: ActionBar + Markdown
  │     │     │     │           │     │     │     │     │     │     │     │
  │     │     │     │           │     │     │     │     │     │     │     ├── M3-D15: 전체 QA
  │     │     │     │           │     │     │     │     │     │     │     │     │
  │     │     │     │           │     │     │     │     │     │     │     │     └── M3-D16: 패키징
```

---

## 9. 비용 요약

### 개발 중 API 비용 예상

| 마일스톤 | API 호출 내용 | 예상 횟수 | 예상 비용 (Anthropic Sonnet 기준) |
|----------|--------------|-----------|----------------------------------|
| M1 | Provider 통합 테스트 (단일 호출) | 20~30회 | $0.20~0.50 |
| M2 | Quick 테스트 + Deep 테스트 (8명 병렬) | 50~80회 | $1.00~3.00 |
| M3 | QA 시나리오 전체 실행 | 30~50회 | $0.60~1.50 |
| **합계** | | **100~160회** | **$1.80~5.00** |

> Sonnet 기준. Opus 모델 사용 시 5배, Haiku 사용 시 0.3배.

### 인력 공수 요약

| 구분 | 공수 | 비고 |
|------|------|------|
| 구현 (M0~M2) | 13일 | 코드 작성 + 단위 테스트 |
| QA (M3) | 3일 | 06-qa-checklist.md 전체 (압축 버전) |
| **합계** | **16일** | 1인 기준, 풀타임 |

---

## 10. 체크포인트 회의 일정

| 시점 | 의제 | 참석자 (가상 팀 기준) | 판단 사항 |
|------|------|----------------------|-----------|
| M0 완료 (D2 끝) | 빌드 파이프라인 동작 여부, 타입 변경 사항 | 지민, 태준, 미래 | M1 진입 Go/No-Go |
| M1 완료 (D7 끝) | Sidebar 데모, Provider API 연동 확인 | 지민, 현우, 태준, 미래 | M2 진입 Go/No-Go, Provider 추가 이슈 확인 |
| M2 중간 (D10 끝) | 스트리밍 동작 데모, 성능 초기 측정 | 지민, 태준, 미래, 승호 | 성능 이슈 시 R1 대응 발동 여부 |
| M2 완료 (D13 끝) | 전체 회의 실행 데모, QA 범위 확정 | 전원 | M3 진입 Go/No-Go, 일정 지연 시 스코프 축소 결정 |
| M3 완료 (D16 끝) | QA 결과 리뷰, .vsix 최종 확인 | 지민, 윤서, 태준 | 릴리즈 Go/No-Go |
