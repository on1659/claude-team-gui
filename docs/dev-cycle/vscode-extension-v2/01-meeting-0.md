# 🏁 [VS Code Extension v2] — 팀 회의 결과 (사이클 #0)

╔══════════════════════════════════════════╗
║  개발 사이클: vscode-extension-v2         ║
║  현재 단계: 🔵 MEETING 완료               ║
║  반복: 0/3                               ║
╚══════════════════════════════════════════╝

## 회의 주제
VS Code Extension v2 — 미완성 항목 4가지 완성:
1. Result Persistence (복사/저장 호스트 연동)
2. Provider Selection UI (프로바이더 선택)
3. Meeting History (회의 결과 저장/조회)
4. OpenAI/Gemini Provider (실제 구현)

---

## 팀원별 의견

### 지민 (PD)
**조건부 Go.** v1 아키텍처가 잘 잡혀있어 확장 수월하지만, 4건 동시 착수는 위험. 의존성 그래프 기반 순서 제안: Result Persistence → OpenAI/Gemini → Provider Selection UI → Meeting History. Phase 1(A+B 병렬 4일) → Phase 2(C 3일) → Phase 3(D 3일). Quality Gate 3단계 정의. **copyResult가 빈 문자열 복사하는 현재 상태는 버그 수준.**

### 현우 (기획자①·사용자 리서치)
**Result Persistence가 최우선.** 회의 결과를 가져갈 수 없으면 "이거 왜 쓰지?"가 됨. 사용자 검증 체크리스트 적용 결과: Result Persistence(100% 사용자 영향) > Provider UI > Multi-Provider > History. Markdown 복사→Notion/PR 붙여넣기가 가장 흔한 패턴. **현재 Panel Webview 상태에만 결과 존재 — dispose되면 날아감.**

### 소연 (기획자②·비즈니스 전략)
**v2는 "쓸만한 제품"으로 넘어가는 분기점.** P0: Result Persistence + Meeting History (리텐션 직결), P1: Provider Selection + OpenAI/Gemini (TAM 확장). 배포 전략: v2.0(P0, 2주) → v2.1(P1, +2주) → v2.2(Gemini, +1주). **"결과물이 휘발되는 도구는 두 번 안 쓴다"** — KPI "주간 3회+" 측정에도 History 필수.

### 태준 (백엔드)
**아키텍처 확장 수월하나 5가지 기술 리스크 주의.** (1) API 키가 postMessage 채널 타는 보안 이슈 → InputBox 우회 권장, (2) globalState 50KB 제한 → 10건 쌓이면 터짐 → 파일 저장 필수, (3) 동시 회의 상태 관리 정리 필요, (4) SDK 번들 사이즈 → dynamic import 검토, (5) 스트리밍 인터페이스 호환성 검증 필요. **결과 저장 방식: (a) webview가 content 포함 전송 vs (b) host가 자체 저장 — FE 의견 필요.**

### 미래 (프론트엔드)
**4개 항목 공통 문제: "메시지 인터페이스 정의가 선행되어야 UI 작업 의미 있음."** ActionBar fire-and-forget 패턴 → ack/nack 필수. 사이드바에 History 추가 시 탭/라우팅 개념 필요 → 현재 81줄 단일 레이아웃으론 부족. 총 4.6일 예상. **HistoryView는 페이지네이션 필수 — 한 번에 20건씩.**

### 윤서 (QA)
**기능 간 교차 영향이 진짜 위험 구간.** CRITICAL: 프로바이더별 에러 코드 불일치, 스트리밍 중 전환 시 좀비 커넥션, 부분 실패 시 History 정합성. 10개 통합 테스트 시나리오 설계. **강력 권고: Result Persistence 먼저 분리 릴리즈 → 나머지 3개 묶어서 두 번째 릴리즈.** 프로바이더별 에러 매핑 테이블 P0.

### 다은 (UI 디자이너)
**기능 늘어나는 만큼 UI 복잡도 올라가면 안 된다.** Provider 선택은 드롭다운 대신 **Segmented Control(pill-style)** 추천 (3~4개면 한 단계 줄임). Copy 피드백은 아이콘→체크마크 inline (토스트 불필요). Save는 VS Code 네이티브 notification. History는 **사이드바 collapsible section**으로 분리. VS Code CSS 변수(`--vscode-*`) 활용한 3계층 토큰 정의.

### 승호 (UX 디자이너)
**v2로 인지 부하 2배 증가 우려 — Progressive Disclosure 철저히 적용.** 프로바이더 선택 시 "선택 마비" 방지 위해 기본값 필수 + 한 줄 비교 설명. 결과 복사 시 "누구 것인지" 명시. History 진입점 발견 가능성(discoverability) 확보 필요. **멀티 프로바이더 비교 뷰(side-by-side)는 v2 스코프인지 확인 필요.**

---

## 주요 합의점

1. **Result Persistence가 최우선** — 8명 전원 동의. 현재 빈 문자열 복사하는 건 버그 수준
2. **Host가 결과를 자체 보관해야 함** — MeetingResultStore/MeetingHistoryService 도입 (webview state 의존 탈피)
3. **단계적 릴리즈** — 한꺼번에 4개 넣지 말고 2~3단계로 분리
4. **회의 중 프로바이더 전환 금지** — UI에서 블로킹
5. **History 저장은 파일 기반** — globalState 용량 제한(50KB)으로 부적합

---

## 주요 충돌 지점

### 1. 우선순위 순서
| 팀원 | 제안 순서 |
|------|-----------|
| 지민(PD) | Result → OpenAI/Gemini → Provider UI → History |
| 현우(기획①) | Result → Provider UI → OpenAI/Gemini → History |
| 소연(기획②) | Result + History(P0) → Provider UI + OpenAI/Gemini(P1) |
| 윤서(QA) | Result 분리 릴리즈 → 나머지 3개 묶어서 릴리즈 |

→ **공통점**: Result Persistence 최우선. **차이**: History를 P0에 넣을지 P1에 넣을지

### 2. History 저장 위치
| 의견 | 지지자 |
|------|--------|
| 워크스페이스 로컬 (`.claude-team/` or `.claude/meetings/`) | 현우, 소연 |
| globalStorageUri (워크스페이스 없을 때 폴백) | 태준 |
| 프로젝트별 vs 전역 통합 → **미결정** | 소연(질문 제기) |

### 3. Provider Selection UI 형태
| 의견 | 지지자 |
|------|--------|
| Segmented Control (pill) | 다은 |
| 드롭다운 | 현우 |
| → **판단 기준**: 프로바이더 상한 3~4개면 Segmented, 5+면 드롭다운 | 다은(조건부) |

### 4. 결과 데이터 흐름
| 방식 | 장점 | 지지자 |
|------|------|--------|
| (a) webview가 copyResult 시 content 포함 전송 | 간단 | — |
| (b) host의 MeetingService가 결과 자체 저장 | History 연동 자연스러움 | 태준, 현우 |
→ **(b)가 우세**: History 기능과 시너지

---

## 서로에게 던진 질문들

| 질문자 | 대상 | 질문 |
|--------|------|------|
| 지민(PD) | 윤서(QA) | History 저장 시 민감정보 보존 정책? (암호화/자동만료/사용자 책임) |
| 현우(기획①) | 태준(BE) | History 저장소: 워크스페이스 파일 vs globalState? |
| 소연(기획②) | 태준(BE) | 워크스페이스 로컬 vs globalState — "다른 PC에서 보이느냐" 차이 |
| 태준(BE) | 미래(FE) | copyResult 시 (a) content 포함 전송 vs (b) host 자체 저장? |
| 미래(FE) | 태준(BE) | History 데이터 저장 위치/포맷 → 로딩 전략 결정에 필수 |
| 윤서(QA) | 태준(BE) | 스트리밍 중 프로바이더 전환 시 AbortController 정책? |
| 다은(UI) | 미래(FE) | 프로바이더 상한선 합의 → Segmented vs 드롭다운 결정 |
| 승호(UX) | 미래(FE) | 멀티 프로바이더 비교 뷰(side-by-side)는 v2 스코프인가? |

---

## 역할별 작업 항목 정리

| 담당자 | 역할 | 작업 항목 | 선행 작업 |
|--------|------|-----------|-----------|
| 지민 | PD | v2 마일스톤 정의, Quality Gate 검수, 스코프 차단 | — |
| 현우 | 기획① | 사용자 스토리 8~12개, Acceptance Criteria, Markdown 포맷 검증 | — |
| 소연 | 기획② | 비즈니스 케이스, KPI 대시보드 설계, 경쟁사 벤치마크 | — |
| 태준 | BE | OpenAI/Gemini Provider, MeetingHistoryService, Result Persistence 호스트 구현 | 메시지 스펙 확정 |
| 미래 | FE | ActionBar ack/nack, ProviderSelect, HistoryView, 사이드바 탭 구조 | 메시지 인터페이스 확정 |
| 윤서 | QA | 에러 매핑 테이블, 10개 통합 시나리오, API 모킹 레이어 | 상태 전이 다이어그램 |
| 다은 | UI | 디자인 토큰 3계층, Segmented Control 스펙, History 리스트 스펙 | History 스키마 확정 |
| 승호 | UX | 전체 플로우 맵, Provider 인터랙션 명세, 에러 매트릭스 | 데이터 구조 확정 |

---

## 기술 의존성

```
메시지 인터페이스 정의 (BE↔FE 공동)
    ├─→ Result Persistence 호스트 구현 (BE)
    │       └─→ ActionBar ack/nack (FE)
    ├─→ OpenAI/Gemini Provider 구현 (BE)
    │       └─→ Provider Selection UI (FE)
    │               └─→ 에러 매핑 테이블 (QA)
    └─→ MeetingHistoryService (BE)
            ├─→ HistoryView 컴포넌트 (FE)
            └─→ History 통합 테스트 (QA)
```

---

## 권장 다음 액션

1. **메시지 인터페이스 확정** (BE+FE 공동) — copyResult/saveResult ack, getProviders, getHistory 등 메시지 타입 정의
2. **History 저장 위치 결정** — 워크스페이스 파일 기반 + globalStorageUri 폴백으로 합의 필요
3. **Phase 1 착수** — Result Persistence + OpenAI/Gemini Provider 병렬 개발
