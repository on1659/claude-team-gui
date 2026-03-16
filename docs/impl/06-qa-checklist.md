# 06. QA 체크리스트 — DoD, 테스트 시나리오, 릴리즈 기준

> 윤서(QA) 회의 결과 반영
> 기존 DoD 4개 → 8개 보강 + SEC/STR/ERR 25개 테스트 시나리오

---

## 1. Definition of Done (v2) — 8개 항목

### 기존 4개 보강

| # | 항목 | 검증 방법 | 판정 기준 |
|---|------|-----------|-----------|
| 1 | **8명 동시 스트리밍 시 렌더링 정상** | seq 번호 연속성 자동 검증 + rAF 기반 렌더 성능 측정 | seq 역전 0건, 중복 렌더 0건 |
| 2 | **API 키 Webview 미노출** | Webview 수신 메시지 전수 검사 + DevTools 페이로드 덤프 | `apiKey` 문자열 포함 0건, `hasKey: boolean`만 확인 |
| 3 | **부분 실패 격리** | 1명 강제 실패 후 나머지 7명 상태 확인 | 실패 AgentCard 독립 retry 가능, 다른 카드 상태 변화 없음 |
| 4 | **Markdown 복사/저장** | 클립보드 내용 = raw Markdown 일치 / 파일 UTF-8 인코딩 확인 | 빈 결과·스트리밍 중 시도 → 예외 처리 정상 |

### 신규 추가 4개

| # | 항목 | 검증 방법 | 판정 기준 |
|---|------|-----------|-----------|
| 5 | **AbortController 취소** | 스트리밍 중 취소 → Provider별 실제 요청 중단 확인 | 취소 후 API 추가 과금 0건 |
| 6 | **seq 갭 대응** | seq 강제 누락 시뮬레이션 | 갭 감지 로그 출력, UI 정합성 유지, agentDone에서 전체 내용 정상 |
| 7 | **키 업데이트 롤백** | SecretStorage write 실패 mock | 새 키 검증 실패 시 기존 키 유지, 서비스 중단 없음 |
| 8 | **postMessage 고부하** | 8명 동시 → 초당 30+ 메시지 스트레스 테스트 | 메시지 유실 0건, 렌더 FPS ≥ 30 |

---

## 2. 테스트 시나리오

### SEC — 보안 (7건)

| ID | 시나리오 | 입력 | 기대 결과 |
|----|---------|------|-----------|
| SEC-01 | Webview 수신 메시지 전수 검사 | DevTools로 모든 postMessage 로깅 | apiKey 문자열 포함 0건 |
| SEC-02 | hasKey 전달 확인 | Provider 설정 후 providerList 메시지 수신 | `hasKey: true/false`만 포함, 키 값 없음 |
| SEC-03 | SecretStorage 키 네이밍 | Provider 3종 키 저장 후 조회 | `claude-team.apiKey.{anthropic\|openai\|gemini}` 정확히 저장 |
| SEC-04 | Provider 전환 시 키 혼입 방지 | Anthropic → OpenAI 전환 후 요청 | OpenAI 키로만 요청, Anthropic 키 미사용 |
| SEC-05 | validateKey 후 메모리 정리 | validateKey 호출 30초 후 | 키 값이 함수 스코프 외부에 잔존하지 않음 |
| SEC-06 | 키 업데이트 중 kill | 업데이트 도중 프로세스 종료 후 재시작 | 기존 키 또는 신규 키 중 하나만 존재 (partial write 없음) |
| SEC-07 | 잘못된 형식 키 입력 | prefix 불일치, 길이 초과/미달 | 저장 거부 + 사용자 피드백 표시 |

### STR — 스트리밍 (8건)

| ID | 시나리오 | 입력 | 기대 결과 |
|----|---------|------|-----------|
| STR-01 | 8명 동시 seq 연속성 | 8명 동시 스트리밍 실행 | 각 AgentCard별 seq 연속 (0,1,2,...) |
| STR-02 | rAF 배치 처리 | 16ms 내 다수 chunk 수신 | 한 프레임에 일괄 렌더, 개별 setState 없음 |
| STR-03 | 고부하 메시지 | 초당 30+ 메시지 전송 | 메시지 유실 0건, 렌더 정상 |
| STR-04 | seq 갭 강제 발생 | seq 5 다음 seq 7 전송 | console.warn 로그 + 이어붙이기 정상 |
| STR-05 | 포커스 이탈/복귀 | 스트리밍 중 다른 탭 → 복귀 | 렌더 상태 정합, 누락 chunk 없음 |
| STR-06 | AbortController cancel | 스트리밍 중 취소 | Provider별 stream.abort() 호출 확인 |
| STR-07 | 취소 후 데이터 정리 | 취소 후 같은 에이전트 재실행 | 이전 스트림 데이터 잔존 없음 |
| STR-08 | 부분 취소 | 8명 중 3명만 완료 후 취소 | 완료 3명 결과 유지, 나머지 5명 idle |

### ERR — 에러 핸들링 (10건)

| ID | 시나리오 | 입력 | 기대 결과 |
|----|---------|------|-----------|
| ERR-01 | 1명 API timeout | timeout 1명 + 정상 7명 | 해당 카드 error, 나머지 7명 정상 |
| ERR-02 | 1명 인증 실패 (401) | 잘못된 키 1명 | 해당 카드 error (retryable: false), 전체 abort 없음 |
| ERR-03 | 1명 서버 에러 (500) | 서버 에러 1명 | 해당 카드 error + retry 버튼, 독립 재시도 |
| ERR-04 | rate limit (429) | 429 응답 | 해당 카드 error (retryable: true) + 자동 retry (backoff) |
| ERR-05 | 전체 네트워크 단절 | 네트워크 끊김 | 각 카드 독립 error, 전체 재시도 옵션 |
| ERR-06 | 키 없이 요청 | API 키 미설정 상태에서 시작 | 입력 프롬프트 표시, 요청 전 차단 |
| ERR-07 | 키 업데이트 중 동시 요청 | 키 변경 중 회의 시작 | 경쟁 조건 없음 (큐 또는 lock) |
| ERR-08 | Markdown 저장 파일시스템 에러 | 읽기전용 경로에 저장 시도 | 에러 메시지 표시, 데이터 유실 없음 |
| ERR-09 | AgentCard retry 상태 격리 | 1명 retry 중 다른 카드 확인 | 다른 카드 상태 변화 없음 |
| ERR-10 | max retry 초과 | 3회 retry 후에도 실패 | error 상태 고정, retry 버튼 비활성화, "최대 재시도 초과" 메시지 |

---

## 3. 릴리즈 체크리스트 (.vsix 패키징 전)

### CRITICAL — 자동화 테스트 통과 필수 (1개라도 FAIL → 블로킹)

```
[ ] SEC-01~03 — Webview API 키 미노출
[ ] STR-01 — 8명 seq 연속성
[ ] STR-03 — 초당 30+ 메시지 유실 0건
[ ] ERR-01~03 — 부분 실패 격리
[ ] DoD #5 — AbortController 취소 정상
```

### HIGH — 수동 검증 필수

```
[ ] Anthropic 실 키로 end-to-end 회의 정상 동작
[ ] 취소 시 API 추가 과금 없음 확인
[ ] Markdown 복사: raw Markdown 일치
[ ] Markdown 저장: UTF-8, 파일명 형식, 덮어쓰기 confirm
[ ] 키 없는 상태 → 입력 프롬프트 정상
[ ] VS Code 1.85 + 최신 버전 2종 환경 실행
[ ] Windows / macOS 양쪽 SecretStorage 동작
```

### MEDIUM — 회귀 확인

```
[ ] Extension activate/deactivate 3회 반복 → 메모리 누수 없음
[ ] Webview reload 후 상태 복원
[ ] 다른 Extension과 postMessage 네임스페이스 충돌 없음
[ ] .vsix 파일 크기 10MB 이하
[ ] package.json engines.vscode 필드 정확성
```

### 패키징 직전 최종

```
[ ] 소스맵 프로덕션 빌드 미포함
[ ] console.log / 디버그 출력 제거
[ ] API 키 하드코딩 전수 검색 (grep "sk-ant-" "sk-proj-" "AIza")
[ ] CHANGELOG 업데이트
[ ] README 마켓플레이스 설명
```

---

## 4. QA 공수 산정

| 구분 | 항목 | 예상 공수 |
|------|------|-----------|
| 자동화 테스트 작성 | SEC 7건 + STR 8건 + ERR 10건 | 4~5일 |
| 수동 검증 | Provider × 환경 | 1.5일 |
| 릴리즈 체크리스트 실행 | — | 0.5일 |
| 회귀 테스트 (버그 수정 후) | 예비 | 1일 |
| **합계** | | **7~8일** |
