# PD 보고서: M2 잔여 작업 (사이클 #0)

╔══════════════════════════════════════════╗
║  📋 개발 사이클: m2-remaining             ║
║  현재 단계: PD 보고서                      ║
║  반복: 0/3                                ║
╚══════════════════════════════════════════╝

## Go/No-Go 판단

**🟢 GO**

근거:
1. 잔여 작업 3건 + 버그 3건 모두 M2 범위 내이며 스코프 크립 없음
2. 기술적 난이도 중하 — 기존 코드베이스 위에 추가/수정 작업
3. 예상 공수 3~3.5일, M2 마일스톤 일정 내 충분히 소화 가능

---

## 작업 분해 (WBS)

| # | 담당 | 작업 | 예상 공수 | 선행 작업 | 우선순위 |
|---|------|-----|---------|---------|---------|
| 1 | 태준(BE) | combinedSignal 버그 수정 — `AbortSignal.any()` 또는 수동 복합 시그널 | 0.25일 | 없음 | 🔴 CRITICAL |
| 2 | 태준(BE) | `generateSummaryViaLLM()` 메서드 구현 — low tier 모델로 요약 추출 | 1일 | 없음 | 🟠 HIGH |
| 3 | 태준(BE) | `buildQuickSummary`/`buildDeepSummary` LLM 요약 연동 | 0.5일 | #2 | 🟠 HIGH |
| 4 | 미래(FE) | ProgressBar.tsx 분리 — ARIA 속성 + 디자인 토큰 | 0.25일 | 없음 | 🟡 MEDIUM |
| 5 | 미래(FE) | SummaryView.tsx 구현 — 프로그레시브 디스클로저 + 3섹션 | 0.75일 | #3 (MeetingSummary 데이터 필요) | 🟠 HIGH |
| 6 | 미래(FE) | retrying 라벨 버그 수정 — `maxRetry` 분모 전달 | 0.1일 | 없음 | 🟡 MEDIUM |
| 7 | 미래(FE) | cancelled 상태 연결 — meetingCancelled → cancelled 전이 | 0.1일 | 없음 | 🟡 MEDIUM |
| 8 | 윤서(QA) | M2 Gate 11항목 검증 | 0.5일 | #1~#7 전부 | 🟠 HIGH |

**총 예상 공수: ~3.5일** (병렬 실행 시 BE/FE 동시 진행으로 ~2일 소요)

---

## 개발 범위 확정

### 이번 사이클 포함
- ProgressBar.tsx 독립 컴포넌트 (ARIA 포함)
- SummaryView.tsx (합의점/충돌점/액션아이템 3섹션 + 접기/펼치기)
- `generateSummaryViaLLM()` — low tier LLM으로 회의 요약 자동 생성
- `buildQuickSummary`/`buildDeepSummary` LLM 연동
- combinedSignal 버그 수정 (CRITICAL)
- retrying 라벨 버그 수정
- cancelled 상태 미사용 버그 수정
- M2 Quality Gate 11항목 검증

### 제외 (다음 사이클 또는 v2)
- SummaryView "복사" 버튼 (v2)
- SummaryView "다운로드" 기능 (v2)
- 요약 결과 외부 저장/내보내기 (v2)
- 스켈레톤 로더 디자인 토큰 정의 (v2 — 현재는 텍스트 로딩 표시)

---

## 리스크 매트릭스

| 리스크 | 확률 | 영향 | 대응 전략 |
|--------|------|------|---------|
| `AbortSignal.any()` Node 버전 미지원 | 중 | 상 | Electron Node 버전 확인, 미지원 시 수동 복합 시그널 구현 |
| LLM 요약 호출 비용 증가 | 중 | 중 | low tier 모델 고정 + 최대 토큰 제한 (500 output) |
| LLM 요약 품질 불안정 | 중 | 중 | JSON 스키마 강제 프롬프트 + 파싱 실패 시 빈 배열 fallback |
| SummaryView↔MeetingSummary 타이밍 | 하 | 중 | 회의 완료 후 비동기 요약 생성, UI에 로딩 상태 표시 |
| retry 시 seq 리셋으로 Panel 혼동 | 중 | 중 | retry 시 seq를 0이 아닌 마지막 seq+1부터 시작, 또는 lastSeqMap 리셋 |

---

## 예상 사용 시나리오

### 개발 전 (As-Is)
1. 사용자가 회의를 실행하면 에이전트 카드에서 스트리밍 진행
2. **진행률 바가 있으나 ARIA 없음** → 스크린리더 사용자는 진행 상태 인지 불가
3. 회의 완료 시 **비용과 시간만 표시** → 합의사항, 충돌, 액션아이템을 직접 각 에이전트 응답을 읽으며 파악
4. 에이전트 카드에서 retrying 시 **시도 횟수 표시 오류** (`2/2` 식으로 분모=분자)
5. 회의 취소 시 **cancelled 상태가 아닌 idle로 리셋** → 사용자가 취소 여부 구분 불가

### 개발 후 (To-Be)
1. 회의 진행 중 **접근 가능한 ProgressBar**가 진행률을 시각+청각으로 전달
2. 회의 완료 시 **자동 생성된 요약 카드**가 나타남:
   - ✅ 합의점 목록
   - ⚠️ 충돌점 (누구 vs 누구)
   - 📌 다음 액션아이템
3. 기본 접힌 상태에서 클릭으로 펼쳐 상세 확인 가능
4. retrying 시 `재시도 중... (1/3)` 형태로 **정확한 진행 표시**
5. 취소 시 **cancelled 상태**로 명확한 시각적 피드백

### 기대 효과
- 회의 결과 파악 시간: **5~10분 (8명 응답 개별 읽기) → 10초 (요약 확인)**
- 접근성 점수 개선: progressbar ARIA 추가로 WCAG 2.1 AA 충족
- 사용자 혼란 감소: retrying/cancelled 상태 정확한 표시

### 주의사항/한계
- v1에서 요약 결과 복사/다운로드 미지원 (눈으로 확인만)
- LLM 요약은 low tier 모델이라 완벽하지 않을 수 있음 — 참고용
- 요약 생성 실패 시 기존처럼 비용/시간만 표시 (graceful degradation)
