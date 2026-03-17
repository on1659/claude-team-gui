# 개발 결과 보고서: M2 잔여 작업 (사이클 #0)

╔══════════════════════════════════════════╗
║  🟢 개발 사이클: m2-remaining             ║
║  현재 단계: 개발 완료                      ║
║  반복: 0/3                                ║
╚══════════════════════════════════════════╝

## 변경 파일 목록

| 파일 | 변경 유형 | 담당 | 설명 |
|------|---------|------|------|
| `extension/src/webview/panel/ProgressBar.tsx` | 신규 | FE | 독립 ProgressBar 컴포넌트 (ARIA 포함) |
| `extension/src/webview/panel/SummaryView.tsx` | 신규 | FE | 회의 요약 컴포넌트 (프로그레시브 디스클로저) |
| `extension/src/webview/panel/MeetingHeader.tsx` | 수정 | FE | 인라인 progress bar → ProgressBar 컴포넌트로 교체 |
| `extension/src/webview/panel/App.tsx` | 수정 | FE | 인라인 summarySection → SummaryView 교체, cancelled 상태, import 추가 |
| `extension/src/webview/panel/AgentCard.tsx` | 수정 | FE | retrying 라벨 버그 수정 (`attempt/attempt` → `attempt회`) |
| `extension/src/services/meeting-service.ts` | 수정 | BE | combinedSignal 수정, generateSummaryViaLLM 추가, buildSummary async 전환 |

## 구현 상세

### BE — 태준

#### 1. combinedSignal 버그 수정 (CRITICAL)
- **수정 전**: `signal.aborted ? signal : timeoutController.signal` — parent abort 미전파
- **수정 후**: `combinedController`를 생성하여 parent signal과 timeout signal 모두를 감시. 어느 쪽이든 abort 시 `combinedController.abort()` 호출
- `cleanup()` 함수로 리스너/타이머 정리 일원화

#### 2. generateSummaryViaLLM() 신규 메서드
- `low` tier 모델로 회의 전체 응답을 요약 요청
- 시스템 프롬프트로 JSON 형식 강제
- markdown 코드 블록 래핑 대응 (`json` 코드블록 파싱)
- JSON 파싱 실패 / 에러 시 빈 배열 fallback (graceful degradation)
- `maxTokens: 500`으로 비용 제한

#### 3. buildQuickSummary / buildDeepSummary 비동기 전환
- 동기 → `async` 전환
- caller (runQuickMeeting, runDeepMeeting)에서 `await` 추가
- `provider` 파라미터 추가하여 LLM 호출 가능하도록

### FE — 미래

#### 4. ProgressBar.tsx (신규)
- Props: `progress` (0-100), `phase` ('running' | 'done' | 'cancelled')
- ARIA: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- cancelled 시 `null` 반환 (숨김)
- `data-testid="progress-bar"` 추가

#### 5. SummaryView.tsx (신규)
- `useState`로 접기/펼치기 (`expanded`) 관리
- 기본 접힌 상태: 비용 + 시간 + "요약 보기 ▼" 버튼
- 펼친 상태: 합의점(success) / 충돌점(warn) / 액션아이템(info) 3섹션
- 3섹션 모두 빈 배열이면 "요약 보기" 버튼 자체 숨김
- 충돌점: 주제별 그룹 + 의견별 불릿

#### 6. retrying 라벨 수정
- `${state.attempt}/${state.attempt}` → `${state.attempt}회`

#### 7. cancelled 상태 연결
- `meetingCancelled` 핸들러에서 `{ type: 'idle' }` → `{ type: 'error', message: '취소됨', retryable: false, attempt: 0 }`
- 기존 AgentCard error 렌더링으로 "⚠ 취소됨" 표시

## 미해결 사항
- 없음 (WBS 전 항목 구현 완료)

## QA 요청 사항
- combinedSignal: parent abort → timeout abort → 복합 abort 전파 경로 검증
- generateSummaryViaLLM: JSON 파싱 실패 시 graceful degradation 확인
- ProgressBar: ARIA 속성 정상 렌더링 확인
- SummaryView: 빈 배열 / 데이터 있을 때 / 접기 펼치기 동작
- cancelled 상태: 취소 시 에이전트 카드에 "⚠ 취소됨" 표시 확인
