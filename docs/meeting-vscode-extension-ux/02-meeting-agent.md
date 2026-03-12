# Meeting-Agent: 목업 → VS Code Extension 구현 방안

> 실제 멀티에이전트 병렬 실행 팀 회의 — 2026-03-13

## 회의 주제
목업(index.html + office.html)을 실제 VS Code Extension으로 구현할 때의 시스템 아키텍처, UI/UX 설계, 기술 스택

## 참여 팀원 (8명 병렬 실행)
| 이름 | 역할 | 연차 | 모델 | 토큰 (입력/출력) | 소요 |
|------|------|------|------|-----------------|------|
| 현우 | 기획 · 리서치 | 5y mid | Sonnet | ~41.7K total | 63.6s |
| 소연 | 기획 · 전략 | 8y senior | Sonnet | ~41.2K total | 48.5s |
| 태준 | 백엔드 개발 | 6y mid | Sonnet | ~38.3K total | 90.1s |
| 미래 | 프론트엔드 개발 | 3y junior | Sonnet | ~50.6K total | 72.2s |
| 윤서 | QA | 5y mid | Sonnet | ~24.5K total | 72.8s |
| 다은 | UI 디자인 | 4y mid | Sonnet | ~54.2K total | 86.1s |
| 승호 | UX 디자인 | 7y mid | Sonnet | ~50.9K total | 102.9s |
| 지민 | PD | 10y senior | Sonnet | ~27.9K total | 54.2s |

**총 토큰**: ~329K | **최대 소요 시간**: 102.9초 (승호 UX)

---

## 역할별 핵심 의견

### 현우 (기획 · 리서치)

- 7개 논의 주제 중 **주제 5~7(카드 인터랙션, 스트리밍 UI, 비용)이 사용자 경험에 직결**, 나머지는 구현팀 결정 OK
- 비용 실시간 업데이트는 **불안 유발 리스크** → 회의 완료 후 최종 비용만 표시 권장
- **v1은 meeting-team 1종만 완벽하게** > 4개 모드 어설프게. 나머지 3개는 disabled 처리로 v2 기대감 형성

**Must/Should/Won't 분류 요약**:
- Must: 카드 체크박스 즉시 반응, 패널 자동 오픈, 에이전트 상태 표시, 픽셀아트, 완료 후 비용, 에러 재시도
- Should: MD 복사, 파일 저장, 중단 버튼
- Won't: 비용 실시간 업데이트, 프로필 편집 UI, meeting-multi/agent 모드, 오케스트레이터 요약, office.html 씬

---

### 소연 (기획 · 전략)

- **First mover 창문 열림** — VS Code 마켓에 멀티에이전트 팀 회의 Extension 없음
- **온보딩 5단계 설계 필수**: 설치 → API 키 → 샘플 프로필 자동 생성 → 첫 회의 → 결과 확인
- **단 하나만 보는 KPI: 7일 재실행율 50%+** — 설치 수는 마케팅, 완료율은 기술. 재실행율만이 제품 가치 검증
- profiles.json 직접 작성 필요하면 온보딩에서 70% 이탈 → **기본 8명 프로필 번들 필수**
- v1에서 4개 모드 전부 노출하면 선택 피로 → meeting-team 1개만

---

### 태준 (백엔드 개발)

**핵심 기술 포인트**:
1. `retainContextWhenHidden: true` 필수 — 탭 전환 시 스트리밍 메시지 유실 방지
2. 메시지 프로토콜 전체 타입 정의 제시 (`WebviewToExtensionMessage`, `ExtensionToWebviewMessage`)
3. `chunkIndex` 순서 보장 + `fullContent` 최종값 덮어쓰기 안전장치
4. AnthropicService 코드: 스트리밍 + retry + `classifyError` (429/401/400/5xx/timeout)
5. 청크 배치 flush: Extension Host에서 에이전트별 50ms 디바운스 버퍼
6. stagger 시작: 200ms 간격 (Opus 팀원 많을 시 500ms)
7. 스킬 파일 연차 프리셋 섹션 추출 함수 `extractSkillPreset()`

**공수**: 6일 (Phase 3 5일 → 6일로 재산정 권장)

---

### 미래 (프론트엔드 개발)

**핵심 발견**:
- Zustand 스토어 사이드바/패널 공유 불가 (별도 Webview 프로세스) → Extension Host가 Single Source of Truth
- 8개 스트리밍 동시 setState 폭발 → `useRef` 누적 + 100ms throttle 패턴 첫날부터 설계
- pxSvg → PixelAvatar React 컴포넌트: `<rect>` 배열 직접 렌더 (dangerouslySetInnerHTML 불필요)
- VS Code CSS 변수 → Tailwind 매핑: globals.css + tailwind.config.ts
- 사이드바/패널 번들 분리 결정 필요 (multipleEntry vs mount target 분기)

**공수**: 8일 (Phase 1~2 포함)

---

### 윤서 (QA)

**리스크 등급**:
- CRITICAL: API 키 DevTools 노출, Extension Host 크래시 시 상태 고착
- HIGH: 메시지 순서 역전, 8명 동시 렌더링 프리징, AgentCard 상태 다이어그램 불일치, Rate Limit thundering herd
- MEDIUM: profiles.json 파싱 실패, 메모리 누수, Windows 경로 구분자, 비용 예측 오차
- LOW: VS Code 버전 호환성, 픽셀아트 라이트 테마 충돌

**테스트 시나리오 10개** (T-01~T-10): Happy Path, 부분 실패 retry, 전체 실패, thundering herd, 스트리밍 중 취소, API 키 노출 검증, 메시지 역전, Host 재시작, profiles.json 비정상, 10회 연속 메모리

**핵심 지적**: 계획 문서와 스킬 파일의 AgentCard 상태 다이어그램 불일치 (streaming 상태 유무) → 통일 필요

---

### 다은 (UI 디자인)

**매핑 표 제공**: 목업 CSS 변수 19개 → VS Code 테마 변수 완전 매핑
- 라이트 테마 대비 위험: 연차 색상 `#dcdcaa`(노랑)는 흰 배경에서 WCAG 실패 (1.5:1)
- 디자인 토큰 3계층: Primitive(HEX) → Semantic(의미) → Component(사용처) 정의
- 픽셀아트 아바타: **크기를 16의 배수(32/48/64)로 정규화** — 비정수 px/pixel 비율이 HiDPI에서 흐릿함
- AgentCard 6가지 상태(idle/selected/running/streaming/done/error) 시각 설계 완성
- 비용 표시 3단계 색상 경고: `$0.50` 이하(ok) → 이상(warn) → `$1.00` 이상(err)

---

### 승호 (UX 디자인)

**사용자 플로우 3개** 상세 정의:
1. 최초 사용: API 키 온보딩 → 코치마크 → localStorage 플래그
2. 일반 회의: 이전 선택 복원 → 최소 1단계(주제)만으로 시작 가능 → Ctrl+Enter 단축키
3. 컨텍스트 회의: 코드 선택 → 우클릭 → 주제 자동 채움

**핵심 제안**:
- 스트리밍 시작 전 1~3초 공백 → **낙관적 UI 3단계** (준비 중 → 연결됨 → 스트리밍)
- 회의 방식 라벨 번역: 단독→빠른 확인, 역할극→토론 기록, 팀→심층 팀 회의, 에이전트→편향 없는 분석
- 접근성 v1 필수 3개: 진행률 ARIA, 카드 aria-live="polite", 키보드 Tab 순서 + Ctrl+Enter
- 에러 UX 구체 예시: 카드 내 재시도/건너뛰기 버튼 + Rate Limit 전체 배너

---

### 지민 (PD)

**[GO] 조건 없음. 12일 내 v1 출시 가능.**

**확정 사항**:
- Sidebar Provider + Webview Panel 이중 구조
- React + Vite + Zustand + Tailwind (shadcn v2로)
- meeting-team 1종 먼저 → 나머지 3종 v2
- 크리티컬 패스: Phase 3 "병렬 스트리밍 → Webview 렌더링"

**일정**: Phase 1(3일) + Phase 2(3일) + Phase 3(5일) + Phase 4(1일) = 12일

**판단 보류 1건**: 픽셀아트 캐릭터 v1 포함 여부 — 공수 0.5일 이하 판단 후 확정

---

## 공통 합의점

1. **Sidebar + Panel 분리 구조** — 전원 동의. 목업 레이아웃이 VS Code 패턴과 정확히 매핑
2. **meeting-team 1종 먼저 완성** — 현우/소연/지민 합의. 4가지 모드 동시 구현은 일정 위험
3. **Extension Host가 모든 API 호출 독점** — 태준/윤서/지민 확인. Webview는 렌더링 전용
4. **VS Code CSS 변수 매핑** — 다은이 19개 변수 매핑 표 제시. 하드코딩 HEX 제거 필수
5. **API 키 보안** — 윤서 CRITICAL 등급. Extension Host → SecretStorage만. Webview 전달 금지
6. **샘플 프로필 번들 제공** — 소연 강력 주장. 온보딩 이탈 방지
7. **스트리밍 청크 배치 처리** — 태준(50ms Host 배치) + 미래(100ms Webview throttle) 이중 디바운스

## 주요 쟁점

| 쟁점 | 의견들 | 결론 |
|------|--------|------|
| v1 회의 모드 수 | 현우: 1종, 소연: 2종(비용 선택권), 지민: 1종 먼저 | **1종(meeting-team)** 먼저, 안정화 후 추가 |
| 비용 실시간 업데이트 | 현우: Won't, 승호: 의사결정 지원 부족 | **회의 전 예상만, 실행 중 미표시, 완료 후 최종** |
| 메시지 ACK | 태준: 불필요, 윤서: seq 필수, 지민: seq+fullContent 절충 | **chunkIndex + agentDone에 fullContent** |
| shadcn/ui | 미래: 목업 재사용, 다은: VS Code 변수 충돌, 지민: v2 | **v1 제외. Tailwind + CSS 변수만** |
| Phase 3 공수 | 기존 5일, 태준 6일 제안 | **6일로 재산정 필요** (지민 최종 판단 대기) |
| 픽셀아트 v1 포함 | 현우: Must, 다은: 32px 정규화, 지민: 0.5일 판단 후 | **포함 예정** (미래의 PixelAvatar 공수 0.5일) |
| 온보딩 플로우 | 소연: 5단계 필수, 승호: 코치마크+낙관적 UI | **v1에 기본 포함** |

## 권장 다음 액션

1. **즉시**: `messages.ts` 타입 정의 확정 (태준의 제안 + 윤서의 chunkIndex 반영)
2. **Phase 1 시작**: Extension 프로젝트 초기화 + Webview 통신 POC
3. **병행**: 다은의 `vscode-theme.css` 매핑 파일 작성 + 승호의 온보딩 플로우 스펙
