# YAML Front Meta 템플릿 & 적용 예시

> 작성일: 2026-03-12
> Skills 2.0 적용을 위한 YAML 프론트 메타 표준

---

## 공통 템플릿

```yaml
---
name: "{스킬 이름}"
description: "{역할 한 줄 설명 — 이 설명으로 AI가 스킬 선택을 판단}"
classification: meeting-workflow
role: "{역할 코드}"
member: "{팀원 이름}"
context: fork          # 200줄 이상 스킬만 적용, 작은 스킬은 이 줄 제거
version: "1.0"
---
```

### 필드 설명

| 필드 | 필수 | 설명 |
|------|------|------|
| name | ✅ | 스킬의 고유 이름 (영문 kebab-case) |
| description | ✅ | AI가 스킬 선택 시 참고하는 한 줄 설명 |
| classification | ✅ | 워크플로 분류 (`meeting-workflow`, `development`, `analysis`) |
| role | ✅ | 역할 코드 (`pd`, `backend`, `frontend`, `qa`, `ui-designer` 등) |
| member | ✅ | 팀원 이름 (한글) |
| context | ❌ | `fork` 지정 시 격리된 컨텍스트에서 실행 |
| version | ❌ | 스킬 버전 (수정 이력 관리) |

---

## 각 스킬별 적용 예시

### skill-pd.md (작은 스킬, fork 불필요)

```yaml
---
name: "meeting-pd"
description: "프로젝트 디렉터 지민 — 일정·스코프·리스크 관리, 회의 진행 및 의사결정"
classification: meeting-workflow
role: pd
member: "지민"
version: "1.0"
---

# PD (지민) — 이 프로젝트 컨텍스트
... (기존 내용 그대로)
```

### skill-planner-research.md (작은 스킬)

```yaml
---
name: "meeting-planner-research"
description: "리서처 현우 — 사용자 검증, 기능 우선순위, 데이터 기반 의사결정"
classification: meeting-workflow
role: planner-research
member: "현우"
version: "1.0"
---
```

### skill-planner-strategy.md (작은 스킬)

```yaml
---
name: "meeting-planner-strategy"
description: "전략기획 소연 — 비즈니스 KPI, 포지셔닝, 로드맵, 수익 모델"
classification: meeting-workflow
role: planner-strategy
member: "소연"
version: "1.0"
---
```

### skill-backend.md (큰 스킬, fork 적용)

```yaml
---
name: "meeting-backend"
description: "백엔드 개발자 태준 — Electron 메인 프로세스, API 설계, 보안, 성능"
classification: meeting-workflow
role: backend
member: "태준"
context: fork
version: "1.0"
---
```

### skill-frontend.md (큰 스킬, fork 적용)

```yaml
---
name: "meeting-frontend"
description: "프론트엔드 개발자 미래 — React 컴포넌트, 상태 관리, 렌더링 최적화"
classification: meeting-workflow
role: frontend
member: "미래"
context: fork
version: "1.0"
---
```

### skill-qa.md (중간 스킬)

```yaml
---
name: "meeting-qa"
description: "QA 엔지니어 윤서 — 테스트 시나리오, 엣지 케이스, DoD 검증"
classification: meeting-workflow
role: qa
member: "윤서"
version: "1.0"
---
```

### skill-ui.md (큰 스킬, fork 적용)

```yaml
---
name: "meeting-ui-designer"
description: "UI 디자이너 다은 — 디자인 토큰 3계층, 비주얼 계층, 컴포넌트 스타일링"
classification: meeting-workflow
role: ui-designer
member: "다은"
context: fork
version: "1.0"
---
```

### skill-ux.md (큰 스킬, fork 적용)

```yaml
---
name: "meeting-ux-designer"
description: "UX 디자이너 승호 — 사용자 플로우, 접근성, 인지 부하, 온보딩"
classification: meeting-workflow
role: ux-designer
member: "승호"
context: fork
version: "1.0"
---
```

---

## 향후 확장: 훅 포함 템플릿

회의 스킬에 훅을 추가할 경우의 확장 예시:

```yaml
---
name: "meeting-backend"
description: "백엔드 개발자 태준 — Electron 메인 프로세스, API 설계, 보안, 성능"
classification: meeting-workflow
role: backend
member: "태준"
context: fork
version: "1.1"
hooks:
  skill_start:
    script: ".claude/hooks/inject-src-structure.js"
  skill_stop:
    script: ".claude/hooks/save-meeting-notes.js"
---
```

---

## 적용 순서

```
1. 각 스킬 파일을 열고 맨 위에 --- 블록 추가
2. 기존 마크다운 내용은 --- 아래에 그대로 유지
3. 변경 후 세션 재시작 불필요 (Skills 2.0 핫 리로드)
4. meeting-team 실행으로 동작 확인
```
