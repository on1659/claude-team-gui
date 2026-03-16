# Claude Team GUI — VS Code Extension 구현 문서

> 작성일: 2026-03-13
> 근거: 3종 회의 결과 (meeting-vscode-extension-ux/) + 5가지 검토 결과 + 팀 회의 (meeting-team)

---

## 이 폴더의 목적

`docs/impl/`는 **구현 단계에서 직접 참조하는 개발 문서**입니다.

- `docs/vscode-extension/01-architecture.md` = 아키텍처 설계 (왜, 무엇을)
- `docs/impl/` = 구현 명세 (어떻게, 구체적으로)
- `docs/meeting-vscode-extension-ux/` = 회의 원본 (의사결정 근거)

아키텍처 문서를 5가지 관점(기술 정합성, 회의 불일치, 멀티 모델, 보안/QA, 구현 가능성)으로 검토한 결과 CRITICAL 4건, HIGH 6건, MEDIUM 4건의 이슈가 발견되었고, 이 문서들은 해당 이슈를 모두 반영한 구현 명세입니다.

---

## 문서 목록 및 읽는 순서

```
00-overview.md          ← 지금 이 문서. 전체 조감도
    │
    ├── 01-type-definitions.md      타입 정의 (LLM, 메시지, 팀)
    │       ↕ 상호 참조
    ├── 02-extension-manifest.md    package.json + 빌드 설정
    │
    ├── 03-meeting-flow.md          회의 실행 흐름 + 상태머신
    │       ↕ 의존
    ├── 04-webview-ui-spec.md       UI 컴포넌트 + CSS 토큰
    │
    ├── 05-provider-abstraction.md  LLM Provider 추상화
    │
    ├── 06-qa-checklist.md          DoD + 테스트 시나리오
    │
    └── 07-milestone.md             마일스톤 + 일정 + 리스크
```

**권장 읽기 순서**:
1. `00-overview.md` (전체 파악)
2. `01-type-definitions.md` (타입이 모든 문서의 기초)
3. `05-provider-abstraction.md` (LLM 호출 구조)
4. `03-meeting-flow.md` (핵심 비즈니스 로직)
5. `02-extension-manifest.md` (프로젝트 설정)
6. `04-webview-ui-spec.md` (UI 구현)
7. `06-qa-checklist.md` (검증 기준)
8. `07-milestone.md` (일정 계획)

---

## 14개 이슈 → 문서 매핑표

### CRITICAL (4건)

| # | 이슈 | 해결 문서 | 해결 섹션 |
|---|------|-----------|-----------|
| 1 | 이중 디바운스 누락 (Host 50ms + Webview 100ms) | 03-meeting-flow.md | §3 디바운스 전략 |
| 2 | 낙관적 UI 플로우 누락 | 03-meeting-flow.md, 04-webview-ui-spec.md | §4 낙관적 UI, §2 ActionBar |
| 3 | Markdown 복사/저장 스펙 전무 | 04-webview-ui-spec.md | §5 결과 복사/저장 |
| 4 | LLMMessage 타입 과도 단순화 | 01-type-definitions.md, 05-provider-abstraction.md | §1 LLMMessage, §2 system prompt |

### HIGH (6건)

| # | 이슈 | 해결 문서 | 해결 섹션 |
|---|------|-----------|-----------|
| 5 | package.json contributes 미정의 | 02-extension-manifest.md | §1 contributes 전문 |
| 6 | team.json 배포 경로 | 02-extension-manifest.md | §3 파일 경로 |
| 7 | Vite 멀티 엔트리포인트 | 02-extension-manifest.md | §4 Vite 설정 |
| 8 | AgentCard 부분 실패 상태머신 | 03-meeting-flow.md, 04-webview-ui-spec.md | §5 상태머신, §3 AgentCard |
| 9 | AbortController 취소 경로 | 03-meeting-flow.md | §6 취소 경로 |
| 10 | 비용 추정 토큰 과소 | 05-provider-abstraction.md | §4 비용 추정 |

### MEDIUM (4건)

| # | 이슈 | 해결 문서 | 해결 섹션 |
|---|------|-----------|-----------|
| 11 | LLMStreamEvent stopReason 없음 | 01-type-definitions.md | §1.2 LLMStreamEvent |
| 12 | 토큰 카운팅 API 미포함 | 05-provider-abstraction.md | §3 countTokens |
| 13 | seq 손실 복구 전략 | 03-meeting-flow.md | §7 seq 손실 대응 |
| 14 | gpt-4.1-nano 모델명 오류 | 05-provider-abstraction.md | §1 tier 매핑 |

---

## 핵심 설계 원칙 (전 문서 공통)

| 원칙 | 설명 | 근거 |
|------|------|------|
| **Provider Agnostic** | LLM 제공자 추상화. Claude 외 모델로 교체 가능 | 사용자 요구사항 |
| **Sidebar + Panel 분리** | 사이드바 = 팀 관리, 패널 = 회의 결과 | 3종 회의 전원 합의 |
| **Host 독점 통신** | 모든 API 호출은 Extension Host에서만 | 3종 회의 전원 합의 |
| **VS Code 네이티브** | CSS 변수 테마 연동, SecretStorage 키 관리 | 3종 회의 전원 합의 |
| **낙관적 UI** | 버튼 즉시 → 카드 렌더 → 스트리밍 | 3종 회의 전원 합의 |

---

## 기술 스택

| 항목 | 결정 | 비고 |
|------|------|------|
| Extension Host | TypeScript + Node.js | VS Code Extension API |
| Webview | React 18 + Vite + TypeScript | Sidebar/Panel 각각 빌드 |
| 스타일 | VS Code CSS 변수 + 디자인 토큰 3계층 | shadcn은 v2 |
| LLM SDK | @anthropic-ai/sdk (v1) | v2에서 openai, @google/generative-ai 추가 |
| 상태관리 | React useReducer | Zustand 불가 (Webview 간 공유 X) |
| 빌드 Host | esbuild | external: ['vscode'] |
| 빌드 Webview | Vite (rollup) | 멀티 엔트리포인트 |

---

## v1 스코프

### 포함
- Anthropic Provider (기본)
- 빠른 회의 (quick/meeting-multi) + 심층 회의 (deep/meeting-team)
- Sidebar + Panel 분리 Webview
- 픽셀아트 아바타 (React PixelAvatar)
- VS Code CSS 변수 20개 매핑 + 3계층 디자인 토큰
- SecretStorage API 키 관리 (Provider별 분리)
- 비용 예측 (정적 계산, 보정된 토큰)
- 결과 Markdown 복사/저장
- AgentCard 6상태 머신
- 이중 디바운스 + 낙관적 UI
- AbortController 취소 경로

### v2 이후
- OpenAI / Gemini Provider 추가
- Provider 선택 UI (Sidebar 드롭다운)
- 프로필 GUI 편집
- 회의 이력 관리
- office.html 픽셀아트 씬 (Extension 내부)
- 실시간 토큰 카운팅 (countTokens API)
- 커스텀 Provider 플러그인 시스템

---

## 디렉토리 구조 (구현 목표)

```
extension/
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── vite.config.ts
├── src/
│   ├── extension.ts                  # activate/deactivate
│   ├── types/
│   │   ├── llm.ts                    # LLMProvider, LLMMessage, LLMStreamEvent
│   │   ├── messages.ts               # WebviewMessage, HostMessage
│   │   └── team.ts                   # TeamMember, MeetingConfig
│   ├── services/
│   │   ├── llm-registry.ts           # Provider 등록/조회
│   │   ├── meeting-service.ts        # 회의 실행 + stagger + abort
│   │   ├── cost-estimator.ts         # 비용 추정 (estimateCost)
│   │   ├── profile-manager.ts        # team.json 로드
│   │   └── config-service.ts         # Extension 설정 + SecretStorage + hasKey 통합
│   ├── providers/
│   │   ├── anthropic.ts              # AnthropicProvider (v1)
│   │   ├── openai.ts                 # OpenAIProvider (v2 stub)
│   │   └── gemini.ts                 # GeminiProvider (v2 stub)
│   ├── host/
│   │   ├── sidebar-provider.ts       # WebviewViewProvider
│   │   └── panel-manager.ts          # WebviewPanel 관리
│   └── webview/
│       ├── sidebar/
│       │   ├── index.html
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── TeamList.tsx
│       │   ├── MemberCard.tsx
│       │   ├── CostEstimate.tsx
│       │   └── MeetingConfig.tsx
│       ├── panel/
│       │   ├── index.html
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── MeetingHeader.tsx
│       │   ├── ProgressBar.tsx
│       │   ├── AgentGrid.tsx
│       │   ├── AgentCard.tsx
│       │   ├── SummaryView.tsx
│       │   └── ActionBar.tsx
│       └── shared/
│           ├── PixelAvatar.tsx
│           ├── tokens/
│           │   ├── primitive.css
│           │   ├── semantic.css
│           │   └── component.css
│           └── hooks/
│               └── useVscodeMessage.ts
├── data/
│   └── team.json
└── media/
    └── icon.svg
```
