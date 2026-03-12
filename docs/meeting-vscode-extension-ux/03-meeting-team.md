# Meeting-Team: 목업 → VS Code Extension 구현 방안

> 지속 팀원 기반 멀티에이전트 회의 (프로필+스킬 주입) — 2026-03-13

## 회의 주제
목업(index.html + office.html)을 실제 VS Code Extension으로 구현할 때의 시스템 아키텍처, UI/UX 설계, 기술 스택

## 참여 팀원 (8명 병렬 실행)
| 이름 | 역할 | 연차 | 모델 | 토큰 (total) | 소요 |
|------|------|------|------|-------------|------|
| 지민 | PD · 프로젝트 디렉터 | 10y senior | Opus | ~56.4K | 71.2s |
| 현우 | 기획 · 리서치 | 5y mid | Sonnet | ~41.9K | 54.3s |
| 소연 | 기획 · 전략 | 8y senior | Sonnet | ~41.7K | 51.2s |
| 태준 | 백엔드 개발 | 6y mid | Sonnet | ~50.3K | 71.9s |
| 미래 | 프론트엔드 개발 | 3y junior | Sonnet | ~50.4K | 66.7s |
| 윤서 | QA | 5y mid | Sonnet | ~17.0K | 70.9s |
| 다은 | UI 디자인 | 4y mid | Sonnet | ~45.7K | 74.8s |
| 승호 | UX 디자인 | 7y mid | Sonnet | ~42.4K | 96.5s |

**총 토큰**: ~345.8K | **최대 소요 시간**: 96.5초 (승호 UX)

---

## 팀원별 의견

### 지민 (PD · 10년차 senior · Opus)

**[Go] 조건부.**

Electron에서 VS Code Extension으로 전환한 건 올바른 결정이다. 일정이 4~5주에서 ~2.5주(13일)로 줄었고, 패키징/IPC 오버헤드가 사라졌다. 목업이 이미 VS Code 쉘 구조를 충실하게 반영하고 있어서 Webview로의 전환 비용이 낮다.

**5가지 리스크 경고:**

1. **Phase 3이 여전히 크리티컬 패스 — 일정의 38%**: 8명 병렬 스트리밍 + 에러 핸들링 + retry + 4종 회의 모드 구현이 5일 안에 끝나야 한다. "잘 되면 5일, 한 번 삐끗하면 8일"
2. **Sidebar↔Panel 이중 구조의 상태 동기화**: 두 Webview가 직접 통신 불가. Extension Host에 단일 상태 소스(MeetingState) 필수
3. **픽셀아트 캐릭터 렌더링 비용**: 런타임 SVG 생성(pxSvg) 금지. 정적 에셋으로 사전 생성해서 import
4. **비용 추정 "실시간"의 정의 불명확**: v1은 팀원 선택/해제 시에만(A방식). 실행 중 실시간 반영(B방식)은 v2
5. **리스크 매트릭스 갱신 필요**: keytar 삭제, 대신 Sidebar↔Panel 상태 불일치(상/상), Webview CSP(중/중), VS Code 버전별 API 차이(하/중) 추가

**마일스톤 재정의:**
- M1 (6일): Extension 초기화 + Sidebar + profiles.json + SecretStorage + 비용 예측기(정적)
- M2 (3일): meeting-team 1종 end-to-end + 8명 병렬 스트리밍 + retry
- M3 (4일): 나머지 3종 + 결과 저장 + .vsix 패키징

**skill-pd.md를 VS Code Extension 맥락으로 공식 갱신하는 것을 이번 회의 블로킹 액션으로 잡아야 한다.**

> **태준에게 묻고 싶은 것**: Anthropic API rate limit이 분당 몇 건인지 확인했는가? Free tier RPM이 5 이하일 수 있다. 8명 동시 호출 + stagger 간격이 "60초 이내 전원 완료" Gate 기준과 양립 가능한지 수치로 답해달라.

---

### 현우 (기획 · 리서치 · 5년차 mid · Sonnet)

모든 기술 선택의 핵심 질문: **"개발자가 코딩하다가 팀 회의를 실행할 때 마찰이 얼마나 줄어드는가"**.

Sidebar Provider + Webview Panel 이중 구조는 타당. 코딩 컨텍스트 이탈 없이 사이드바에서 팀원 선택 → 클릭 → 에디터 탭에서 결과 확인. CLI 창을 별도로 열 필요가 없다는 게 핵심 가치.

**3가지 리스크:**

1. **"응답이 오는지 모르는 상태" (HIGH)**: 회의 시작 후 첫 스트리밍 청크 도달까지 1~3초 공백. 버튼 중복 클릭 → 8명 중복 실행 → API 비용 폭탄 가능성. 체감 목표: 첫 청크 < 1초
2. **비용 예측 vs 실제 비용 오차 (MEDIUM)**: 스킬 파일 포함 시 팀원당 입력 토큰이 현재 추정치보다 훨씬 클 수 있음. 목표 오차: ±20%
3. **스트리밍 UI의 "읽기 불가능" 상태 (MEDIUM)**: 8개 카드 동시 텍스트 추가 시 시각적 노이즈. CLI `/meeting-team`은 순차 출력이라 읽기 쉬움. GUI가 "8명 동시"를 보여주는 건 인상적이지만, "읽기"가 어려우면 오히려 CLI보다 못한 경험

**Must/Should/Won't:**
- Must: 즉각 피드백 상태 3단계 (버튼 클릭→에디터 탭 열림→카드 "연결 중..."→스트리밍), 비용 예측에 스킬 파일 크기 반영
- Should: 완료된 카드 시각적 분리 (색상 구분)
- Won't: 카드 순서 재정렬 (v2), 카드 펼치기/접기 (v2)

> **태준에게 묻고 싶은 것**: 회의 시작 버튼 클릭 후 첫 스트리밍 청크가 Webview에 도달하는 데 몇 초가 걸릴 것으로 예상하는가? 1초 이내면 "즉시 반응", 3초 넘으면 사용자가 버튼 오작동으로 인식.

---

### 소연 (기획 · 전략 · 8년차 senior · Sonnet)

**VS Code Marketplace에 "AI 멀티에이전트 팀 회의" 카테고리가 없다. First mover advantage. 속도가 전략 자체.**

Electron에서 Extension으로 전환하면 설치 마찰, 앱 전환 비용, 유지보수 overhead 삼중 문제 해결. Marketplace 검색 → 설치 한 번 → 코딩 중 사이드바에서 즉시 사용.

**KPI 연결:**
| KPI | Extension 기여 방식 |
|-----|-------------------|
| 첫 회의 실행 < 1분 | 앱 전환 없음, 사이드바 바로 사용 |
| 주간 회의 > 3회/사용자 | 코딩 컨텍스트 이탈 없이 반복 사용 |
| 회의 완료율 > 80% | VS Code 안에 있으니 중단 이탈 유인 적음 |

**3가지 리스크:**
1. **Marketplace 검색 노출 전략 부재**: 첫 달 설치 100+ 못 하면 사장. Extension에 맞는 런칭 전략 필요
2. **GitHub Copilot Chat의 확장 방향**: Microsoft가 멀티에이전트 방향으로 움직임. 6개월 내 포지션 굳혀야
3. **API 비용 가시화**: 초반 사용자가 비용에 놀라 이탈하면 완료율 KPI 무너짐

**v1 확정 / v2 제외:**
- v1 필수: meeting-team + 카드별 병렬 스트리밍, 비용 인식 UX, Marketplace 키워드 최적화, 온보딩 5분 이내
- v2 제외: 프로필 편집 UI, 오케스트레이터 요약, meeting-agent/meeting-multi 모드, 픽셀아트 애니메이션

**출시 채널 ROI:**
| 채널 | ROI | 시점 |
|------|-----|------|
| VS Code Marketplace | 높음 | Day 0 |
| Reddit r/ClaudeAI + r/vscode | 중간 | Day 0~3 |
| GitHub README + CHANGELOG | 높음 | Day 0 |
| Claude Code 커뮤니티 | 높음 | Day 1 |

> **태준에게 묻고 싶은 것**: rate limit으로 stagger 전략이 필요하면 "병렬 동시 스트리밍"이라는 핵심 가치 명제가 무너진다. v1 아키텍처 결정 전에 이 숫자를 확인해야 한다.

---

### 태준 (백엔드 · 6년차 mid · Sonnet)

**메시지 프로토콜부터 먼저 박아야 한다. 나머지 다 뒤에 해도 된다.**

**메시지 타입 정의:**
```typescript
// Extension Host → Webview
type ExtensionMessage =
  | { type: 'agentStream';  memberId: string; chunk: string }
  | { type: 'agentDone';   memberId: string; result: AgentResult }
  | { type: 'agentError';  memberId: string; error: SerializedError }
  | { type: 'meetingDone'; totalTokens: number }
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

**Extension Host 폴더 구조:**
```
extension/
├── extension.ts          # activate(): Provider 등록만
├── sidebar-provider.ts   # WebviewViewProvider 구현
├── panel-provider.ts     # WebviewPanel 생성/관리
├── message-router.ts     # postMessage 라우팅 (로직 없음)
├── services/
│   ├── anthropic.ts      # SDK 래퍼 + AbortSignal 지원
│   ├── meeting-runner.ts # Promise.allSettled + stagger(50ms)
│   ├── profile-loader.ts # workspace fs → TeamMember[]
│   ├── skill-loader.ts   # .md → 연차 프리셋 추출
│   ├── prompt-builder.ts # 프로필+스킬 → system prompt 조합
│   └── secret-storage.ts # SecretStorage 래퍼
└── types/
    └── messages.ts       # 위 타입 정의
```

**리스크:**
- **[CRITICAL] API 키 노출**: logger에 `sk-ant-*` 패턴 필터링 필수. postMessage 경로에 키 전달 금지
- **[HIGH] rate limit**: stagger start 50ms 간격 + retry 정책 (429: exponential 5→10→20초, timeout: 3회 2초 간격, 401: 즉시 중단)
- **[HIGH] Webview 메시지 유실**: 스트리밍 chunk는 유실 허용, `agentDone`에 fullContent 포함시켜 보장. 5초 내 ACK 없으면 재전송(최대 3회)
- **[MEDIUM] Sidebar↔Panel 상태 동기화**: Extension Host가 실행 중 상태를 메모리에 보유, Provider 초기화 시 상태 replay

**공수 산정: Extension Host 합계 7일**
| 작업 | 공수 |
|------|------|
| 메시지 타입 + message-router | 0.5일 |
| SecretStorage 래퍼 | 0.5일 |
| Profile + Skill 로더 | 1일 |
| Prompt Builder | 1일 |
| Anthropic SDK + 단일 스트리밍 | 1일 |
| 병렬 실행 + retry + AbortController | 1.5일 |
| 에러 처리 + 도메인 에러 클래스 | 0.5일 |
| ACK 패턴 + 상태 복원 | 1일 |

**Extension Host 50ms 배치 제안:** chunk를 모아서 보내면 Webview는 단순히 append만 하면 됨. FE 의견 필요.

> **미래(FE)에게 묻고 싶은 것**: 스트리밍 chunk를 Webview에서 어떻게 버퍼링할 건지. Extension Host에서 50ms 배치 vs Webview에서 100ms throttle — 어디서 할 건지 결정 필요.

---

### 미래 (프론트엔드 · 3년차 junior · Sonnet)

**컴포넌트 트리:**

**Sidebar 앱:**
```
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
```
PanelApp → PanelRoot
  ├── MeetingHeader
  ├── MeetingProgress
  ├── AgentGrid → AgentCard[] (compound pattern)
  │   ├── AgentCard.Header (이름, PixelAvatar, 상태 dot)
  │   ├── AgentCard.Body (스트리밍/결과/에러)
  │   └── AgentCard.Footer (토큰, 시간 — done만)
  └── MeetingActions
```

**핵심 발견:**
- Sidebar/Panel이 독립 React 앱 → Zustand 공유 불가. Extension Host 경유 필수
- `vscode.acquireVsCodeApi()` 싱글턴 관리 필요 → `useVSCodeMessage` 훅으로 전담
- 8개 동시 스트리밍 시 `AgentStreamText` 내부에서 `ref` 누적 + 100ms throttle 패턴 필수
- VS Code CSS 변수 → Tailwind config에서 `bg-vscode-bg`, `text-vscode-fg` 등으로 매핑
- PixelAvatar: `dangerouslySetInnerHTML` + `useMemo`로 캐싱 (JSX 인라인하면 150줄 초과)

**AgentCard 상태별 Tailwind (VS Code 변수 기반):**
```
idle:      border-[var(--vscode-panel-border)]
selected:  border-[var(--vscode-focusBorder)]
running:   border-[var(--vscode-notificationsWarningIcon-foreground)]
streaming: border-[var(--vscode-activityBarBadge-background)]
done:      border-[var(--vscode-terminal-ansiGreen)]
error:     border-[var(--vscode-errorForeground)]
```

> **태준에게 묻고 싶은 것**: Panel이 아직 안 열린 상태에서 "회의 시작" 시 Panel 열림 타이밍과 초기 설정 메시지 수신의 race condition은 어떻게 처리할 건가요?

---

### 윤서 (QA · 5년차 mid · Sonnet)

**리스크 지형이 Electron과 완전히 다릅니다.**

**리스크 등급표:**
| 리스크 | 등급 | 자동화 |
|--------|------|--------|
| API 키 Webview 노출 경로 | **CRITICAL** | 수동+자동(일부) |
| 메시지 순서 미보장 (race condition) | **CRITICAL** | 자동(mock) |
| 8명 동시 스트리밍 Webview 성능 | **HIGH** | 수동(실측) |
| 부분 실패 N/8 시나리오 | **HIGH** | 자동 |
| retainContextWhenHidden 상태 유실 | **HIGH** | 수동 |
| VS Code 버전 호환성 | **MEDIUM** | 자동(CI matrix) |

**CRITICAL 시나리오:**
- **API 키**: postMessage 페이로드에 키 원문 포함 여부, console/Output 출력 경로, Webview에서 SecretStorage 직접 호출 차단 확인
- **메시지 순서**: 에이전트 A 스트리밍 중 B의 done이 먼저 도착 → B 완료 후 늦은 B 청크 append 버그. `done` 수신 후 해당 agentId 추가 청크 무시 방어 코드 필수
- **Extension Host 재시작**: 스트리밍 중 Host 재시작 시 Webview running 상태 무한 대기

**테스트 시나리오 우선순위:**
- P0 (출시 차단): API 키 노출 전수 검사, Host 재시작 시 상태 전이, 메시지 순서 역전
- P1 (출시 전 완료): 8명 성능 (에디터 지연 < 100ms), 3/8 부분 실패 retry, Webview 비활성화 중 메시지 버퍼링, retainContextWhenHidden 양쪽
- P2 (차기 허용): VS Code 버전 matrix, 30분 메모리 누수

**DoD 정량 기준:**
- 보안: API 키 Webview 0건 검출
- 성능: 에디터 타이핑 지연 < 100ms, 렌더링 완료 < 500ms
- 신뢰성: P0 3개 전부 PASS, P1 4개 전부 PASS, 부분 실패 10회 오류율 < 5%

> **개발팀에게 묻고 싶은 것**: 취소 시 Extension Host의 AbortController.abort()가 실제로 호출되는 흐름인지 확인. Webview만 닫히고 API 호출 계속 → 결과 안 보이고 비용만 나가는 시나리오 방지.

---

### 다은 (UI 디자인 · 4년차 mid · Sonnet)

**목업 CSS 변수 → VS Code 변수 전면 교체 필수.**

**매핑 표:**
| 목업 변수 | VS Code 변수 | 역할 |
|----------|-------------|------|
| `--bg` #1e1e1e | `--vscode-editor-background` | 메인 배경 |
| `--bg-sidebar` #252526 | `--vscode-sideBar-background` | 사이드바 배경 |
| `--fg` #cccccc | `--vscode-editor-foreground` | 기본 텍스트 |
| `--fg-dim` #858585 | `--vscode-descriptionForeground` | 보조 텍스트 |
| `--border` #474747 | `--vscode-panel-border` | 구분선 |
| `--accent` #007acc | `--vscode-focusBorder` | 인터랙티브 강조 |
| `--ok` #4ec9b0 | `--vscode-testing-iconPassed` | 성공 |
| `--err` #f14c4c | `--vscode-editorError-foreground` | 에러 |
| `--warn` #cca700 | `--vscode-editorWarning-foreground` | 경고 |
| `--bg-input` #3c3c3c | `--vscode-input-background` | 입력 필드 |

**3계층 토큰 구조 유지, Primitive만 VS Code 변수로 교체:**
```css
:root {
  --color-bg-primary:   var(--vscode-editor-background);
  --color-bg-surface:   var(--vscode-sideBar-background);
  --color-text-primary: var(--vscode-editor-foreground);
  --color-interactive:  var(--vscode-focusBorder);
  /* → Component 계층은 변경 불필요 */
}
```
VS Code가 body에 `vscode-dark`, `vscode-light`, `vscode-high-contrast` 클래스를 자동 주입 → 별도 감지 로직 불필요.

**리스크:**
1. `--vscode-*` 변수 undefined 폴백 필수 (구버전 테마)
2. WCAG 대비 — 커뮤니티 테마에서 대비 3:1 미만 가능 → 아이콘+텍스트 병행
3. High Contrast 모드 — 픽셀아트 하드코딩 색상 대응 불가 → HC 전용 border 오버레이
4. AgentCard rgba 하드코딩 → VS Code 변수 기반으로 교체

**AgentCard 6상태 시각 스펙:** idle/selected/running/streaming/done/error 각각 border, 배경, 인디케이터, 아이콘, 텍스트 정의 완료.

**픽셀아트 크기 정규화:** 사이드바 36px → 32px (16×2) 변경 권장. 비정수 비율(2.25배)은 pixelated 렌더링에서 흐릿함 유발.

> **태준에게 묻고 싶은 것**: 에이전트 스트리밍 청크 메시지 구조가 `{ type: 'chunk', agentId, text }` (append) vs 전체 교체인지에 따라 DOM 업데이트 전략이 달라진다. 초당 postMessage 빈도도 알려달라.

---

### 승호 (UX 디자인 · 7년차 mid · Sonnet)

**목업 방향은 맞는데, VS Code Extension 환경 맥락이 UX에 반영 안 됐다.**

Figma 플러그인 경험상 "웹앱 UX를 플러그인에 이식"하면 태스크 완료율이 급락함. VS Code에서는 마우스보다 키보드, 팝업보다 인라인이 기본.

**3개 플로우 제안 (Flow C 추천):**

- Flow A "사이드바 단일": 현재 목업 방향. 장점: 학습 비용 없음. 단점: 사이드바 공간에서 회의 방식 5초 이해 불가
- Flow B "Command Palette 하이브리드": Quick Pick으로 방식 설명 가능. 단점: 시각적 피드백 사라짐
- **Flow C "사이드바 + Panel 분리" (추천)**: 사이드바=설정, Panel=실행. VS Code 멘탈 모델에 가장 가깝고 비용 실시간 표시 가능

**핵심 UX 설계:**

**온보딩 3단계:**
1. API 키 없음 → 사이드바 전체: 빈 일러스트 + "API 키 필요" + 다른 기능 전부 disabled
2. 팀원 0명 → "profiles.json 수정" 안내 + [파일 열기] 버튼
3. 첫 회의 → 코치마크 말풍선: "처음이라면 '팀 심층 분석'으로 시작하세요"

**낙관적 UI 3단계:**
- 0ms: 버튼 로딩 + 패널 열림 + 8개 카드 "대기 중" 미리 렌더
- 100~500ms: 카드 "요청 전송됨" dots 애니메이션
- 첫 응답: streaming 전환 + aria-live 알림

**에러 복구:**
- Rate Limit: 상단 sticky 배너 + 카운트다운 + [지금 재시도]
- 개별 에러: 카드 내 [재시도] + 에러 이유 + 재시도 카운터 "1/3"

**컨텍스트 회의:** 코드 선택 → 우클릭 → 주제 자동 채움 "[함수명]: 리뷰" + 인풋 포커스+전체 선택 + "코드 12줄 첨부됨" 표시

**WCAG AA v1 필수 3개:**
1. 색상만으로 상태 구분 금지 → 아이콘+텍스트 항상 병행
2. `:focus-visible` 전역 적용 (outline 2px solid var(--accent))
3. 아이콘 버튼에 `aria-label` 명시 추가

> **태준에게 묻고 싶은 것**: Webview가 re-render 시 스트리밍 중인 카드 텍스트 초기화 문제. 상태를 Extension Host에서 버퍼링 후 전달인지, Webview 로컬 state인지에 따라 UX 설계가 달라진다.

---

## 주요 합의점

1. **Sidebar + Panel 분리 구조** — 전원 동의. 목업 레이아웃이 VS Code 패턴과 정확히 매핑
2. **meeting-team 1종 먼저 완성** — 지민/현우/소연 합의. meeting-multi/agent는 v2로 (소연은 meeting-team만으로 핵심 가치 검증 가능 판단)
3. **Extension Host가 모든 API 호출 독점** — 태준/윤서/지민 확인. Webview는 렌더링 전용
4. **VS Code CSS 변수 전면 채택** — 다은이 11개 변수 매핑 표 제시. 3계층 토큰 구조 유지, Primitive만 교체
5. **API 키 보안** — 윤서 CRITICAL. SecretStorage만. Webview 전달 금지. logger 필터링 필수
6. **메시지 타입 정의 우선 확정** — 태준이 타입 유니온 제시. 지민: "Phase 1 첫째 날에 나와야"
7. **낙관적 UI** — 현우/승호 합의. 버튼 클릭 즉시 패널 열림 + 카드 "대기 중" 미리 렌더
8. **스트리밍 청크 배치 처리** — 태준(50ms Host 배치) + 미래(100ms Webview throttle) 이중 디바운스
9. **픽셀아트 아바타 32px 정규화** — 다은 제안. 16의 배수로 pixelated 렌더링 선명도 확보
10. **비용 예측은 v1에서 정적 계산만** — 지민 확정. 실행 중 실시간 반영은 v2

## 주요 충돌 지점

| 쟁점 | 의견들 | 결론 필요 |
|------|--------|----------|
| v1 회의 모드 수 | 소연: meeting-team 1종, 지민: 1종 먼저 안정화 후 추가 | **1종(meeting-team)** |
| Phase 3 공수 | 지민: 13일 전체, 태준: Extension Host만 7일 | 태준 7일 + 미래 FE 공수 합산 필요 |
| 스트리밍 배치 위치 | 태준: Extension Host 50ms, 미래: Webview 100ms throttle | **이중 배치** (양쪽 다) |
| PixelAvatar 구현 | 미래: dangerouslySetInnerHTML + useMemo, 지민: 정적 SVG import | 미래 방식 수용 (useMemo 캐싱이면 성능 OK) |
| ACK 패턴 | 태준: 완료 메시지만 ACK, 윤서: done 후 추가 청크 무시 방어 필수 | **chunkIndex + agentDone에 fullContent** |
| Webview 메시지 유실 대응 | 태준: retainContextWhenHidden=true, 윤서: 양쪽 설정 다 테스트 | **true 설정 + 메모리 측정** |
| 온보딩 범위 | 승호: 3단계 필수, 현우: 즉각 피드백이 우선 | **v1에 기본 포함** |

## 서로에게 던진 질문들

| 질문자 | 대상 | 질문 | 다음 회의 아젠다 |
|--------|------|------|----------------|
| 지민 | 태준 | Anthropic API RPM은? Free tier에서 8명 동시 호출 가능한가? | **stagger 간격 확정** |
| 현우 | 태준 | 버튼 클릭→첫 청크 도달 시간 예상? 1초 vs 3초 | **피드백 상태 전략** |
| 소연 | 태준 | rate limit으로 stagger 시 "동시 스트리밍" 가치 명제 무너지지 않나? | **병렬성 vs 안정성 트레이드오프** |
| 태준 | 미래 | 스트리밍 chunk 버퍼링 — Extension Host 배치 vs Webview throttle? | **배치 전략 확정** |
| 미래 | 태준 | Panel 미열림 상태에서 회의 시작 시 race condition 처리? | **Panel 초기화 시퀀스** |
| 윤서 | 개발팀 | 취소 시 AbortController.abort() 실제 호출 확인. 비용 누수 시나리오 | **abort 경로 검증** |
| 다은 | 태준 | agentStream 메시지 구조 — append vs 전체 교체? 초당 빈도? | **DOM 업데이트 전략** |
| 승호 | 태준 | Webview re-render 시 스트리밍 상태 초기화 문제 — 버퍼링 위치? | **상태 복원 전략** |

## 권장 다음 액션

1. **즉시 (Day 0)**: `messages.ts` 타입 정의 확정 — 태준 주도, 미래/윤서 리뷰. 이게 FE/BE 인터페이스 계약서
2. **Phase 1 시작 (Day 1~)**: Extension 프로젝트 초기화 + Sidebar Provider + Webview 통신 POC — 태준/미래 페어
3. **병행**: 다은의 `vscode-theme-variables.css` 매핑 파일 작성 + 승호의 온보딩 3단계 스펙 문서화
4. **선행 확인**: Anthropic API rate limit 실측 (태준) — stagger 간격 확정이 Phase 3 일정 전체를 좌우
5. **skill-pd.md 갱신**: Electron → VS Code Extension 맥락으로 마일스톤/Quality Gate 업데이트 — 지민 담당
