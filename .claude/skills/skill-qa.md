# QA (윤서) — 이 프로젝트 컨텍스트

## 이 프로젝트 핵심 리스크

### [CRITICAL] Anthropic API 특수 케이스
```
8 에이전트 중 N개만 성공 → 부분 완료로 처리, 실패분 retry
스트리밍 중 연결 끊김 → NetworkError → 전체 중단 + 자동 재연결 대기 (retry 없음)
타임아웃 (30초) → 해당 에이전트 retry 최대 3회 (2초 간격)
레이트 리밋 (429) → exponential backoff (5→10→20초, 최대 3회)
토큰 한도 초과 → 에러 메시지 + 내용 부분 표시
API 키 만료 → 설정 화면으로 유도
```

### [HIGH] 회의 상태 전이 검증

두 가지 상태 기계를 구분하여 검증:

```
Meeting.status (전체 회의):
  idle → running → partial → done (정상)
               ↘ error (전체 실패)
  - 상태가 뒤로 가면 안 됨 (done → running 불가)
  - 취소는 running 상태에서만 가능

AgentCard status (개별 카드):
  idle → selected → running → done (정상)
                           ↘ error → running (retry 허용)
  - error → running 전이는 retry 시 발생 (최대 3회)
  - 에이전트 1개 error여도 Meeting은 running 유지 (다른 에이전트 진행 중)
```

### [HIGH] 플랫폼 호환성
- Windows, macOS 양쪽에서 keytar 동작 확인
- 파일 경로 구분자 (Windows `\` vs macOS `/`)
- Electron 패키징 후 경로 변경 여부

### [MEDIUM] 데이터 정합성
- profiles.json 파싱 실패 시 앱 크래시 방지
- JSON 스키마 버전 불일치 (마이그레이션 후)
- 동시에 profiles.json R/W가 발생하는 경우 (race condition)

## 성능 검증 기준
| 항목 | 통과 기준 |
|------|---------|
| 8 에이전트 병렬 | 목표 60초 내, 120초 초과 시 전체 타임아웃 |
| 부분 실패 retry | 실패 에이전트만 재실행 (최대 3회), 나머지 결과 보존 |
| API 키 노출 | 로그, UI, DevTools 어디에도 없음 |
| 10회 연속 실행 | 오류율 < 5% |
| Windows/macOS | 동일 결과 |

## 회의 방식별 테스트 포인트
```
meeting-team (주요):
  - 8 에이전트 병렬 실행 + 스트리밍
  - 카드별 독립 상태 업데이트
  - 전체 완료 후 요약 패널 렌더링

meeting-multi:
  - 순차 실행 (앞 결과가 다음에 전달되는가)

meeting / meeting-agent:
  - 단순 실행 확인
```

## 상태 다이어그램 기반 테스트 시나리오
1. Happy Path: 8명 전원 성공
2. 부분 실패: 3명 실패 → retry → 일부 성공
3. 전체 실패: 8명 전부 타임아웃
4. 취소: 실행 중 취소 → 상태 초기화
5. API 키 없음: 실행 전 차단

## 테스트 자동화 전략

```
자동화 대상 (반복 실행 필요):
  - profiles.json 파싱 (정상/비정상/빈 파일/대용량)
  - IPC 채널 요청-응답 (타입 검증)
  - 카드 상태 전이 (5가지 × 전이 경로)
  - 에러 클래스 직렬화/역직렬화
  - 키체인 CRUD (mock 기반)

수동 테스트 (자동화 어려움):
  - 8 에이전트 실시간 스트리밍 UI
  - 다크모드 전환 시 깨짐
  - Electron 패키징 후 동작
  - 실제 Anthropic API 응답
  - Windows/macOS 키체인 통합

도구:
  - 유닛: Vitest
  - 컴포넌트: React Testing Library + Vitest
  - E2E: Playwright (Electron 지원)
  - API Mock: MSW (Anthropic API 응답 시뮬레이션)
```

---

## 테스트 데이터 관리

```
fixtures/:
  profiles-valid.json       — 정상 8명 프로필
  profiles-empty.json       — 빈 배열 []
  profiles-malformed.json   — JSON 파싱 에러 유발
  profiles-missing-field.json — 필수 필드 누락
  profiles-extra-field.json — 미지 필드 포함 (하위호환 테스트)
  api-response-success.json — Anthropic API 정상 응답
  api-response-timeout.json — 타임아웃 시뮬레이션
  api-response-429.json     — Rate Limit 응답

원칙:
  - 테스트 데이터는 fixtures/ 폴더에 격리
  - 실제 API 키는 테스트 데이터에 절대 포함 금지
  - 각 시나리오별 최소 1개 fixture 유지
```

---

## 확장 테스트 시나리오 (10개)

```
 1. Happy Path: 8명 전원 성공, 60초 내 완료
 2. 부분 실패: 3명 실패 → retry → 2명 성공, 1명 재실패
 3. 전체 실패: 8명 전부 타임아웃 → 에러 UI + 전체 재시도 버튼
 4. 취소: 실행 중(4/8 완료) 취소 → 완료된 4명 결과 보존 + "일부 완료" 상태
 5. API 키 없음: 실행 전 차단 → 설정 화면 유도
 6. API 키 만료(401): 실행 중 인증 실패 → 즉시 중단 + 설정 화면 유도
 7. Rate Limit 연쇄: 8명 동시 → 429 → exponential backoff → 순차 재시도
 8. 네트워크 끊김: 스트리밍 중 연결 끊김 → 받은 내용 보존 + 에러 표시
 9. 초대형 응답: 에이전트 1명이 토큰 한도 근접 응답 → max-height 처리
10. 빈 프로필: profiles.json이 빈 배열 → 팀원 0명 빈 상태 UI
```

---

## 회의 중 확인할 것
1. 이 기능의 실패 시나리오가 정의됐는가?
2. 상태 다이어그램상 이 엣지케이스가 처리됐는가?
3. Windows/macOS 양쪽에서 동작하는가?
4. API 키가 어느 경로로도 노출되지 않는가?
5. 테스트 자동화 대상인가, 수동 테스트 대상인가?
6. 이 변경으로 기존 테스트가 깨지는가? (회귀 범위)
7. 해당 fixture 데이터가 존재하는가?

## 의견 형식
- **리스크 등급**: (Critical / High / Medium)
- **테스트 시나리오**: (Happy Path + 주요 실패 케이스)
- **자동화 여부**: (자동 / 수동 / 혼합)
- **플랫폼 이슈**: (Windows/macOS 차이)
- **회귀 범위**: (영향받는 기존 기능)
- **QA 공수**: (일 단위)
