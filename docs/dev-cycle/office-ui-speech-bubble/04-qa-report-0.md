# QA 보고서: 오피스 UI + 말풍선 채팅 (사이클 #0)

╔══════════════════════════════════════════╗
║  개발 사이클: office-ui-speech-bubble      ║
║  현재 단계: QA 완료                        ║
║  반복: 0/3                                ║
╚══════════════════════════════════════════╝

## 테스트 요약

| 티어 | 테스트 수 | 통과 | 실패 | 통과율 |
|------|---------|------|------|-------|
| Tier 1 (Happy Path) | 8 | 8 | 0 | 100% |
| Tier 2 (Edge Case) | 11 | 8 | 3 | 73% |
| **합계** | **19** | **16** | **3** | **84%** |

## 빌드 검증

- `tsc --noEmit`: ✅ 통과 (0 errors)
- `npm run build`: ✅ 통과 (panel.js 20.23 kB gzip 5.73 kB)

## 버그 리포트

### 🔴 CRITICAL (즉시 수정, 사이클 블로킹)

없음.

> 참고: Tier 2에서 C-1(useChunkBuffer rAF leak), C-3(CHUNK drop for non-participants)이 발견되었으나, 이들은 이번 사이클에서 수정한 코드가 아닌 **기존 코드의 선재 이슈**입니다. 이번 사이클 범위 외로 분류합니다.

### 🟠 MAJOR (수정 필수, 재QA 필요)

| ID | 설명 | 재현 경로 | 영향 범위 |
|----|------|---------|---------|
| M-3 | ChatLogPanel의 `isAutoScroll` ref가 회의 간 초기화되지 않음. 첫 회의에서 스크롤 업 → 두 번째 회의에서 auto-scroll 비활성 | 회의 완료 → 채팅 로그 위로 스크롤 → 새 회의 시작 → auto-scroll 동작 안 함 | ChatLogPanel |

### 🟡 MINOR (개선 사항, 다음 회의 안건)

| ID | 설명 | 개선 제안 |
|----|------|---------|
| m-1 | SpeechBubble에 공백만 있는 텍스트(`"   "`) 전달 시 빈 말풍선 표시 | `!text.trim()` 조건 추가 |
| m-2 | getBubbleText에서 짧은 텍스트(35자 미만)에 `. `가 포함되면 마지막 문장만 표시됨 (예: `"Hello. World"` → `"World"`) | 35자 미만 텍스트는 truncate 없이 전체 반환 |
| m-3 | agents < 5명일 때 빈 두 번째 행이 gap(20px) 차지 | `row.length > 0` 조건부 렌더링 |

### ⚪ COSMETIC (기록만, 통과)

| ID | 설명 |
|----|------|
| c-2 | done/error 상태 뱃지가 `position: relative`로 2px 수직 어긋남 |
| c-3 | 긴 에이전트 이름이 80px 컨테이너에서 `whiteSpace: nowrap` overflow |

## 선재 이슈 (이번 사이클 범위 외)

| ID | 설명 | 파일 | 비고 |
|----|------|------|------|
| C-1 | useChunkBuffer rAF 취소 미처리 (unmount 시 메모리 누수) | useChunkBuffer.ts | 기존 코드 |
| C-3 | participants에 없는 agentId의 CHUNK 이벤트 무시 | types.ts / App.tsx | 기존 설계 |
| M-4 | useChunkBuffer rAF cancel-reschedule storm | useChunkBuffer.ts | 기존 코드 |
| M-5 | done 상태 터미널 — reducer로 reset 불가 | types.ts | 의도된 설계 |

## QA 판정

- **CONDITIONAL_PASS**: CRITICAL 0건, MAJOR 1건 → 수정 후 재QA
- MAJOR 1건(M-3: isAutoScroll 초기화)은 간단한 1줄 수정으로 해결 가능
