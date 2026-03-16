# 개발 사이클 최종 보고서: 오피스 UI + 말풍선 채팅

╔══════════════════════════════════════════╗
║  ✅ 개발 사이클 완료                       ║
║  기능: office-ui-speech-bubble            ║
║  총 반복: 3회 (0, 1, 2)                   ║
║  총 소요: 2026-03-16 10:00 ~ 12:45 UTC    ║
╚══════════════════════════════════════════╝

## 사이클 이력

| 반복 | 회의 | 개발 | QA 통과율 | 버그 수정 | 결과 |
|------|------|------|---------|---------|------|
| #0 | ✅ 8인 팀 회의 | ✅ 3 신규 컴포넌트 + App.tsx 통합 | 84% (16/19) | MAJOR 1건 수정 | CONDITIONAL_PASS → 개선 사이클 |
| #1 | ✅ 개선 회의 | ✅ 6건 폴리싱 (position fix, ellipsis, rAF cleanup 등) | - | - | 개선 완료 → 추가 사이클 |
| #2 | ✅ 최종 회의 | ✅ 배경 그리드 + 반응형 가드 | 79% → 재QA 100% (17/17) | CRITICAL 1 + MAJOR 2 수정 | PASS → 사이클 종료 |

## 전체 변경 파일 목록

| 파일 | 최종 상태 | 관련 사이클 | 설명 |
|------|---------|-----------|------|
| `extension/src/webview/panel/SpeechBubble.tsx` | **NEW** | #0 | 말풍선 컴포넌트 (CSS triangle tail, variant 색상, 40자 truncate) |
| `extension/src/webview/panel/OfficeView.tsx` | **NEW** | #0, #1, #2 | 2×4 오피스 뷰 (PixelAvatar + 말풍선 + talk 애니메이션 + 도트 그리드 배경) |
| `extension/src/webview/panel/ChatLogPanel.tsx` | **NEW** | #0, #1 | 채팅 로그 패널 (auto-scroll, 에이전트별 색상, 회의 간 초기화) |
| `extension/src/webview/panel/App.tsx` | **MODIFIED** | #0, #2 | OfficeView/ChatLogPanel 통합, 뷰 토글, ResizeObserver 반응형 가드 |
| `extension/src/webview/shared/hooks/useChunkBuffer.ts` | **MODIFIED** | #1 | rAF unmount cleanup 추가 (메모리 누수 방지) |

## 구현 핵심 기능

### 1. 픽셀 오피스 뷰 (OfficeView)
- 8명 팀원을 2행×4열 그리드에 PixelAvatar로 배치
- 스트리밍 중 `talk` CSS 애니메이션으로 발언 시각화
- idle 상태 캐릭터 반투명(0.5) 처리
- 도트 그리드 배경으로 사무실 공간감 연출
- done/error 상태 뱃지 (absolute positioned)

### 2. 말풍선 (SpeechBubble)
- 캐릭터 상단에 실시간 스트리밍 텍스트 표시
- 4가지 variant: default/streaming/done/error — 테두리 색상 자동 변경
- CSS border triangle 기법으로 말풍선 꼬리 구현
- streaming 시 커서 블링크 애니메이션

### 3. 채팅 로그 패널 (ChatLogPanel)
- 우측 280px 고정 폭 패널에 전체 대화 기록 표시
- 에이전트별 accent color (pixel-data.ts palette[3] 활용)
- auto-scroll + 사용자 스크롤업 감지 → 수동 모드 전환
- 회의 전환 시 isAutoScroll 자동 초기화

### 4. 반응형 가드 (App.tsx)
- ResizeObserver callback ref 패턴으로 패널 너비 실시간 추적
- 500px 미만: ChatLogPanel 자동 숨김
- ResizeObserver 미지원 환경 graceful 폴백
- 초기값 0으로 narrow panel 플래시 방지

### 5. 뷰 토글
- 오피스 뷰 ↔ 카드 뷰 원클릭 전환 버튼

## 수정된 버그 총 목록

| ID | 심각도 | 사이클 | 설명 | 수정 방법 |
|----|--------|--------|------|---------|
| M-3 | MAJOR | #0 | isAutoScroll 회의 간 미초기화 | prevAgentCount ref 추가 |
| m-1 | MINOR | #0 | 공백 텍스트 빈 말풍선 | `!text.trim()` 조건 추가 |
| m-2 | MINOR | #0 | 35자 미만 텍스트 불필요 truncate | 조기 반환 조건 추가 |
| m-3 | MINOR | #0 | 빈 행 gap 차지 | `row.length > 0` 조건부 렌더링 |
| c-2 | COSMETIC | #1 | 상태 뱃지 수직 어긋남 | position: absolute로 전환 |
| c-3 | COSMETIC | #1 | 긴 이름 overflow | text-overflow: ellipsis + title |
| C-1 | PRE-EXISTING | #1 | rAF unmount 메모리 누수 | useEffect cleanup 추가 |
| T2-4 | CRITICAL | #2 | ResizeObserver 미부착 | callback ref 패턴으로 전환 |
| T2-1 | MAJOR | #2 | ResizeObserver 폴백 없음 | typeof 가드 추가 |
| T2-3 | MAJOR | #2 | 초기값 600 플래시 | 초기값 0으로 변경 |

## 잔여 개선 사항 (MINOR)

| ID | 설명 | 우선순위 | 비고 |
|----|------|---------|------|
| T2-2 | 리사이즈 시 불필요한 리렌더링 | Low | ResizeObserver rAF 배칭으로 실제 성능 영향 미미 |
| T2-5 | ChatLogPanel 리마운트 시 스크롤 위치 유실 | Low | display:none 방식 또는 스크롤 위치 lift-up으로 개선 가능 |

## 빌드 결과

- `tsc --noEmit`: ✅ 통과
- `npm run build`: ✅ 통과
  - panel.js: 21.07 kB (gzip 6.00 kB)
  - sidebar.js: 13.05 kB (gzip 4.37 kB)

## 회고

### 잘된 점
- 3회 반복으로 점진적 품질 향상 — 사이클 #0 코어 구현 → #1 폴리싱 → #2 기능 추가 + 치명적 버그 발견/수정
- QA의 edge case 테스트(Tier 2)에서 CRITICAL 버그(ResizeObserver 미부착) 조기 발견 — 배포 전 차단
- Callback ref 패턴으로 React 컴포넌트 라이프사이클과 DOM 상태 불일치 문제 근본 해결
- 회귀 테스트(Tier 3) 매 사이클 전체 통과 — 수정이 다른 곳을 깨뜨리지 않음 확인

### 개선할 점
- useRef + useEffect 패턴의 한계를 사전에 고려했다면 callback ref를 처음부터 사용할 수 있었음
- 초기 panelWidth 기본값 선택에 더 신중해야 — 실제 환경 첫 렌더 시나리오를 고려

### 다음에 적용할 것
- 조건부 렌더링되는 DOM 요소에 ResizeObserver를 부착할 때는 callback ref 패턴을 기본으로 사용
- 반응형 가드의 초기 상태는 "숨김"이 안전한 기본값 — 측정 후 노출
- CSS-only 장식(radial-gradient 등)은 비용 없이 UX를 높이는 좋은 투자
