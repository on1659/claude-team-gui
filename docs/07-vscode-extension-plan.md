# Claude Team GUI — VS Code Extension 개발 계획

> CLI 스킬로 검증한 AI 팀원 시스템을 VS Code 사이드바/패널로 구현

**작성일**: 2026-03-12
**변경 사유**: Electron → VS Code Extension 전환 (보조툴 성격에 적합)

---

## 1. 왜 VS Code Extension인가

### Electron 대비 이점

| 항목 | Electron | VS Code Extension |
|------|---------|------------------|
| 설치 | 별도 앱 (~150MB) | 마켓플레이스 or .vsix (~수 MB) |
| 사용 흐름 | 앱 전환 필요 | 코딩하다 사이드바에서 바로 |
| 파일 접근 | Node.js fs | VS Code Workspace API |
| API 키 보관 | OS 키체인 (keytar) | VS Code SecretStorage API |
| 테마 | 직접 구현 | VS Code 테마 자동 연동 |
| 배포 | 인스톨러 빌드 | .vsix or 마켓플레이스 |
| 유지보수 | Electron 버전 관리 | VS Code API만 |

### 제약사항 (수용 가능)

- UI가 Webview 안에서만 동작 (충분함 — React 앱 그대로 넣을 수 있음)
- VS Code 없이는 사용 불가 (타깃 사용자가 이미 VS Code 개발자)
- Webview는 Node.js 직접 접근 불가 → Extension Host를 통해 메시지 패싱

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────┐
│  VS Code                                            │
│                                                     │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │ Extension    │     │  Webview Panel (React)   │  │
│  │ Host (Node)  │◄───►│                          │  │
│  │              │ msg │  팀원 카드 UI             │  │
│  │ • API 호출   │     │  회의 실행 패널           │  │
│  │ • 파일 R/W   │     │  스트리밍 결과 표시       │  │
│  │ • 키 저장소  │     │  연차/연봉 설정           │  │
│  │ • 프로필 파싱│     │                          │  │
│  └──────────────┘     └──────────────────────────┘  │
│         │                                           │
│         ▼                                           │
│  ┌──────────────┐                                   │
│  │ Workspace    │                                   │
│  │ .claude/     │  ← 프로젝트 팀원 (워크스페이스 단위) │
│  │ profiles.json│                                   │
│  └──────────────┘                                   │
└─────────────────────────────────────────────────────┘
          │
          ▼  Anthropic API (HTTPS)
   ┌──────────────┐
   │ claude-sonnet │  ← 연봉(₩₩) 팀원
   │ claude-opus   │  ← 연봉(₩₩₩) 팀원
   │ claude-haiku  │  ← 연봉(₩) 팀원
   └──────────────┘
```

### 통신 구조

```
Webview (React)                    Extension Host (Node.js)
─────────────────                  ─────────────────────────
사용자 클릭 "회의 시작"     ──►    postMessage({type: 'startMeeting', ...})
                                       │
                                       ▼
                                   Anthropic API 병렬 호출 (8명)
                                       │
에이전트별 스트리밍 수신    ◄──    postMessage({type: 'agentStream', agent, chunk})
에이전트 완료              ◄──    postMessage({type: 'agentDone', agent, result})
전체 완료                  ◄──    postMessage({type: 'meetingDone', summary})
```

---

## 3. 기술 스택

| 영역 | 기술 | 이유 |
|------|------|------|
| Extension | TypeScript + VS Code API | 표준 |
| Webview UI | React 18 + TypeScript | 컴포넌트 재사용, 추후 Electron 전환 대비 |
| 스타일 | Tailwind CSS + VS Code 테마 변수 | 다크모드 자동 연동 |
| 빌드 | esbuild (Extension) + Vite (Webview) | 빠른 빌드 |
| API | @anthropic-ai/sdk | 공식 SDK, 스트리밍 지원 |
| 키 저장 | VS Code SecretStorage | OS 키체인 연동, 안전 |
| 상태관리 | Zustand | 경량, React 친화적 |
| 테스트 | Vitest + @vscode/test-electron | 유닛 + 통합 |

---

## 4. 데이터 모델

### profiles.json 스키마

기존 `meeting-team-profiles.md`를 JSON으로 전환. v1에서는 GUI 편집 UI 없이 파일 직접 수정.
워크스페이스 `.claude/profiles.json` 하나로 관리 (글로벌 경로 없음).

```typescript
interface TeamProfiles {
  version: 1;
  members: TeamMember[];
}

interface TeamMember {
  id: string;                        // "jimin", "hyunwoo", ...
  name: string;                      // "지민"
  role: TeamRole;                    // "PD"
  experience: number;                // 연차 (1~20+)
  experienceLevel: ExperienceLevel;  // 자동 매핑 or 수동 설정
  salary: SalaryGrade;              // 연봉 등급 → 모델 매핑
  profile: {
    description: string;             // 역할 설명
    criteria: string;                // 판단 기준
    focus: string[];                 // 분석 포커스
    outputFormat: string;            // 결과물 형식
    criticalRules: string[];         // 절대 규칙
    communicationStyle: string;      // 커뮤니케이션 스타일
  };
  skillFile?: string;                // 스킬 파일 경로 (옵션)
  active: boolean;                   // 회의 참여 여부
}

type TeamRole = 'PD' | 'PLANNER_RESEARCH' | 'PLANNER_STRATEGY'
  | 'BACKEND' | 'FRONTEND' | 'QA' | 'UI' | 'UX';

type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead';

type SalaryGrade = 'low' | 'medium' | 'high';

// 연차 → 레벨 자동 매핑
// 1-3년 → junior, 4-7년 → mid, 8-12년 → senior, 13년+ → lead

// 연봉 → 모델 매핑
// low (₩) → claude-haiku-4-5-20251001
// medium (₩₩) → claude-sonnet-4-6
// high (₩₩₩) → claude-opus-4-6
```

### 회의 결과 스키마

```typescript
interface MeetingResult {
  id: string;                        // UUID
  timestamp: string;                 // ISO 8601
  topic: string;                     // 회의 주제
  mode: 'meeting' | 'meeting-multi' | 'meeting-agent' | 'meeting-team';
  participants: {
    memberId: string;
    name: string;
    role: TeamRole;
    experienceLevel: ExperienceLevel;
    model: string;                   // 실제 사용된 모델
  }[];
  responses: {
    memberId: string;
    content: string;                 // 응답 전문
    status: 'success' | 'error' | 'timeout';
    tokenUsage: { input: number; output: number; };
    durationMs: number;
  }[];
  summary?: string;                  // 전체 요약 (오케스트레이터)
  totalCost: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

---

## 5. 화면 구성

### 5-1. 사이드바: 팀원 관리

```
┌─ CLAUDE TEAM ──────────────────┐
│                                │
│  팀원 (워크스페이스)             │
│  ┌────────────────────────┐    │
│  │ 🎯 지민 · PD            │    │
│  │ senior 10y · ₩₩₩       │    │
│  │ ☑ 참여                  │    │
│  └────────────────────────┘    │
│  ┌────────────────────────┐    │
│  │ 🔍 현우 · 기획(리서치)   │    │
│  │ mid 5y · ₩₩             │    │
│  │ ☑ 참여                  │    │
│  └────────────────────────┘    │
│  ... (8명)                     │
│                                │
├────────────────────────────────┤
│  참여: 8/8명                    │
│  예상 비용: ~18,100 토큰        │
│  예상 금액: ~$0.12              │
│                                │
│  [▶ 회의 시작]                  │
└────────────────────────────────┘
```

### 5-2. 패널: 회의 실행 & 결과

```
┌─ TEAM MEETING ─────────────────────────────────────────────┐
│                                                            │
│  주제: VS Code Extension 아키텍처 리뷰                      │
│  방식: meeting-team · 참여 8명 · 진행 중 (6/8 완료)         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 75%               │
│                                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 지민 (PD) ✅         │  │ 현우 (기획①) ✅      │          │
│  │ senior · Opus        │  │ mid · Sonnet        │          │
│  │                     │  │                     │          │
│  │ [Go] 4주 일정 내     │  │ 타깃 사용자는 Claude │          │
│  │ 구현 가능. 단, API   │  │ Code 사용 개발자.   │          │
│  │ 스트리밍 병렬 처리가 │  │ 핵심 유스케이스:    │          │
│  │ 크리티컬 패스...     │  │ 1. 코딩 중 팀 회의  │          │
│  └─────────────────────┘  └─────────────────────┘          │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 소연 (기획②) ✅      │  │ 태준 (BE) ⏳         │          │
│  │ senior · Sonnet     │  │ mid · Sonnet        │          │
│  │                     │  │                     │          │
│  │ v1 KPI 제안:        │  │ Extension Host에서  │          │
│  │ - MAU 100+          │  │ API 호출 구조는...  │          │
│  │ - 회의 실행률 70%+   │  │ ████████░░ 스트리밍 │          │
│  └─────────────────────┘  └─────────────────────┘          │
│  ...                                                       │
│                                                            │
│  ┌─ 요약 ──────────────────────────────────────────────┐   │
│  │ (전체 완료 후 표시)                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  [결과 저장] [새 회의] [Markdown 복사]                       │
└────────────────────────────────────────────────────────────┘
```

---

## 6. 회의 실행 흐름

### meeting-team (주요)

```
1. 사용자: 주제 입력 + 팀원 선택 + 방식 선택
2. Extension Host:
   a. 선택된 팀원의 프로필 + 스킬 파일 로드
   b. 팀원별 시스템 프롬프트 구성:
      - 기본 프로필 (역할, 판단기준, 분석포커스...)
      - 연차별 행동 프리셋 (스킬 파일에서 experienceLevel에 해당하는 섹션)
      - Critical Rules
   c. 팀원별 모델 결정 (salary → model 매핑)
   d. Promise.allSettled로 병렬 API 호출
      - 각 호출은 독립 스트리밍
      - 실패 시 자동 retry (최대 3회, exponential backoff)
3. Webview: 카드별 실시간 스트리밍 표시
4. 전체 완료 후: 오케스트레이터가 요약 생성 (선택사항)
5. 결과 저장: workspace docs/meetings/results/ 에 JSON + MD
```

### 상태 전이 (Q6 결정사항 반영)

```
Meeting.status:
  idle → configuring → running → done
                          ↓
                        error (전체 실패 시)

AgentCard.status:
  idle → selected → running → streaming → done
                                  ↓
                                error → retrying → streaming (최대 3회)
                                                     ↓
                                                   error (최종 실패)
```

---

## 7. 핵심 모듈 구조

```
claude-team-gui/
├── src/
│   ├── extension/                    # Extension Host (Node.js)
│   │   ├── extension.ts              # activate/deactivate 진입점
│   │   ├── sidebar-provider.ts       # 사이드바 Webview Provider
│   │   ├── panel-provider.ts         # 회의 패널 Webview Provider
│   │   ├── services/
│   │   │   ├── anthropic.ts          # Anthropic API 래퍼
│   │   │   ├── meeting-runner.ts     # 회의 실행 오케스트레이터
│   │   │   ├── profile-loader.ts     # profiles.json 로드/파싱
│   │   │   ├── skill-loader.ts       # 스킬 파일 로드 + 연차 프리셋 추출
│   │   │   ├── prompt-builder.ts     # 프로필+스킬→시스템프롬프트 조합
│   │   │   ├── model-mapper.ts       # salary → model ID 매핑
│   │   │   └── secret-storage.ts     # API 키 SecretStorage 래퍼
│   │   └── types/
│   │       ├── team.ts               # TeamMember, TeamProfiles
│   │       ├── meeting.ts            # MeetingResult, MeetingConfig
│   │       └── messages.ts           # Webview ↔ Extension 메시지 타입
│   │
│   └── webview/                      # Webview (React)
│       ├── App.tsx                   # 루트
│       ├── components/
│       │   ├── sidebar/
│       │   │   ├── TeamList.tsx       # 팀원 목록
│       │   │   ├── MemberCard.tsx     # 팀원 카드 (이름, 연차, 연봉)
│       │   │   ├── CostEstimate.tsx   # 예상 비용 표시
│       │   │   └── MeetingLauncher.tsx # 회의 시작 버튼 + 설정
│       │   └── panel/
│       │       ├── MeetingPanel.tsx    # 회의 진행 패널
│       │       ├── AgentCard.tsx       # 에이전트별 스트리밍 카드
│       │       ├── ProgressBar.tsx     # 전체 진행률
│       │       └── SummaryView.tsx     # 요약 패널
│       ├── hooks/
│       │   ├── useVSCodeAPI.ts        # VS Code postMessage 래퍼
│       │   ├── useMeeting.ts          # 회의 상태 관리
│       │   └── useTeam.ts            # 팀원 상태 관리
│       ├── stores/
│       │   ├── teamStore.ts           # 팀원 Zustand 스토어
│       │   └── meetingStore.ts        # 회의 Zustand 스토어
│       └── styles/
│           └── vscode-theme.css       # VS Code CSS 변수 매핑
│
├── resources/                         # 아이콘 등 정적 자원
├── package.json                       # Extension manifest
├── tsconfig.json
├── vite.config.ts                     # Webview 빌드
└── esbuild.config.mjs                 # Extension 빌드
```

---

## 8. 개발 단계

### Phase 1: 기반 세팅 (3일)

- [ ] VS Code Extension 프로젝트 초기화 (`yo code`)
- [ ] Webview Provider 기본 구조 (사이드바 + 패널)
- [ ] React + Vite + Tailwind Webview 세팅
- [ ] Extension ↔ Webview 메시지 통신 확인
- [ ] `profiles.json` 스키마 정의 + 샘플 데이터

### Phase 2: 팀원 관리 UI (3일)

- [ ] `profiles.json` 로더 (워크스페이스 `.claude/`)
- [ ] 사이드바 팀원 카드 (이름, 역할, 연차, 연봉 표시)
- [ ] 팀원 선택/해제 (회의 참여 토글)
- [ ] 비용 예측기 (선택 인원 × 모델 기준)
- [ ] API 키 입력 + SecretStorage 저장

### Phase 3: 회의 실행 (5일) ← 핵심

- [ ] Anthropic SDK 연동 + 기본 호출 테스트
- [ ] 프롬프트 빌더 (프로필 + 스킬 + 연차 프리셋 → 시스템 프롬프트)
- [ ] 모델 매퍼 (salary → model ID)
- [ ] 병렬 실행 + 카드별 스트리밍 (meeting-team)
- [ ] 에러 처리 (retry, timeout, rate limit, 부분 실패)
- [ ] 결과 패널 UI (카드 그리드, 진행률, 요약)
- [ ] meeting-agent, meeting-multi, meeting 방식 구현

### Phase 4: 마무리 (2일)

- [ ] 결과 저장 (JSON + Markdown)
- [ ] Markdown 클립보드 복사
- [ ] VS Code 테마 연동 (다크/라이트)
- [ ] 패키징 (.vsix)
- [ ] 기본 테스트 작성

### 총 예상: ~13일 (약 2.5주)

> Electron 대비 1~2주 단축 — Electron 셸/IPC/패키징 오버헤드 없음

---

## 9. 기존 결정사항 업데이트

[decisions/2026-03-11-six-questions.md](decisions/2026-03-11-six-questions.md) 기준:

| 결정 | 기존 | 변경 |
|------|------|------|
| Q1. 프로필 편집 UI | v1 제외 | **유지** — v1은 파일 직접 수정 |
| Q2. CLI 의존성 | 없음 (API 직접) | **유지** |
| Q3. 프레임워크 | Electron, 4-5주 | **VS Code Extension, ~2.5주** |
| Q4. 동시 스트리밍 | 카드별 독립 | **유지** — Webview에서 동일 구현 |
| Q5. 모드 전환 | 회의 시작 시 선택 | **유지** |
| Q6. 상태 다이어그램 | 필수 선행 | **위 섹션 6에 포함** |

---

## 10. 추가 결정 필요 사항

| 항목 | 선택지 | 권장 |
|------|--------|------|
| 사이드바 위치 | Activity Bar 아이콘 vs Explorer 하위 | **Activity Bar** (독립 아이콘) |
| 회의 결과 패널 | Editor 탭 vs 하단 Panel | **Editor 탭** (넓은 영역) |
| profiles.json 위치 | `.claude/profiles.json` vs `.vscode/` | **`.claude/profiles.json`** (기존 구조 유지) |
| 오케스트레이터 요약 | 자동 생성 vs 선택 | **선택** (추가 API 비용 발생) |

---

## 11. 2축 시스템 GUI 반영

### 사이드바 팀원 카드에 표시

```
┌────────────────────────────┐
│ 👤 지민 · PD               │
│ ■■■■■■■■■■ senior 10y     │  ← 연차 바
│ ₩₩₩ Opus                  │  ← 연봉 등급 + 모델
│ ☑ 참여                     │
└────────────────────────────┘
```

### v2에서 편집 가능

```
[연차 슬라이더]  1y ──────●── 20y+
자동 레벨: senior (8-12년)

[연봉 선택]  ○ ₩ Haiku   ● ₩₩ Sonnet   ○ ₩₩₩ Opus
예상 비용: ~2,200 토큰/회의 ($0.015)
```

---

## 12. 리스크 및 대응

| 리스크 | 등급 | 대응 |
|--------|------|------|
| Webview ↔ Extension 메시지 유실 | HIGH | 메시지 ID + ACK 패턴 |
| 8명 동시 스트리밍 시 Webview 렌더링 | HIGH | 디바운스 (100ms), 가상 스크롤 |
| API 키가 Webview에 노출 | CRITICAL | Extension Host에서만 API 호출, Webview에 키 전달 안함 |
| 대용량 응답 시 Webview 메모리 | MEDIUM | 응답 최대 길이 제한 (max_tokens) |
| VS Code 버전 호환성 | LOW | 최소 1.85+ (SecretStorage 안정화) |
