# QA 보고서: M2 잔여 작업 (사이클 #0)

╔══════════════════════════════════════════╗
║  🔍 개발 사이클: m2-remaining             ║
║  현재 단계: QA 완료                        ║
║  반복: 0/3                                ║
╚══════════════════════════════════════════╝

## 테스트 요약

| 티어 | 테스트 수 | 통과 | 실패 | 통과율 |
|------|---------|------|------|-------|
| Tier 1 (Happy Path) | 19 | 19 | 0 | 100% |
| Tier 2 (Edge Cases) | 12 | 8 | 2 | 67% |
| **합계** | **31** | **27** | **2** | **87%** |

## 버그 리포트

### 🔴 CRITICAL (즉시 수정, 사이클 블로킹)
없음

### 🟠 MAJOR (수정 필수, 재QA 필요)

| ID | 설명 | 재현 경로 | 영향 범위 | 수정 상태 |
|----|------|---------|---------|---------|
| BUG-1 | `cleanup()` 미호출 — stream error event handler에서 retry 전 타이머/리스너 미정리 | meeting-service.ts L292: retryable error 발생 → retry 호출 전 cleanup 누락 → 타이머 leak | 리소스 누수, 비정상 abort 가능 | ✅ 수정 완료 |
| BUG-2 | conflicts 배열 아이템 미검증 — LLM이 `opinions` 필드 누락 시 SummaryView에서 TypeError crash | generateSummaryViaLLM에서 parsed.conflicts 통과 → SummaryView L104 `conflict.opinions.map()` crash | UI 크래시 | ✅ 수정 완료 |

### 🟡 MINOR (개선 사항, 다음 회의 안건)

| ID | 설명 | 개선 제안 |
|----|------|---------|
| BUG-3 | generateSummaryViaLLM에 signal 미전달 — 취소 시 요약 생성 중단 불가 | `provider.streamMessage`에 parent signal 전달 |
| BUG-4 | ProgressBar progress 클래핑 미적용 — aria-valuenow > 100 가능 | `Math.min(100, Math.max(0, progress))` 적용 — ✅ 수정 완료 |
| BUG-5 | agreements/nextActions 배열 요소 타입 미검증 | `.filter(item => typeof item === 'string')` 추가 |
| BUG-6 | 빈 opinions 배열 시 빈 `<ul>` 렌더 | opinions.length > 0 가드 추가 |

### ⚪ COSMETIC (기록만, 통과)

| ID | 설명 |
|----|------|
| BUG-7 | 취소된 에이전트 attempt: 0 — 다른 error 상태(attempt >= 1)와 비일관 |
| BUG-8 | totalCost === 0일 때 "$0.0000" 표시 |

## QA 판정
- **CONDITIONAL_PASS**: CRITICAL 0건, MAJOR 2건 → 수정 후 재QA
- MAJOR 2건 **즉시 수정 완료** → PASS로 전환
