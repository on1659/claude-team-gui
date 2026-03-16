# PD 보고서: VS Code Extension v2 (사이클 #0)

╔══════════════════════════════════════════╗
║  개발 사이클: vscode-extension-v2         ║
║  현재 단계: PD 보고서                     ║
║  반복: 0/3                               ║
╚══════════════════════════════════════════╝

## Go/No-Go 판단

### ✅ GO — 조건부 승인

**근거:**
1. v1 아키텍처(LLMProvider 인터페이스, LLMRegistry, ConfigService)가 확장에 적합하게 설계되어 있어 작업량이 예측 가능
2. 4개 항목 중 Result Persistence는 현재 "빈 문자열 복사" 상태로 **사실상 버그** — 즉시 수정 필수
3. 단계적 릴리즈(2 Phase)로 리스크 분산 가능

**조건:**
- 4개 동시 착수 금지 — Phase 분리 필수
- 메시지 인터페이스 확정을 Phase 1 착수 전 선행

---

## 작업 분해 (WBS)

### Phase 1 — 핵심 기반 (병렬 가능, ~5일)

| # | 담당 | 작업 | 예상 공수 | 선행 작업 | 우선순위 |
|---|------|------|-----------|-----------|----------|
| 1-0 | BE+FE | 메시지 인터페이스 확정 (messages.ts 확장) | 0.5일 | — | P0 |
| 1-1 | BE | MeetingResultStore — host가 회의 결과 자체 보관 | 1일 | 1-0 | P0 |
| 1-2 | BE | handleCopyResult 실구현 (마크다운 포맷 → clipboard) | 0.5일 | 1-1 | P0 |
| 1-3 | BE | handleSaveResult 실구현 (파일 다이얼로그 → writeFile) | 0.5일 | 1-1 | P0 |
| 1-4 | FE | ActionBar ack/nack 핸들링 + 버튼 상태 머신 | 1일 | 1-0 | P0 |
| 1-5 | BE | OpenAI Provider 구현 (streamMessage + validateKey) | 1.5일 | — | P0 |
| 1-6 | BE | Gemini Provider 구현 (streamMessage + validateKey) | 1.5일 | — | P0 |
| 1-7 | BE | extension.ts 멀티 프로바이더 등록 + setApiKey 리팩터 | 0.5일 | 1-5, 1-6 | P0 |
| 1-8 | BE | package.json에 openai, @google/generative-ai 추가 + 번들 확인 | 0.3일 | — | P0 |

### Phase 2 — 사용자 경험 확장 (~5일)

| # | 담당 | 작업 | 예상 공수 | 선행 작업 | 우선순위 |
|---|------|------|-----------|-----------|----------|
| 2-1 | BE | ConfigService에 activeProvider persist (globalState) | 0.5일 | 1-7 | P1 |
| 2-2 | FE | ProviderSelect 컴포넌트 (Segmented Control, 3~4개) | 0.5일 | 2-1 | P1 |
| 2-3 | FE | MeetingConfig에 ProviderSelect 통합 + costUpdate 재계산 | 0.5일 | 2-2 | P1 |
| 2-4 | BE | MeetingHistoryService (파일 기반, workspace/.claude-team/history/) | 1.5일 | 1-1 | P1 |
| 2-5 | BE | History 저장 연동 (meetingDone 시 자동 저장) | 0.5일 | 2-4 | P1 |
| 2-6 | FE | 사이드바 탭 전환 구조 리팩토링 | 0.5일 | — | P1 |
| 2-7 | FE | HistoryView 컴포넌트 + 페이지네이션 (20건씩) | 1.5일 | 2-4, 2-6 | P1 |
| 2-8 | FE | AgentCard 프로바이더 뱃지 표시 | 0.3일 | 2-2 | P2 |
| 2-9 | QA | 통합 테스트 10개 시나리오 실행 | 2일 | 2-7 | P0 |

---

## 개발 범위 확정

### 이번 사이클 포함 (v2.0)
- Result Persistence — 복사(마크다운) + 저장(파일)
- OpenAI Provider — streamMessage, validateKey, 모델 3종
- Gemini Provider — streamMessage, validateKey, 모델 3종
- Provider Selection UI — Segmented Control (3개 프로바이더)
- Meeting History — 파일 저장(JSON), 목록 조회(20건 페이지네이션), 상세 로드
- 멀티 프로바이더 API 키 관리 — QuickPick 기반
- 비용 계산 프로바이더별 분기

### 제외 (v3 이후)
- 프로필 편집 GUI
- 팀원 추가/삭제 UI
- 멀티 프로바이더 비교 뷰 (side-by-side)
- History 전문 검색/필터
- 히스토리 클라우드 동기화
- 프로바이더 플러그인 시스템
- 사용자 지표 수집/대시보드
- History 데이터 암호화

---

## 리스크 매트릭스

| 리스크 | 확률 | 영향 | 대응 전략 |
|--------|------|------|-----------|
| **copyResult 빈 문자열 (현재 버그)** | 확정 | 상 | Phase 1에서 즉시 수정 |
| **프로바이더별 에러 코드 불일치** | 상 | 상 | 에러 매핑 테이블 P0으로 작성, 통합 에러 핸들링 레이어 |
| **SDK 번들 사이즈 증가** | 중 | 중 | esbuild 트리셰이킹 확인, 필요시 dynamic import |
| **globalState 50KB 제한** | 상 | 상 | History는 파일 저장, activeProvider만 globalState |
| **스트리밍 중 프로바이더 전환** | 중 | 상 | UI에서 회의 중 전환 블로킹 |
| **스코프 크립 (v3 기능 침투)** | 상 | 상 | 위 제외 목록을 게이트키퍼로 활용 |
| **API 키 postMessage 보안** | 중 | 중 | VS Code InputBox(네이티브) 우회 검토 |
| **History 파일 git 포함** | 중 | 하 | .gitignore 가이드 문서 제공 |

---

## 예상 사용 시나리오

### 개발 전 (As-Is)
1. 사용자가 회의를 실행하고 결과를 확인
2. 복사 버튼을 누르면 **빈 문자열**이 클립보드에 복사됨 → 실패
3. 저장 버튼을 누르면 파일 다이얼로그만 열리고 **내용이 없는 파일** 생성 → 실패
4. Anthropic API 키만 사용 가능 — OpenAI/Gemini 사용자는 이탈
5. 이전 회의 결과를 다시 보려면? → 불가능. 패널을 닫으면 결과 소멸
6. 같은 주제로 다른 모델을 비교하려면? → 불가능

### 개발 후 (To-Be)
1. 사용자가 회의를 실행하고 결과를 확인
2. [전체 복사] → 팀원별 마크다운 형태로 클립보드에 복사 → Notion/PR에 붙여넣기
3. [파일로 저장] → `.md` 파일로 디스크에 저장, 파일명 자동 제안
4. 사이드바에서 프로바이더 선택 (Claude/GPT/Gemini) → 비용 예측 자동 갱신
5. OpenAI 키만 있는 사용자도 GPT-4o로 회의 실행 가능
6. 사이드바 "회의 이력" 섹션에서 과거 회의 클릭 → 패널에 결과 복원
7. "지난번 회의에서 백엔드가 뭐라고 했더라?" → 30초 안에 찾기 가능

### 기대 효과
- 결과 활용률: 0% → **70%+** (복사/저장 기능 정상 동작)
- 프로바이더 커버리지: Anthropic 1개 → **3개** (사용자 이탈 방지)
- 재방문율: 측정 불가 → **History로 정량 추적 가능**
- 첫 회의까지 클릭 수: 동일 (기존 UX 유지, Progressive Disclosure)

---

## 총 예상 일정

| Phase | 기간 | 핵심 산출물 |
|-------|------|-------------|
| Phase 1 | ~5일 | Result Persistence + OpenAI/Gemini Provider |
| Phase 2 | ~5일 | Provider Selection UI + Meeting History |
| QA/통합 | ~2일 | 10개 시나리오 검증 + 회귀 테스트 |
| **총합** | **~12일** | v2.0 릴리즈 |
