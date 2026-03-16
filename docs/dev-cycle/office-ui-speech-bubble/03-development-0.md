# 개발 결과 보고서: 오피스 UI + 말풍선 채팅 (사이클 #0)

╔══════════════════════════════════════════╗
║  개발 사이클: office-ui-speech-bubble      ║
║  현재 단계: 개발 완료                      ║
║  반복: 0/3                                ║
╚══════════════════════════════════════════╝

## 변경 파일 목록

| 파일 | 변경 유형 | 담당 | 설명 |
|------|---------|------|------|
| `extension/src/webview/panel/SpeechBubble.tsx` | 신규 | FE | 말풍선 컴포넌트 (truncate, tail, variant별 색상) |
| `extension/src/webview/panel/OfficeView.tsx` | 신규 | FE | 오피스 뷰 (2행4열 캐릭터 + 말풍선 + talk 애니메이션) |
| `extension/src/webview/panel/ChatLogPanel.tsx` | 신규 | FE | 채팅 로그 패널 (스크롤, 역할별 색상, auto-scroll) |
| `extension/src/webview/panel/App.tsx` | 수정 | FE | OfficeView + ChatLogPanel 레이아웃, 뷰 토글 추가 |

## 구현 상세

### SpeechBubble (FE)
- CSS border 삼각형으로 꼬리 구현 (외곽선 + 내부 채움 이중 레이어)
- variant별 border 색상: streaming=active, done=success, error=error
- JS 기반 텍스트 truncate (max 40자) — CSS vendor prefix 의존 제거
- streaming 시 cursor blink 애니메이션 포함

### OfficeView (FE)
- 2행 × 4열 flexbox 그리드, flex-wrap으로 좁은 패널 대응
- `getBubbleText()`: AgentState에서 말풍선 텍스트 추출
  - streaming: 버퍼의 마지막 30자를 자동 추출
  - done: "✓ 발언 완료"
  - error: 에러 메시지 요약
- PixelAvatar 48px 크기, streaming 시 `talk` CSS 애니메이션 적용
- idle 캐릭터 opacity 0.5로 비활성 표시
- done/error 상태 뱃지 (✓/✕) PixelAvatar 우하단 표시
- error 캐릭터 클릭 시 retry 트리거

### ChatLogPanel (FE)
- 좌측 border 색상: `pixel-data.ts`의 palette[3] (메인 의상 색상)으로 에이전트별 구분
- 16px 미니 PixelAvatar + 이름 + 역할 헤더
- streaming 시 blink dot + cursor blink 표시
- done 시 토큰/시간 정보 표시
- auto-scroll 유지하되, 사용자가 위로 스크롤하면 auto-scroll 일시 중지

### App.tsx 레이아웃 (FE)
- `viewMode` state: 'office' (기본) | 'card'
- 오피스 뷰: OfficeView(flex-grow 좌) + ChatLogPanel(280px 고정 우)
- 카드 뷰: 기존 AgentGrid 유지 (fallback)
- MeetingHeader 우측에 뷰 전환 버튼 ("⊞ 카드" / "🏢 오피스")
- summarySection 변수로 추출하여 양쪽 뷰에서 재사용

### PixelAvatar 애니메이션 (FE)
- `component.css`에 이미 정의된 `@keyframes talk` (translateY 0→-1px→0) 사용
- OfficeView에서 streaming 상태일 때 avatar 래퍼에 `animation: talk 0.5s ease-in-out infinite` 적용
- 별도 CSS 수정 불필요 (기존 keyframes 재사용)

## 미해결 사항
- 반응형 600px 미만 탭 전환: flex-wrap으로 부분 대응만 됨, 전용 탭 UI 미구현 (MINOR)
- BE 말풍선 요약 로직: FE에서 JS truncate로 처리, Extension Host 수정 불필요

## QA 요청 사항
1. 8인 동시 streaming 시 말풍선 겹침/성능 확인
2. ChatLogPanel auto-scroll 동작 검증
3. 뷰 토글 시 상태 유지 확인 (오피스↔카드 전환 후 에이전트 상태 보존)
4. 기존 기능 회귀 (회의 시작/종료/retry/cancel)
5. tsc/build 성공 확인 (✅ 이미 통과)
