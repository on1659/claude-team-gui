# 버그 수정 보고서: 오피스 UI + 말풍선 채팅 (사이클 #0)

╔══════════════════════════════════════════╗
║  개발 사이클: office-ui-speech-bubble      ║
║  현재 단계: 버그 수정 완료                  ║
║  반복: 0/3                                ║
╚══════════════════════════════════════════╝

## 수정 결과

| Bug ID | 심각도 | 상태 | 수정 파일 | 변경 내용 |
|--------|--------|------|---------|---------|
| M-3 | MAJOR | ✅ 수정됨 | ChatLogPanel.tsx | `prevAgentCount` ref 추가, agents.length 변경 시 `isAutoScroll.current = true`로 초기화 |
| m-1 | MINOR | ✅ 수정됨 | SpeechBubble.tsx | `!text` → `!text \|\| !text.trim()` 조건으로 공백 전용 텍스트 필터링 |
| m-2 | MINOR | ✅ 수정됨 | OfficeView.tsx | 35자 이하 텍스트는 `. ` 기반 truncation 로직 우회, 전체 반환 |
| m-3 | MINOR | ✅ 수정됨 | OfficeView.tsx | `rows.map` → `row.length > 0 ? <div>...</div> : null` 조건부 렌더링 |

## 빌드 검증

- `tsc --noEmit`: ✅ 통과
- `npm run build`: ✅ 통과 (panel.js 20.38 kB)

## 미수정 항목 (선재 이슈 → 별도 대응)

| Bug ID | 설명 | 사유 |
|--------|------|------|
| C-1 | useChunkBuffer rAF unmount 미취소 | 기존 코드, 이번 사이클 범위 외 |
| C-3 | 비참여자 CHUNK 이벤트 무시 | 기존 설계, 의도된 동작 |
| M-4 | useChunkBuffer rAF cancel-reschedule storm | 기존 코드, 성능 최적화 별도 진행 |
