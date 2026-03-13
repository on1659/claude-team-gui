# Meeting Result: 목업 → VS Code Extension 구현 방안 — 3종 회의 종합

> 2026-03-13 | meeting-multi + meeting-agent + meeting-team 교차 분석

---

## 회의 방식 비교

| 항목 | 01-meeting-multi | 02-meeting-agent | 03-meeting-team |
| ---- | ---------------- | ---------------- | --------------- |
| 방식 | 역할극 (1 API, 순차) | 병렬 에이전트 (8 API) | 프로필+스킬 주입 병렬 (8 API) |
| 총 토큰 | ~16K (단일 호출) | ~329K | ~345.8K |
| 최대 소요 | 단일 응답 | 102.9초 (승호) | 96.5초 (승호) |
| 컨텍스트 공유 | 있음 (앞 발언이 뒤에 영향) | 없음 (완전 독립) | 없음 (독립, 스킬 파일 주입) |
| 깊이 | 얕음 — 역할당 5~10줄 | 보통 — 독립 관점 | 깊음 — 스킬 기반 전문 분석 |
| 편향 | 높음 — 앞 발언에 끌림 | 낮음 | 낮음 |
| 비용 효율 | 가장 저렴 (~$0.15) | 중간 (~$1.0) | 높음 (~$1.1) |

### 방식별 강점

- **meeting-multi**: 빠른 합의 도출. 팀원 간 반응/반박이 자연스러움. 비용 극소
- **meeting-agent**: 편향 없는 독립 관점. 중복 없이 각자 영역 집중
- **meeting-team**: 스킬 파일 기반으로 **프로젝트 맥락을 완전히 반영**. 가장 실전적인 분석. 크로스 질문(서로에게 묻고 싶은 것) 자연 발생

---

## 3종 회의 전원 합의 — 확정 사항

아래 항목은 3개 회의 모두에서 동일하게 합의된 내용. **재논의 불필요.**

### 아키텍처

| 결정 | 근거 | 합의 출처 |
| ---- | ---- | --------- |
| **Sidebar Provider + Webview Panel 분리** | 목업 레이아웃이 VS Code 패턴과 정확히 매핑. 사이드바=설정, Panel=실행 | 3종 전원 |
| **Extension Host가 모든 API 호출 독점** | Webview는 렌더링 전용. 보안+상태 관리 단일화 | 3종 전원 |
| **React + Vite + Tailwind** | shadcn은 v2로 (VS Code CSS 변수 충돌) | multi+agent |
| **TypeScript 전면** | 메시지 프로토콜 타입 안전성 필수 | 3종 전원 |

### 보안

| 결정 | 근거 | 합의 출처 |
| ---- | ---- | --------- |
| **API 키는 SecretStorage만** | Webview 전달 금지. postMessage 경로에 키 원문 포함 불가 | 3종 전원 (윤서 CRITICAL) |
| **logger에 `sk-ant-*` 패턴 필터링** | DevTools/Output 어디에도 키 미노출 | agent+team |

### UI/디자인

| 결정 | 근거 | 합의 출처 |
| ---- | ---- | --------- |
| **VS Code CSS 변수 전면 채택** | 하드코딩 HEX 제거, 테마 자동 연동 | 3종 전원 |
| **3계층 토큰 구조** (Primitive→Semantic→Component) | Primitive만 VS Code 변수로 교체 | agent+team |
| **픽셀아트 아바타 32px 정규화** | 16의 배수로 pixelated 렌더링 선명도 확보 | agent+team |
| **AgentCard 6상태** (idle/selected/running/streaming/done/error) | 시각 스펙 완성 | agent+team |

### 스트리밍

| 결정 | 근거 | 합의 출처 |
| ---- | ---- | --------- |
| **이중 디바운스** — Host 50ms 배치 + Webview 100ms throttle | 렌더링 부하 최소화 | 3종 전원 |
| **chunkIndex + agentDone에 fullContent** | 순서 보장 + 최종값 안전장치 | agent+team |
| **`retainContextWhenHidden: true`** | 탭 전환 시 스트리밍 메시지 유실 방지 | agent+team |
| **낙관적 UI 3단계** | 0ms 패널+카드 → dots 애니메이션 → streaming 전환 | agent+team |

### 스코프

| 결정 | 근거 | 합의 출처 |
| ---- | ---- | --------- |
| **v1은 meeting-team 1종만** | 4가지 동시 구현은 일정 위험. 1종 먼저 안정화 | 3종 전원 (소연 multi에서 2종 주장 → agent/team에서 1종으로 수렴) |
| **비용 예측은 정적 계산만 (v1)** | 실행 중 실시간 반영은 v2 | agent+team |
| **프로필 편집 UI 미포함** | v2로 제외 확정 | 3종 전원 |
| **office.html은 마케팅용** | Extension 내부 기능으로는 v2 이후 | multi+agent |
| **온보딩 기본 포함** | API 키 → 샘플 프로필 → 코치마크 | agent+team |

---

## 주요 쟁점 — 3종 비교 + 최종 결론

### 쟁점 1: v1 회의 모드 수

| 회의 | 의견 | 결론 |
| ---- | ---- | ---- |
| multi | 소연: 최소 2가지 (비용 선택권) | 2가지 |
| agent | 현우: 1종, 소연: 2종, 지민: 1종 먼저 | 1종 |
| team | 소연: 1종, 지민: 1종 안정화 | 1종 |

**최종: meeting-team 1종.** multi에서만 소연이 2종 주장했으나, agent/team에서 스킬 파일 기반으로 깊이 분석한 결과 1종 안정화가 우선이라는 결론으로 수렴.

### 쟁점 2: 비용 표시 방식

| 회의 | 의견 | 결론 |
| ---- | ---- | ---- |
| multi | 실시간 표시 언급 없음 | - |
| agent | 현우: 실행 중 미표시, 완료 후 최종 | 회의 전 예상 + 완료 후 최종 |
| team | 지민: v1은 선택/해제 시 정적 계산만 | 정적 계산 (v1) |

**최종: v1은 팀원 선택/해제 시 예상 비용만 표시. 실행 중 실시간 반영은 v2.**

### 쟁점 3: 메시지 프로토콜 ACK

| 회의 | 의견 | 결론 |
| ---- | ---- | ---- |
| multi | 태준: fire-and-forget 충분 | seq만 추가 |
| agent | 태준: 불필요, 윤서: seq 필수 | chunkIndex + fullContent |
| team | 태준: done만 ACK, 윤서: done 후 청크 무시 방어 | chunkIndex + fullContent |

**최종: `chunkIndex`로 순서 보장 + `agentDone`에 `fullContent` 포함. 별도 ACK 시스템은 불필요.**

### 쟁점 4: Phase 3 공수

| 회의 | 의견 |
| ---- | ---- |
| multi | Extension Host 4일 + Webview 4일 = 8일 |
| agent | 태준 6일 제안 (기존 5일에서 증가) |
| team | 태준 Extension Host 7일 (항목별 세분화) |

**최종: BE 7일 + FE 공수 합산 필요. Phase 3은 크리티컬 패스 (일정의 38~42%).**

### 쟁점 5: PixelAvatar 구현 방식

| 회의 | 의견 |
| ---- | ---- |
| multi | 미래: `<rect>` 배열 직접 렌더 |
| agent | 미래: dangerouslySetInnerHTML 불필요, `<rect>` 직접 |
| team | 미래: dangerouslySetInnerHTML + useMemo, 지민: 정적 SVG |

**최종: `useMemo` 캐싱 + `<rect>` 배열 직접 렌더. 정적 SVG import는 캐릭터 변경 시 유연성 부족.**

### 쟁점 6: stagger 간격

| 회의 | 의견 |
| ---- | ---- |
| multi | 태준: 200ms |
| agent | 태준: 200ms (Opus 많으면 500ms) |
| team | 태준: 50ms |

**최종: Anthropic API rate limit 실측 후 확정 (50~200ms). 이 숫자가 Phase 3 일정을 좌우하므로 Day 0에 확인 필수.**

---

## 메시지 프로토콜 — 3종 합산 최종안

3개 회의에서 점진적으로 정교화된 타입 정의:

```typescript
// Extension Host → Webview
type ExtensionMessage =
  | { type: 'agentStream';  memberId: string; chunk: string; chunkIndex: number }
  | { type: 'agentDone';    memberId: string; result: AgentResult; fullContent: string }
  | { type: 'agentError';   memberId: string; error: SerializedError }
  | { type: 'meetingDone';  totalTokens: number }
  | { type: 'profilesLoaded'; members: TeamMember[] }
  | { type: 'apiKeyStatus'; hasKey: boolean };

// Webview → Extension Host
type WebviewMessage =
  | { type: 'startMeeting'; config: MeetingConfig }
  | { type: 'cancelMeeting' }
  | { type: 'loadProfiles' }
  | { type: 'setApiKey'; key: string }
  | { type: 'checkApiKey' }
  | { type: 'removeApiKey' };
```

**진화 과정**: multi(기본 타입) → agent(chunkIndex 추가) → team(fullContent + SerializedError + ACK 패턴 확정)

---

## Extension Host 폴더 구조 — 최종

```text
extension/
├── extension.ts          # activate(): Provider 등록만
├── sidebar-provider.ts   # WebviewViewProvider 구현
├── panel-provider.ts     # WebviewPanel 생성/관리
├── message-router.ts     # postMessage 라우팅 (로직 없음)
├── services/
│   ├── anthropic.ts      # SDK 래퍼 + AbortSignal 지원
│   ├── meeting-runner.ts # Promise.allSettled + stagger
│   ├── profile-loader.ts # workspace fs → TeamMember[]
│   ├── skill-loader.ts   # .md → 연차 프리셋 추출
│   ├── prompt-builder.ts # 프로필+스킬 → system prompt 조합
│   └── secret-storage.ts # SecretStorage 래퍼
└── types/
    └── messages.ts       # 위 타입 정의
```

---

## 컴포넌트 트리 — 최종

**Sidebar 앱:**

```text
SidebarApp → SidebarRoot
  ├── TeamList → MemberCard[] (React.memo)
  │   ├── PixelAvatar (32px SVG)
  │   ├── ExperienceBar
  │   └── SalaryBadge
  ├── CostEstimate
  ├── TopicInput
  ├── ModeSelector
  └── MeetingLauncher
```

**Panel 앱:**

```text
PanelApp → PanelRoot
  ├── MeetingHeader
  ├── MeetingProgress
  ├── AgentGrid → AgentCard[] (compound pattern)
  │   ├── AgentCard.Header (이름, PixelAvatar, 상태 dot)
  │   ├── AgentCard.Body (스트리밍/결과/에러)
  │   └── AgentCard.Footer (토큰, 시간 — done만)
  └── MeetingActions
```

---

## VS Code CSS 변수 매핑 — 최종

| 용도 | VS Code 변수 |
| ---- | ------------ |
| 메인 배경 | `--vscode-editor-background` |
| 사이드바 배경 | `--vscode-sideBar-background` |
| 기본 텍스트 | `--vscode-editor-foreground` |
| 보조 텍스트 | `--vscode-descriptionForeground` |
| 구분선 | `--vscode-panel-border` |
| 인터랙티브 강조 | `--vscode-focusBorder` |
| 성공 | `--vscode-testing-iconPassed` |
| 에러 | `--vscode-editorError-foreground` |
| 경고 | `--vscode-editorWarning-foreground` |
| 입력 필드 | `--vscode-input-background` |

---

## 리스크 매트릭스 — 3종 종합

| 리스크 | 등급 | 언급 회의 | 대응 |
| ------ | ---- | --------- | ---- |
| API 키 Webview 노출 | **CRITICAL** | 3종 전원 | SecretStorage만, logger 필터링, Webview 전달 금지 |
| 메시지 순서 역전 (race condition) | **CRITICAL** | agent+team | chunkIndex + done 후 추가 청크 무시 |
| Extension Host 재시작 시 상태 고착 | **CRITICAL** | agent+team | Webview 타임아웃 → 자동 상태 초기화 |
| 8명 동시 스트리밍 성능 | **HIGH** | 3종 전원 | 이중 디바운스 (Host 50ms + Webview 100ms) |
| Rate Limit thundering herd | **HIGH** | 3종 전원 | stagger + exponential backoff (5→10→20초) |
| Sidebar↔Panel 상태 동기화 | **HIGH** | team | Extension Host 단일 상태 소스 + Provider 초기화 시 replay |
| 부분 실패 N/8 처리 | **HIGH** | 3종 전원 | 성공 결과 보존 + 실패 카드만 retry (최대 3회) |
| retainContextWhenHidden 상태 유실 | **HIGH** | agent+team | true 설정 + 메모리 측정 |
| Webview CSP 위반 | **MEDIUM** | team | CSP 설정 검증 |
| profiles.json 파싱 실패 | **MEDIUM** | agent+team | 에러 핸들링 + 기본 프로필 폴백 |
| VS Code 버전 호환성 | **MEDIUM** | agent+team | CI matrix 테스트 |
| 픽셀아트 High Contrast 대응 | **LOW** | team | HC 전용 border 오버레이 |

---

## 일정 — 3종 교차 비교

| Phase | multi | agent | team | 최종 산정 |
| ----- | ----- | ----- | ---- | --------- |
| Phase 1: 초기화+Sidebar+통신 POC | 3일 | 3일 | 6일 (M1) | **6일** |
| Phase 2: 팀원 카드+UI | 2일 | 3일 | (M1에 포함) | **(Phase 1에 포함)** |
| Phase 3: 병렬 스트리밍+retry | 5일 | 5→6일 | 3일 (M2) | **5~6일** |
| Phase 4: 마무리+패키징 | 2일 | 1일 | 4일 (M3) | **2~4일** |
| **합계** | **12일** | **12일** | **13일** | **13일 (버퍼 포함)** |

**크리티컬 패스**: Phase 3 "8명 병렬 스트리밍 + 에러 핸들링" — 3종 모두 동일하게 지적.

---

## QA DoD (Definition of Done) — 최종

3종 회의에서 윤서가 제시한 기준 통합:

### P0 (출시 차단)

- [ ] API 키 Webview 0건 검출 (DOM, console, Output 전수 검사)
- [ ] Extension Host 재시작 시 상태 전이 정상 복구
- [ ] 메시지 순서 역전 방어 동작 확인

### P1 (출시 전 완료)

- [ ] 8명 동시 스트리밍 시 에디터 타이핑 지연 < 100ms
- [ ] 3/8 부분 실패 시 성공 결과 보존 + 실패만 retry
- [ ] Webview 비활성화 중 메시지 버퍼링 정상
- [ ] retainContextWhenHidden 양쪽 설정 동작 확인
- [ ] 10회 연속 실행 오류율 < 5%

### P2 (차기 허용)

- [ ] VS Code 버전 matrix (최소 3개 버전)
- [ ] 30분 연속 사용 메모리 누수 없음

---

## 미해결 질문 — 다음 회의 아젠다

| 번호 | 질문 | 관련 쟁점 | 담당 |
| ---- | ---- | --------- | ---- |
| Q1 | Anthropic API RPM 실측 (Free tier) | stagger 간격 확정, "동시 스트리밍" 가치 명제 | 태준 |
| Q2 | 버튼 클릭→첫 청크 도달 시간 | 낙관적 UI 전략 (1초 vs 3초) | 태준 |
| Q3 | Panel 미열림 상태에서 회의 시작 시 race condition | Panel 초기화 시퀀스 설계 | 태준+미래 |
| Q4 | 취소 시 AbortController.abort() 경로 검증 | 비용 누수 방지 | 태준 |
| Q5 | agentStream 메시지 — append vs 전체 교체? 초당 빈도? | DOM 업데이트 전략 | 태준→다은 |
| Q6 | Webview re-render 시 스트리밍 상태 초기화 | 상태 복원 전략 (Host 버퍼 vs 로컬 state) | 태준→승호 |

---

## 3종 회의 메타 분석 — 회의 방식 자체에 대한 인사이트

| 관찰 | 시사점 |
| ---- | ------ |
| multi에서 소연이 주장한 "2종 모드"가 agent/team에서 "1종"으로 수렴 | **독립 사고가 편향을 줄인다** — multi의 순차 영향이 의견을 확대할 수 있음 |
| 태준의 메시지 프로토콜이 multi→agent→team으로 정교화 | **스킬 파일 주입이 전문성 깊이를 높인다** |
| 윤서의 리스크 분석이 team에서 가장 구체적 (등급표+DoD 정량화) | **스킬 파일이 역할별 프레임워크를 강제** |
| 승호가 3종 모두에서 가장 오래 걸림 (96~102초) | UX 분석의 본질적 복잡도 반영 |
| team에서만 "서로에게 던진 질문" 8건 자연 발생 | **프로필+스킬 주입이 크로스 기능 사고를 유발** |
| multi는 $0.15, agent/team은 $1.0+ | **비용 대비 품질 트레이드오프 명확** — 빠른 합의엔 multi, 깊은 분석엔 team |

---

## 확정 다음 액션 (우선순위 순)

1. **[Day 0] API rate limit 실측** — 태준. stagger 간격이 아키텍처 전체를 좌우 (Q1)
2. **[Day 0] `messages.ts` 타입 정의 확정** — 태준 주도, 미래/윤서 리뷰. 위 최종안 기반
3. **[Day 1~] Extension 프로젝트 초기화** — `yo code` + Sidebar Provider + Webview 통신 POC
4. **[병행] `vscode-theme-variables.css`** — 다은. 위 매핑 표 기반 CSS 파일 작성
5. **[병행] 온보딩 3단계 스펙** — 승호. API 키 → 샘플 프로필 → 코치마크
6. **[병행] skill-pd.md 갱신** — 지민. Electron → VS Code Extension 맥락으로 마일스톤/Gate 업데이트
7. **[Phase 1 완료 후] M1 Quality Gate** — 전원. Extension 빌드+실행, profiles.json 로드, SecretStorage, API 단일 호출 확인
