# /dev-cycle - 팀 개발 사이클 자동화

## 개요
팀 회의 → PD 보고 → 사장 승인 → 개발 → QA → 버그 수정 → 개선 루프까지
**실제 회사 개발 프로세스**를 자동화하는 스킬.

3개의 승인 게이트에서 사장(유저)이 의사결정하고, 나머지는 팀이 자율 실행.
최대 3회 반복 후 사이클 자동 종료.

```
INIT → MEETING → PD_REPORT → [GATE_1] → DEVELOPMENT → QA → [GATE_2] → BUG_FIX → [GATE_3] → CLOSED
                                 ↑                                                      ↓
                                 └──────────── improvement loop (max 3) ────────────────┘
```

---

## Step 0: 초기화 및 상태 복구

1. Glob 도구로 `.bkit/state/dev-cycle-status.json` 존재 여부 확인
2. **파일이 존재하면**: Read로 읽고 `currentPhase` 확인
   - `currentPhase`가 `"CLOSED"`가 아니면 AskUserQuestion:
     ```
     질문: "이전 사이클이 [{feature}] — {currentPhase} 단계에서 중단되었습니다."
     선택지:
     1. 이어서 진행 — 중단된 단계부터 재개
     2. 새 사이클 시작 — 기존 기록 덮어쓰기
     3. 취소
     ```
   - 이어서 진행 선택 시: `currentPhase`에 해당하는 Step으로 이동
3. **새 사이클 시작 시**:
   - `$ARGUMENTS`가 있으면 기능 설명으로 사용
   - 없으면 AskUserQuestion으로 기능 설명 입력 요청
   - `feature-slug` 생성 (kebab-case, 최대 30자)
   - `docs/dev-cycle/{feature-slug}/` 디렉토리 생성 (Bash: `mkdir -p`)
   - `.bkit/state/dev-cycle-status.json` 초기화 (부록 B 참조)

---

## Step 1: 팀 회의 (MEETING)

> 상태 업데이트: `currentPhase: "MEETING"`, `phases.MEETING.status: "running"`

### 1-1. 파일 로드

다음 파일들을 Read 도구로 **동시에** 읽어오세요:
- `~/.claude/meeting-team-profiles.md` (팀원 프로필)
- `.claude/skills/skill-pd.md`
- `.claude/skills/skill-planner-research.md`
- `.claude/skills/skill-planner-strategy.md`
- `.claude/skills/skill-backend.md`
- `.claude/skills/skill-frontend.md`
- `.claude/skills/skill-qa.md`
- `.claude/skills/skill-ui.md`
- `.claude/skills/skill-ux.md`

### 1-2. 반복 사이클 시 추가 컨텍스트

`iterationCount > 0`이면 이전 사이클의 QA 리포트와 잔여 MINOR 버그 목록도 Read.
이 내용을 "이전 사이클 개선 안건"으로 회의 프롬프트에 포함.

### 1-3. 팀원 에이전트 병렬 실행

8명의 팀원을 **Agent 도구로 동시에(한 번에)** 실행.
각 팀원의 스킬 파일 매핑:
- 지민 (PD) → `skill-pd.md`
- 현우 (기획자①) → `skill-planner-research.md`
- 소연 (기획자②) → `skill-planner-strategy.md`
- 태준 (개발자① BE) → `skill-backend.md`
- 미래 (개발자② FE) → `skill-frontend.md`
- 윤서 (QA) → `skill-qa.md`
- 다은 (UI) → `skill-ui.md`
- 승호 (UX) → `skill-ux.md`

각 에이전트 프롬프트:
```
당신은 [이름]입니다. 다음은 당신의 프로필입니다:
[해당 팀원의 프로필 전체 내용]

## 당신의 전문 스킬셋
[해당 역할의 스킬 파일 전체 내용]

## 개발 기능
[기능 설명]

{iterationCount > 0일 때만:}
## 이전 사이클 개선 안건
[이전 QA에서 MINOR로 분류된 항목들]

위 프로필의 성격과 말투 그대로, 전문 스킬셋의 프레임워크를 활용해서 다음을 작성하세요:
1. 이 기능에 대한 핵심 의견 (스킬셋의 판단 기준 적용)
2. 우려사항 또는 리스크 (구체적 수치나 체크리스트 활용)
3. 구체적 구현 방향 제안
4. 당신 역할에서 담당할 작업 항목 목록 (구체적으로)
5. 다른 역할에 필요한 선행 작업이 있다면 명시
6. 다른 팀원에게 묻고 싶은 것 (1가지)

반드시 프로필에 정의된 말투와 성격으로 답변하세요.
다른 팀원의 의견은 모르는 상태입니다.
```

### 1-4. 결과 종합

모든 팀원 결과를 받은 후 다음 포맷으로 정리:

```
## 🏁 [{기능명}] — 팀 회의 결과 (사이클 #{iteration})

### 팀원별 의견
**[이름] (역할)** — [의견 요약]

### 주요 합의점
[여러 팀원이 동의한 방향]

### 주요 충돌 지점
[팀원 간 의견 차이 — 이름 명시]

### 역할별 작업 항목 정리
| 담당자 | 역할 | 작업 항목 | 선행 작업 |
|--------|------|---------|---------|

### 서로에게 던진 질문들
[각 팀원이 묻고 싶었던 것들]

### 기술 의존성
[어떤 작업이 다른 작업을 블로킹하는지]
```

저장: `docs/dev-cycle/{feature-slug}/01-meeting-{iteration}.md`
상태 업데이트: `phases.MEETING.status: "done"` + `outputFile` + `timestamp`

---

## Step 2: PD 보고서 (PD_REPORT)

> 상태 업데이트: `currentPhase: "PD_REPORT"`, `phases.PD_REPORT.status: "running"`

회의 결과 파일을 Read한 후, PD(지민) 관점에서 다음 보고서를 작성:

```markdown
# PD 보고서: {feature-name} (사이클 #{iteration})

╔══════════════════════════════════════════╗
║  개발 사이클: {feature-name}              ║
║  현재 단계: PD 보고서                     ║
║  반복: {iteration}/{max}                  ║
╚══════════════════════════════════════════╝

## Go/No-Go 판단
[명확한 GO 또는 NO-GO + 근거 3줄 이내]

## 작업 분해 (WBS)
| # | 담당자 | 작업 | 예상 공수 | 선행 작업 | 우선순위 |
|---|--------|-----|---------|---------|---------|

## 개발 범위 확정
### 이번 사이클 포함
- [항목 목록]

### 제외 (다음 사이클 또는 미정)
- [항목 목록]

## 리스크 매트릭스
| 리스크 | 확률 | 영향 | 대응 전략 |
|--------|------|------|---------|

## 예상 사용 시나리오
### 개발 전 (As-Is)
[현재 사용자가 어떤 과정을 거치는가]

### 개발 후 (To-Be)
[이 기능이 완성되면 경험이 어떻게 바뀌는가]
```

저장: `docs/dev-cycle/{feature-slug}/02-pd-report-{iteration}.md`
상태 업데이트: `phases.PD_REPORT.status: "done"`

---

## Step 3: 승인 게이트 1 — 개발 착수 승인 (GATE_1)

> 상태 업데이트: `currentPhase: "GATE_1"`

PD 보고서의 핵심 내용(Go/No-Go, WBS 요약, 리스크 Top 3)을 표시한 후,
AskUserQuestion으로 사장에게 판단을 요청:

```
╔══════════════════════════════════════════╗
║  🚦 개발 착수 승인 (Gate 1)               ║
║  사이클: #{iteration}/3                   ║
╚══════════════════════════════════════════╝
```

선택지:
1. **개발 착수** — PD 보고서 기준으로 개발 진행
2. **추가 회의** — 특정 주제에 대해 재논의 필요 (iterationCount < 3일 때만)
3. **사이클 종료** — 이 기능 개발 중단

처리:
- 선택 1 → `GATE_1.decision: "APPROVED"`, Step 4로
- 선택 2 → `iterationCount` 확인. 3회 도달 시 "최대 반복 횟수 도달" 경고 후 1 또는 3만 선택 가능. 아니면 추가 회의 주제를 물어보고 `iterationCount++`, Step 1로
- 선택 3 → `currentPhase: "CLOSED"`, 종료 메시지 출력

---

## Step 4: 개발 실행 (DEVELOPMENT)

> 상태 업데이트: `currentPhase: "DEVELOPMENT"`, `phases.DEVELOPMENT.status: "running"`

### 4-1. 개발 준비

PD 보고서의 WBS와 개발 범위를 Read.
관련 스킬 파일(skill-backend.md, skill-frontend.md 등)을 Read.

### 4-2. 개발 에이전트 실행

WBS에서 도출된 작업 항목별로 Agent 도구를 **병렬 실행**.
각 에이전트는 실제로 코드를 작성/수정해야 합니다:

```
당신은 {역할} 개발자입니다.

## 개발 대상
{WBS에서 해당 역할의 작업 항목}

## 참고 문서
{PD 보고서 + 회의 결과에서 해당 역할 관련 내용}

## 스킬셋
{해당 skill-*.md 전체 내용}

다음을 수행하세요:
1. Glob/Grep/Read 도구로 기존 코드베이스를 탐색하여 관련 파일 파악
2. Write/Edit 도구로 필요한 코드 변경을 실행
3. 변경 사항 목록을 상세히 보고 (파일명, 변경 내용, 이유)

반드시 코드를 직접 작성/수정하세요. 제안만 하지 마세요.
```

### 4-3. 개발 결과 정리

```markdown
# 개발 결과 보고서: {feature-name} (사이클 #{iteration})

╔══════════════════════════════════════════╗
║  개발 사이클: {feature-name}              ║
║  현재 단계: 개발 완료                     ║
║  반복: {iteration}/{max}                  ║
╚══════════════════════════════════════════╝

## 변경 파일 목록
| 파일 | 변경 유형 | 담당 | 설명 |
|------|---------|------|------|

## 구현 상세
### {역할별 구현 내용}

## 미해결 사항
[완료하지 못한 항목]

## QA 요청 사항
[테스트 시 특별히 주의할 영역]
```

저장: `docs/dev-cycle/{feature-slug}/03-development-{iteration}.md`
상태 업데이트: `phases.DEVELOPMENT.status: "done"`

---

## Step 5: QA 검증 (QA)

> 상태 업데이트: `currentPhase: "QA"`, `phases.QA.status: "running"`

개발 결과 보고서와 `skill-qa.md`를 Read한 후, 3단계 QA 실행:

### Tier 1: 기본 기능 테스트 (Happy Path)
Agent 실행 — QA 페르소나 + skill-qa.md:
- 기능 요구사항 기반 정상 동작 확인
- Bash로 빌드/테스트 실행
- 각 기능별 pass/fail 판정

### Tier 2: 엣지케이스 / 버그 탐지
Agent 실행 — QA 페르소나 + skill-qa.md:
- 경계값, 예외 입력, 실패 시나리오 탐색
- Grep/Read로 에러 핸들링 코드 경로 점검
- 발견된 버그 기록

### Tier 3: 회귀 테스트 (iterationCount > 0일 때만)
Agent 실행 — QA 페르소나 + 이전 버그 목록:
- 이전 사이클에서 수정된 버그의 재발 여부 검증
- 이전 통과 항목 재검증

### QA 보고서 작성

```markdown
# QA 보고서: {feature-name} (사이클 #{iteration})

╔══════════════════════════════════════════╗
║  개발 사이클: {feature-name}              ║
║  현재 단계: QA 완료                       ║
║  반복: {iteration}/{max}                  ║
╚══════════════════════════════════════════╝

## 테스트 요약
| 티어 | 테스트 수 | 통과 | 실패 | 통과율 |
|------|---------|------|------|-------|

## 버그 리포트

### 🔴 CRITICAL (즉시 수정, 사이클 블로킹)
| ID | 설명 | 재현 경로 | 영향 범위 |
- 즉시 수정 필수. 이 버그가 있으면 배포 불가.

### 🟠 MAJOR (수정 필수, 재QA 필요)
| ID | 설명 | 재현 경로 | 영향 범위 |
- 수정 후 재검증 필요.

### 🟡 MINOR (개선 사항, 다음 회의 안건)
| ID | 설명 | 개선 제안 |
- 기능에 지장 없으나 개선하면 좋은 항목. 다음 사이클 회의 안건으로 등록.

### ⚪ COSMETIC (기록만, 통과)
| ID | 설명 |
- 사소한 스타일/포맷 이슈. 기록만 하고 통과.

## QA 판정
- **PASS**: CRITICAL 0건, MAJOR 0건 → Gate 2 자동 통과, Gate 3으로 직행
- **CONDITIONAL_PASS**: CRITICAL 0건, MAJOR N건 → 수정 후 재QA
- **FAIL**: CRITICAL N건 → 즉시 수정 필수
```

저장: `docs/dev-cycle/{feature-slug}/04-qa-report-{iteration}.md`
상태 업데이트: `phases.QA.status: "done"` + `bugReport` 요약

---

## Step 6: 승인 게이트 2 — 버그 수정 우선순위 (GATE_2)

> 상태 업데이트: `currentPhase: "GATE_2"`

### QA PASS인 경우 (CRITICAL 0, MAJOR 0)
Gate 2 자동 통과. "QA 통과 — 버그 수정 불필요" 메시지 출력 후 Step 8 (Gate 3)로 직행.

### CONDITIONAL_PASS 또는 FAIL인 경우
QA 요약(버그 수 by 심각도)을 표시 후 AskUserQuestion:

```
╔══════════════════════════════════════════════╗
║  🐛 버그 수정 우선순위 확인 (Gate 2)           ║
║                                              ║
║  CRITICAL: N건 / MAJOR: M건 / MINOR: K건     ║
╚══════════════════════════════════════════════╝
```

선택지:
1. **전체 수정** — CRITICAL + MAJOR 모두 수정
2. **선별 수정** — CRITICAL만 수정, MAJOR → 개선 안건으로 분류
3. **사이클 종료** — 현재 상태로 중단

처리:
- 선택 1 → CRITICAL + MAJOR 전부 수정 대상, Step 7로
- 선택 2 → CRITICAL만 수정, MAJOR를 MINOR로 재분류, Step 7로
- 선택 3 → `currentPhase: "CLOSED"`, 종료

---

## Step 7: 버그 수정 (BUG_FIX)

> 상태 업데이트: `currentPhase: "BUG_FIX"`, `phases.BUG_FIX.status: "running"`

QA 보고서에서 수정 대상 버그 목록을 Read.

### CRITICAL 버그 수정 (순차 실행)
CRITICAL 버그는 서로 영향을 줄 수 있으므로 Agent를 **하나씩 순차** 실행:

```
당신은 {해당 역할} 개발자입니다.

## 수정할 버그
ID: {bug-id}
심각도: CRITICAL
설명: {description}
재현 경로: {reproduction steps}

## 관련 파일
{QA 보고서에서 식별된 파일 목록}

## 스킬셋
{해당 skill-*.md}

다음을 수행하세요:
1. Read 도구로 관련 파일을 읽고 원인 파악
2. Edit 도구로 수정 적용
3. 수정 전/후 코드와 수정 이유를 보고
```

### MAJOR 버그 수정 (병렬 실행)
MAJOR 버그는 독립적이므로 Agent를 **동시에** 실행. 프롬프트 구조는 동일.

### 버그 수정 보고서

```markdown
# 버그 수정 보고서: {feature-name} (사이클 #{iteration})

╔══════════════════════════════════════════╗
║  개발 사이클: {feature-name}              ║
║  현재 단계: 버그 수정 완료                 ║
║  반복: {iteration}/{max}                  ║
╚══════════════════════════════════════════╝

## 수정 결과
| Bug ID | 심각도 | 상태 | 수정 파일 | 변경 내용 |
|--------|--------|------|---------|---------|

## 미수정 항목 (MINOR → 다음 사이클 안건)
| Bug ID | 설명 | 사유 |
|--------|------|------|
```

저장: `docs/dev-cycle/{feature-slug}/05-bugfix-{iteration}.md`
상태 업데이트: `phases.BUG_FIX.status: "done"`

---

## Step 8: 승인 게이트 3 — 사이클 종료 판단 (GATE_3)

> 상태 업데이트: `currentPhase: "GATE_3"`

전체 사이클 현황을 표시:

```
╔════════════════════════════════════════════════╗
║  📊 사이클 #{iteration} 종합 현황               ║
║                                                ║
║  회의: ✅ 완료                                  ║
║  PD 보고서: ✅ 완료                             ║
║  개발: ✅ 완료 (변경 파일 N개)                   ║
║  QA: ✅ 완료 (통과율 X%)                        ║
║  버그 수정: ✅ CRITICAL 0건 잔여                 ║
║  잔여 MINOR/개선: K건                           ║
║                                                ║
║  사이클 반복: {iteration}/3                      ║
╚════════════════════════════════════════════════╝
```

AskUserQuestion:

선택지:
1. **사이클 종료** — 개발 완료, 최종 보고서 생성
2. **개선 사이클** — MINOR 항목 개선을 위해 재회의 (iterationCount < 3일 때만)
3. **재QA만** — 수정 사항 재검증만 실행 (iterationCount < 3일 때만)

처리:
- 선택 1 → Step 9 (최종 보고서)
- 선택 2 → `iterationCount` 확인. 3회 도달 시 "최대 반복 횟수 도달. 사이클을 종료하거나 새 `/dev-cycle`을 시작하세요." 경고. 아니면 `iterationCount++`, MINOR 항목을 다음 회의 안건으로 등록, Step 1로
- 선택 3 → `iterationCount++`, Step 5 (QA)로. Tier 3 회귀 테스트 활성화

---

## Step 9: 최종 보고서 (CLOSED)

> 상태 업데이트: `currentPhase: "CLOSED"`

모든 사이클 문서를 Read하여 종합 보고서 생성:

```markdown
# 개발 사이클 최종 보고서: {feature-name}

╔══════════════════════════════════════════╗
║  ✅ 개발 사이클 완료                       ║
║  기능: {feature-name}                     ║
║  총 반복: {iteration}회                   ║
║  총 소요: {시작시각 ~ 종료시각}             ║
╚══════════════════════════════════════════╝

## 사이클 이력
| 반복 | 회의 | 개발 | QA 통과율 | 버그 수정 | 결과 |
|------|------|------|---------|---------|------|

## 전체 변경 파일 목록
| 파일 | 최종 상태 | 관련 사이클 |
|------|---------|-----------|

## 잔여 개선 사항 (MINOR)
| ID | 설명 | 우선순위 | 비고 |
|----|------|---------|------|

## 회고
### 잘된 점
[자동 도출]

### 개선할 점
[자동 도출]

### 다음에 적용할 것
[자동 도출]
```

저장: `docs/dev-cycle/{feature-slug}/99-final-report.md`
상태 업데이트: 전체를 `"CLOSED"` + 최종 타임스탬프
완료 메시지 출력.

---

## 부록 A: 사이클 상태 배너

매 단계 출력 상단에 반드시 포함:

```
╔══════════════════════════════════════════╗
║  개발 사이클: {feature-name}              ║
║  현재 단계: {phase-name}                  ║
║  반복: {iteration}/{max}                  ║
╚══════════════════════════════════════════╝
```

단계별 이모지:
- 🔵 MEETING (회의 중)
- 📋 PD_REPORT (보고서 작성)
- 🚦 GATE (승인 대기)
- 🟢 DEVELOPMENT (개발 진행)
- 🔍 QA (테스트 중)
- 🔧 BUG_FIX (버그 수정)
- ✅ CLOSED (완료)

---

## 부록 B: 상태 파일 스키마 및 업데이트 규칙

### 초기 상태 (`dev-cycle-status.json`)

```json
{
  "version": "1.0",
  "lastUpdated": "ISO timestamp",
  "feature": "feature-slug",
  "featureDescription": "원래 기능 설명",
  "currentPhase": "INIT",
  "iterationCount": 0,
  "maxIterations": 3,
  "startedAt": "ISO timestamp",
  "phases": {
    "MEETING": { "status": "pending", "outputFile": null, "timestamp": null },
    "PD_REPORT": { "status": "pending", "outputFile": null, "timestamp": null },
    "GATE_1": { "status": "pending", "decision": null, "timestamp": null },
    "DEVELOPMENT": { "status": "pending", "outputFile": null, "timestamp": null },
    "QA": { "status": "pending", "outputFile": null, "bugReport": null, "timestamp": null },
    "GATE_2": { "status": "pending", "decision": null, "timestamp": null },
    "BUG_FIX": { "status": "pending", "outputFile": null, "timestamp": null },
    "GATE_3": { "status": "pending", "decision": null, "timestamp": null }
  },
  "history": []
}
```

### 업데이트 규칙
- 상태 변경 시 항상 Read → 수정 → Write (전체 덮어쓰기)
- `lastUpdated`는 매번 갱신
- `history` 배열에 `{ "timestamp": "ISO", "phase": "PHASE_NAME", "action": "설명" }` 추가
- 에러 발생 시 해당 phase의 status를 `"error"`로 설정하고 에러 메시지 기록
- JSON.parse 실패 시 사용자에게 경고 후 새 사이클 시작 여부 질문

---

## 부록 C: 반복 횟수 제한

- `iterationCount`는 0부터 시작, MEETING으로 루프백할 때마다 +1
- `iterationCount === 3`이면 추가 루프 금지
- 3회 도달 시 선택지: 사이클 종료 또는 새 `/dev-cycle` 세션 시작
- 이 제한은 무한 루프 방지와 컨텍스트 윈도우 보호를 위함

---

## 부록 D: 컨텍스트 관리

- 각 단계 완료 후 전체 출력을 파일로 저장, 대화 컨텍스트에는 요약만 유지
- 이전 단계 참조 시 파일을 Read (대화 히스토리 의존 금지)
- 현재 단계에 필요한 섹션만 선택적으로 Read
- 컨텍스트 부족 감지 시 사용자에게 경고 후 사이클 종료 제안
