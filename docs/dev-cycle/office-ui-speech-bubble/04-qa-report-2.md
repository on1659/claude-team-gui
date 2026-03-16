# QA 보고서: 오피스 UI + 말풍선 채팅 (사이클 #2)

╔══════════════════════════════════════════╗
║  개발 사이클: office-ui-speech-bubble      ║
║  현재 단계: QA 완료                        ║
║  반복: 2/3                                ║
╚══════════════════════════════════════════╝

## 테스트 요약

| 티어 | 테스트 수 | 통과 | 실패 | 통과율 |
|------|---------|------|------|-------|
| Tier 1 (Happy Path) | 10 | 10 | 0 | 100% |
| Tier 2 (Edge Case) | 7 | 2 | 5 | 29% |
| Tier 3 (Regression) | 7 | 7 | 0 | 100% |
| **합계** | **24** | **19** | **5** | **79%** |

## 빌드 검증

- `tsc --noEmit`: ✅ 통과 (0 errors)
- `npm run build`: ✅ 통과 (panel.js 21.07 kB gzip 6.00 kB)

## 버그 리포트

### 🔴 CRITICAL (즉시 수정, 사이클 블로킹)

| ID | 설명 | 재현 경로 | 영향 범위 |
|----|------|---------|---------|
| T2-4 | ResizeObserver useEffect의 빈 의존성 배열 `[]` — 컴포넌트 마운트 시 meeting.phase='idle'이므로 containerRef가 null, observer 미생성. meeting 시작 후에도 effect가 재실행되지 않아 panelWidth가 영구 600으로 고정. showChatLog 조건이 사실상 사문코드 | 앱 마운트 → idle 상태 → 회의 시작 → containerRef 연결되지만 ResizeObserver 미부착 | App.tsx — 반응형 가드 전체 기능 |

### 🟠 MAJOR (수정 필수, 재QA 필요)

| ID | 설명 | 재현 경로 | 영향 범위 |
|----|------|---------|---------|
| T2-1 | ResizeObserver 미지원 환경에서 폴백 없음 — `new ResizeObserver()` 호출 시 ReferenceError 크래시 | ResizeObserver 미지원 webview에서 패널 오픈 | App.tsx |
| T2-3 | 초기 panelWidth=600 — 실제 패널이 500px 미만일 때 ChatLogPanel이 1프레임 동안 보였다 사라지는 플래시 | 좁은 패널에서 앱 로드 | App.tsx |

### 🟡 MINOR (개선 사항, 다음 회의 안건)

| ID | 설명 | 개선 제안 |
|----|------|---------|
| T2-2 | ResizeObserver 콜백이 매 픽셀 변경마다 setPanelWidth 호출 — 드래그 리사이즈 시 불필요한 리렌더링 | 500px 임계점 기준 boolean만 state로 관리, 또는 디바운싱 |
| T2-5 | showChatLog 토글 시 ChatLogPanel 언마운트/리마운트 — 스크롤 위치 유실 | `display: none` 방식으로 마운트 유지, 또는 스크롤 위치 lift-up |

### ⚪ COSMETIC (기록만, 통과)

없음.

## 회귀 테스트 (Tier 3)

7/7 전체 통과. 이전 사이클에서 수정된 버그(M-3, m-1~m-3, C-1, c-2, c-3) 모두 재발 없음.

## QA 판정

- **FAIL**: CRITICAL 1건 (T2-4: ResizeObserver 미부착) → 즉시 수정 필수
