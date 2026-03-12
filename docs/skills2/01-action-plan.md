# Skills 2.0 적용 액션 플랜

> 작성일: 2026-03-12
> 대상: `.claude/skills/` 내 8개 스킬 파일

---

## Phase 1: YAML Front Meta 추가 (즉시 적용 가능)

모든 스킬 파일 상단에 YAML 프론트 메타를 추가한다.

### 작업 목록

| 파일 | 추가할 메타 요약 |
|------|-----------------|
| skill-pd.md | role: pd, classification: meeting-workflow |
| skill-planner-research.md | role: planner-research, classification: meeting-workflow |
| skill-planner-strategy.md | role: planner-strategy, classification: meeting-workflow |
| skill-backend.md | role: backend, classification: meeting-workflow, context: fork |
| skill-frontend.md | role: frontend, classification: meeting-workflow, context: fork |
| skill-qa.md | role: qa, classification: meeting-workflow |
| skill-ui.md | role: ui-designer, classification: meeting-workflow, context: fork |
| skill-ux.md | role: ux-designer, classification: meeting-workflow, context: fork |

> BE, FE, UI, UX는 파일이 크므로 (374~625줄) Context Fork 우선 적용

### 공통 YAML 필드

```yaml
---
name: "스킬 이름"
description: "한 줄 설명"
classification: meeting-workflow   # 회의 전용 스킬
role: "역할 코드"
member: "팀원 이름"
context: fork                      # 격리 실행 (큰 스킬만)
version: "1.0"
---
```

---

## Phase 2: Context Fork 전략 (컨텍스트 절약)

### 문제

현재 meeting-team 실행 시 8개 스킬 파일이 모두 메인 컨텍스트에 로드됨.
BE(524줄) + FE(525줄) + UI(625줄) + UX(374줄) = **2,048줄**이 메인 컨텍스트 점유.

### 해결

Context Fork 적용으로 각 에이전트의 스킬이 격리된 컨텍스트에서 실행.

```
적용 기준:
- 200줄 이상 스킬 → context: fork 필수
- 100줄 미만 스킬 → fork 불필요 (오버헤드가 더 큼)
```

| 스킬 | 라인수 | Context Fork |
|------|--------|-------------|
| skill-pd.md | ~96 | ❌ (작음) |
| skill-planner-research.md | ~62 | ❌ (작음) |
| skill-planner-strategy.md | ~79 | ❌ (작음) |
| skill-backend.md | ~524 | ✅ fork |
| skill-frontend.md | ~525 | ✅ fork |
| skill-qa.md | ~153 | ❌ (중간) |
| skill-ui.md | ~625 | ✅ fork |
| skill-ux.md | ~374 | ✅ fork |

**예상 효과**: 메인 컨텍스트에서 ~2,048줄 절약

---

## Phase 3: Classification 체계 (워크플로 분류)

### 분류 체계

```
classification 값:
├── meeting-workflow     # 회의 전용 (현재 8개 전부)
├── development          # 개발 가이드 (향후 확장 시)
├── analysis             # 분석/검증 (향후 확장 시)
└── setup                # 초기 설정 (향후 확장 시)
```

### 현재 적용

모든 8개 스킬은 `classification: meeting-workflow`로 통일.
회의 종류(meeting/meeting-multi/meeting-agent/meeting-team)에 따라
필요한 스킬만 선택적 로딩하는 기반 마련.

---

## Phase 4: 스킬별 훅 (선택적, 향후)

### 활용 시나리오

```
예시 1: BE 태준 스킬 호출 시
→ 훅에서 현재 src/main/ 폴더 구조를 자동 스캔
→ Additional Context로 실제 코드 구조 주입
→ 태준의 의견이 실제 코드 기반이 됨

예시 2: 회의 종료 시
→ 훅에서 회의 결과를 자동 저장
→ docs/meetings/results/ 에 기록
```

### 구현 방향

```yaml
# skill-backend.md 프론트 메타에 훅 정의 예시
hooks:
  skill_start:
    script: ".claude/hooks/inject-folder-structure.js"
    additional_context: true
```

> Phase 4는 Phase 1~3 적용 후 효과를 보고 결정

---

## 적용 우선순위 정리

```
즉시 (이번 세션):
  ✅ Phase 1 — YAML Front Meta 추가 (전체 8개 파일)

이번 주:
  ✅ Phase 2 — Context Fork (4개 큰 파일)
  ✅ Phase 3 — Classification 체계 적용

향후 (필요 시):
  ⏳ Phase 4 — 스킬별 훅
  ⏳ Evals — 스킬 품질 검증 (회의 스킬엔 과도)
  ⏳ Skill Creator — 추가 스킬 생성 시
```

---

## 적용하지 않는 것 (이유)

| 기능 | 미적용 이유 |
|------|------------|
| Evals | 회의용 페르소나 스킬은 자동 검증보다 회의 결과로 평가 |
| Skill Creator | 8개 팀원 이미 확정, 추가 생성 계획 없음 |
| 글로벌 훅 변경 | bkit 훅 시스템과 충돌 가능, 별도 관리 필요 |
