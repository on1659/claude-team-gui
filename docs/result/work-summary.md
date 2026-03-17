# Claude Team GUI — 작업 결과 문서

> 작성일: 2026-03-17
> 프로젝트: VS Code Extension "Claude Team" — AI 팀원과 함께하는 멀티에이전트 회의

---

## 프로젝트 개요

VS Code 사이드바에서 실행하는 멀티에이전트 회의 도구. 8명의 AI 팀원(PD, 기획자 2명, 개발자 2명, QA, UI, UX)이 각자의 역할과 스킬로 동시에 회의를 진행하고, 회의 결과를 복사·저장·이력 조회할 수 있는 익스텐션.

- **최종 산출물**: `extension/claude-team-gui-0.1.0.vsix` (452 KB)
- **지원 LLM**: Anthropic Claude, Claude Code CLI, OpenAI GPT, Google Gemini
- **빌드 상태**: TypeScript 0 errors, console.log 전체 제거

---

## 개발 사이클 이력

총 3개 개발 사이클 완료. 각 사이클은 팀 회의 → PD 보고서 → 개발 → QA → 버그수정 프로세스를 따름.

| 사이클 | 기간 | 주요 내용 | 결과 |
|--------|------|---------|------|
| vscode-extension-v2 | 2026-03-15 | VS Code Extension 전체 구조 구현 | ✅ CLOSED |
| m2-remaining | 2026-03-16 | 회의 실행 엔진 잔여 작업 (진행률·요약) | ✅ CLOSED |
| m3-export-qa-packaging | 2026-03-17 | 내보내기·QA·패키징 마무리 | ✅ CLOSED |

---

## 사이클 1: vscode-extension-v2

**목표**: VS Code Extension 기반 구조 + 핵심 기능 전체 구현

### 구현된 기능

#### 핵심 아키텍처
- **MeetingResultStore** (`services/meeting-result-store.ts`) — Host-side 회의 결과 저장소. webview가 dispose되어도 데이터 유지
- **MeetingHistoryService** (`services/meeting-history-service.ts`) — `.claude-team/history/` 파일 기반 회의 이력. 페이지네이션, path traversal 방지
- **LLMRegistry** — 프로바이더 플러그인 시스템. `AnthropicProvider`, `OpenAIProvider`, `GeminiProvider` 3종 등록

#### LLM 프로바이더 (4종)

| 프로바이더 | 파일 | 인증 방식 | 특이사항 |
|-----------|------|---------|---------|
| Anthropic Claude | `providers/anthropic.ts` | API Key (SecretStorage) | 스트리밍 chunk 단위 |
| Claude Code CLI | `providers/claude-code.ts` | CC 토큰 자동 사용 | 서브프로세스 실행 |
| OpenAI GPT | `providers/openai.ts` | API Key | `stream_options.include_usage` 토큰 집계 |
| Google Gemini | `providers/gemini.ts` | API Key | `systemInstruction` 별도 전달, `role: model` 변환 |

#### UI 컴포넌트
- **Panel**: `AgentGrid`, `AgentCard`, `MeetingHeader`, `ProgressBar`, `SummaryView`, `ActionBar`
- **Sidebar**: `ProviderSelect` (Segmented Control), `HistoryView` (목록/상세), 탭 구조 (Team | History)
- **OfficeView**: 픽셀아트 오피스 배경 + 8인 팀원 캐릭터 애니메이션

#### 보안
- `SidebarProvider.handlePanelMessage()` — `ALLOWED_MESSAGE_TYPES` 화이트리스트로 알 수 없는 메시지 타입 차단
- 회의 중 프로바이더 전환 차단 (`currentMeetingId` 가드)

### QA 발견 버그: 20개
| 심각도 | 수 | 주요 내용 |
|--------|-----|---------|
| CRITICAL | 1 | `startMeeting` 커맨드가 실제 회의를 시작하지 않음 (BUG-17) |
| MAJOR | 5 | ActionBar 낙관적 상태, path traversal, null 토큰, 회의중 전환 |
| MINOR/COSMETIC | 14 | v3 이관 |

**수정 완료**: 8개 (CRITICAL 1 + MAJOR 4 + MINOR 2), 잔여 12개 → m2/m3 사이클 이관

---

## 사이클 2: m2-remaining

**목표**: 회의 실행 엔진 잔여 작업 — 진행률 컴포넌트, 회의 요약, 신호 관리

### 구현된 기능

#### ProgressBar (신규, `webview/panel/ProgressBar.tsx`)
- 인라인 `progress` 스타일 → 독립 컴포넌트로 분리
- progress 값 클래핑: `Math.min(100, Math.max(0, progress))` — 범위 초과 방지
- ARIA 속성: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- cancelled 상태: `opacity: 0, visibility: hidden` (레이아웃 점프 방지)

#### SummaryView (신규, `webview/panel/SummaryView.tsx`)
- 프로그레시브 디스클로저 패턴 — "요약 보기" 토글로 전체 결과 확장
- 합의점 / 충돌 / 다음 액션 / 총비용 / 소요시간 표시
- `opinions` 빈 배열 가드 — 빈 `<ul>` 렌더 방지
- `totalCost === 0` 시 "$0.0000" 대신 비표시

#### MeetingService 개선 (`services/meeting-service.ts`)
- **combinedSignal**: `AbortSignal.any()` 대신 수동 복합 시그널 구현 — cancel + timeout 신호 조합
- **generateSummaryViaLLM**: signal 전달 추가 — 취소 시 LLM 요약 생성도 중단
- cleanup 누락 수정: error 핸들러 경로에서 타이머 leak 방지
- LLM 출력 스키마 검증: `Array.isArray` + 개별 요소 타입 검증

### QA 결과: 3회 반복
| 반복 | 통과율 | 주요 발견 |
|------|--------|---------|
| #0 | 87% (27/31) | BUG-1 타이머 leak, BUG-2 SummaryView crash |
| #1 | 100% | signal 미전달, 타입 미검증, 빈 opinions |
| #2 | 100% | attempt 일관성, 비용 표시 |

---

## 사이클 3: m3-export-qa-packaging

**목표**: 내보내기 기능 완성, 전수 QA, DoD 검증, .vsix 패키징

### 구현된 기능 (사이클 #0)

#### ActionBar 접근성 (`webview/panel/ActionBar.tsx`)
- 이모지 `aria-hidden="true"` 처리
- 버튼 `aria-label` 추가: "Markdown으로 복사", "파일로 저장", "회의 중단"

#### SummaryView 접근성 (`webview/panel/SummaryView.tsx`)
- 토글 버튼: `aria-expanded={expanded}`, `aria-controls="summary-expanded-sections"`
- 섹션 div: `id="summary-expanded-sections"`

#### AgentCard 오류 영역 (`webview/panel/AgentCard.tsx`)
- 에러 div: `role="alert"` — 스크린 리더 즉시 알림

#### CSS 애니메이션 통일 (`webview/shared/tokens/component.css`)
- `@keyframes blink { 50% { opacity: 0; } }` — cursorBlink와 opacity 값 통일 (기존 0.3 → 0)

#### config-service.ts DoD#7 — SecretStorage 롤백 (BUG-C1 수정)
```typescript
// Thenable<void>에 .catch() 불가 → try/catch로 교체
const oldKey = await this.secrets.get(`claude-team.apiKey.${providerId}`) ?? null;
try {
  await this.secrets.store(`claude-team.apiKey.${providerId}`, apiKey);
} catch (err: any) {
  if (oldKey !== null) {
    try { await this.secrets.store(`claude-team.apiKey.${providerId}`, oldKey); }
    catch { /* 롤백 실패는 무시 */ }
  }
  return { valid: false, error: `Failed to store key: ${err.message}` };
}
```
> **핵심 학습**: `vscode.SecretStorage`는 `Thenable<void>` 반환 — Promise가 아니므로 `.catch()` 체이닝 불가. 반드시 `try/catch` 사용.

### 구현된 기능 (사이클 #1)

#### console.log 전수 제거 (BUG-CO1)
- providers/ 레이어에서 API 응답 텍스트를 slice해서 출력하던 로그 발견 → API 키 노출 가능성으로 P0 격상 후 즉시 제거
- `anthropic.ts`: 1건, `claude-code.ts`: 11건 제거

#### setApiKey 빈 문자열 가드 (BUG-M1)
```typescript
if (!apiKey || !apiKey.trim()) {
  return { valid: false, error: 'API 키를 입력해주세요' };
}
```

#### handleRetry 방어 가드 (BUG-M2)
```typescript
const agentState = meeting.agents[agentId];
if (!agentState || agentState.type !== 'error' || !agentState.retryable) return;
```
- `done`, `streaming`, `retrying` 상태 에이전트에 대한 서버 retryAgent 호출 차단

### console.log 제거 총계 (전 사이클 통합)

| 파일 / 레이어 | 제거 건수 |
|-------------|---------|
| `providers/anthropic.ts` | 1 |
| `providers/claude-code.ts` | 11 |
| `services/meeting-service.ts` | 6 |
| `host/panel-manager.ts` | 5 |
| `webview/panel/App.tsx` | 8 |
| `webview/shared/hooks/useChunkBuffer.ts` | 4 |
| `extension.ts` | 2 |
| `SidebarProvider.ts` | 4 |
| **합계** | **41건** (+ m2 사이클 분 합산 시 ~46건) |

### .vsix 패키징 결과

| 항목 | 결과 |
|------|------|
| 파일명 | `claude-team-gui-0.1.0.vsix` |
| 크기 | **452 KB** |
| 포함 파일 | 23개 |
| TypeScript 오류 | 0건 |
| console.log 잔존 | 0건 |
| 빌드 | esbuild (extension host) + Vite 5 (webview) |

---

## 전체 파일 변경 목록

### 신규 생성 (9개)
| 파일 | 사이클 | 설명 |
|------|--------|------|
| `services/meeting-result-store.ts` | v2 | Host-side 회의 결과 저장소 |
| `services/meeting-history-service.ts` | v2 | 파일 기반 회의 이력 서비스 |
| `providers/openai.ts` | v2 | OpenAI GPT 스트리밍 프로바이더 |
| `providers/gemini.ts` | v2 | Google Gemini 스트리밍 프로바이더 |
| `webview/sidebar/ProviderSelect.tsx` | v2 | Segmented Control 프로바이더 선택기 |
| `webview/sidebar/HistoryView.tsx` | v2 | 회의 이력 목록/상세 뷰 |
| `webview/panel/ProgressBar.tsx` | m2 | 독립 진행률 바 컴포넌트 |
| `webview/panel/SummaryView.tsx` | m2/m3 | 회의 요약 프로그레시브 디스클로저 |
| `auth/oauth-service.ts` | v2 | API 키 로그인 플로우 |

### 주요 수정 (14개)
| 파일 | 사이클 | 주요 변경 |
|------|--------|---------|
| `extension.ts` | v2, m3 | 3프로바이더 등록, QuickPick, console.log 제거 |
| `SidebarProvider.ts` | v2, m3 | ALLOWED_MESSAGE_TYPES 화이트리스트, copy/save 실구현 |
| `services/meeting-service.ts` | m2, m3 | combinedSignal, generateSummaryViaLLM, console.log 제거 |
| `services/config-service.ts` | m3 | SecretStorage try/catch 롤백, 빈 문자열 가드 |
| `types/messages.ts` | v2 | History/Provider 타입 확장 |
| `host/panel-manager.ts` | m3 | console.log 제거 |
| `webview/panel/App.tsx` | v2, m2, m3 | copy/save 상태, cancelled attempt:0, handleRetry 가드 |
| `webview/panel/ActionBar.tsx` | v2, m3 | status props 패턴, aria-label |
| `webview/panel/AgentCard.tsx` | m2, m3 | retrying 라벨, role="alert" |
| `webview/panel/MeetingHeader.tsx` | m2 | ProgressBar 컴포넌트 교체 |
| `webview/shared/hooks/useChunkBuffer.ts` | m3 | console.log 제거 |
| `webview/shared/tokens/component.css` | m3 | @keyframes blink 통일 |
| `providers/anthropic.ts` | m3 | console.log 제거 |
| `providers/claude-code.ts` | m3 | console.log 제거 |

---

## DoD (Definition of Done) 최종 체크리스트

| 항목 | 상태 |
|------|------|
| TypeScript 0 errors (`npm run typecheck`) | ✅ |
| console.log 전체 제거 (extension/src/) | ✅ 0건 |
| 보안: Webview 메시지 화이트리스트 | ✅ ALLOWED_MESSAGE_TYPES |
| 보안: SecretStorage 롤백 | ✅ try/catch 패턴 |
| 보안: API 응답 텍스트 로그 제거 | ✅ providers/ 전수 점검 |
| 접근성: aria-* 속성 (ActionBar, SummaryView, AgentCard, ProgressBar) | ✅ |
| 애니메이션: @keyframes blink 정의 | ✅ |
| 멀티 프로바이더 지원 (Anthropic, CC, OpenAI, Gemini) | ✅ |
| 회의 결과 복사/저장 | ✅ |
| 회의 이력 저장/조회 | ✅ |
| .vsix 패키징 | ✅ 452 KB |

---

## 잔여 개선 사항 (v4 이관)

| ID | 심각도 | 내용 |
|----|--------|------|
| BUG-7 | MINOR | done 상태 에이전트에 retry 버튼 노출 — 가드 추가 필요 |
| BUG-8 | MINOR | Panel에 topic/mode 미표시 |
| BUG-11 | MINOR | Gemini `validateKey()` 실제 API 호출 사용 (비용 발생) |
| BUG-13 | MINOR | switch 문 non-exhaustive (타입 안전성) |
| BUG-14 | MINOR | History 상세 전환 시 이전 데이터 flash |
| BUG-19 | MINOR | Gemini SDK 네이티브 abort 미지원 |
| — | MINOR | History 검색/필터 기능 미구현 |
| — | MINOR | 프로필 편집 GUI 미구현 |

---

## 핵심 학습 & 설계 결정

### 1. vscode.SecretStorage는 Thenable
```typescript
// ❌ 잘못됨
this.secrets.store(key, val).catch(() => {});

// ✅ 올바름
try { await this.secrets.store(key, val); }
catch (err) { /* 롤백 */ }
```

### 2. combinedSignal — AbortSignal.any() 없이
```typescript
// AbortSignal.any()는 Node 환경 제약으로 미사용
const combined = new AbortController();
cancelSignal.addEventListener('abort', () => combined.abort());
timeoutSignal.addEventListener('abort', () => combined.abort());
```

### 3. Host-side 상태 관리
webview는 dispose되면 상태가 사라진다. 회의 결과는 반드시 extension host(Node.js 프로세스)에 저장. `MeetingResultStore`가 이 역할.

### 4. Gemini SDK 패턴
- `role: 'assistant'` → `role: 'model'` 변환 필요
- System prompt는 `model.startChat({ systemInstruction })` 형태로 별도 전달
- History와 마지막 메시지를 분리해서 `sendMessageStream(last)` 호출

### 5. providers/ 레이어 보안
API 응답 텍스트를 `console.log`로 출력하면 API 키 조각이나 민감 데이터 노출 위험. providers/ 전체를 scope에 포함해 점검 필요.

---

## 디렉토리 구조 (extension/src/)

```
extension/src/
├── extension.ts                    # 진입점, 프로바이더 등록
├── SidebarProvider.ts              # 사이드바 webview 호스트
├── auth/
│   └── oauth-service.ts            # API 키 로그인 플로우
├── host/
│   └── panel-manager.ts            # 패널 webview 호스트
├── providers/
│   ├── anthropic.ts                # Claude API 스트리밍
│   ├── claude-code.ts              # Claude Code CLI 래퍼
│   ├── openai.ts                   # OpenAI GPT 스트리밍
│   └── gemini.ts                   # Google Gemini 스트리밍
├── services/
│   ├── config-service.ts           # API 키 관리 (SecretStorage)
│   ├── llm-registry.ts             # 프로바이더 등록/조회
│   ├── meeting-service.ts          # 회의 실행 엔진
│   ├── meeting-result-store.ts     # Host-side 결과 저장소
│   ├── meeting-history-service.ts  # 파일 기반 이력 서비스
│   ├── profile-manager.ts          # 팀원 프로필 관리
│   └── cost-estimator.ts           # 토큰/비용 계산
├── types/
│   └── messages.ts                 # 모든 메시지 타입 정의
└── webview/
    ├── panel/                      # 회의 실행 패널
    │   ├── App.tsx                 # 패널 루트 컴포넌트
    │   ├── AgentGrid.tsx           # 에이전트 그리드 레이아웃
    │   ├── AgentCard.tsx           # 개별 에이전트 카드
    │   ├── MeetingHeader.tsx       # 회의 헤더 (topic, mode)
    │   ├── ProgressBar.tsx         # 진행률 바
    │   ├── SummaryView.tsx         # 회의 요약 뷰
    │   ├── ActionBar.tsx           # 복사/저장/중단 버튼
    │   ├── OfficeView.tsx          # 픽셀아트 오피스 배경
    │   └── SpeechBubble.tsx        # 말풍선 컴포넌트
    ├── sidebar/                    # 사이드바 컨트롤
    │   ├── App.tsx                 # 사이드바 루트 (탭)
    │   ├── ProviderSelect.tsx      # Segmented Control
    │   └── HistoryView.tsx         # 회의 이력 뷰
    └── shared/
        ├── hooks/
        │   └── useChunkBuffer.ts   # rAF 기반 청크 버퍼
        └── tokens/
            └── component.css       # 디자인 토큰 + 애니메이션
```
