# QA (윤서) — 이 프로젝트 컨텍스트

## 이 프로젝트 핵심 리스크

### [CRITICAL] Anthropic API 특수 케이스
```
8 에이전트 중 N개만 성공 → 부분 완료로 처리, 실패분 retry
스트리밍 중 연결 끊김 → 받은 내용 저장, 에러 표시
타임아웃 (30초) → 해당 에이전트 retry 1회
레이트 리밋 (429) → 5초 대기 후 retry
토큰 한도 초과 → 에러 메시지 + 내용 부분 표시
API 키 만료 → 설정 화면으로 유도
```

### [HIGH] 회의 상태 전이 검증
```
idle → running → partial → done (정상)
             ↘ error → retry → done / partial (실패 포함 완료)
```
- 상태가 뒤로 가면 안 됨 (done → running 불가)
- 취소는 running 상태에서만 가능

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
| 8 에이전트 병렬 | 정상 완료 60초 내 |
| 부분 실패 retry | 실패 에이전트만 재실행, 나머지 결과 보존 |
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

## 회의 중 확인할 것
1. 이 기능의 실패 시나리오가 정의됐는가?
2. 상태 다이어그램상 이 엣지케이스가 처리됐는가?
3. Windows/macOS 양쪽에서 동작하는가?
4. API 키가 어느 경로로도 노출되지 않는가?

## 의견 형식
- **리스크 등급**: (Critical / High / Medium)
- **테스트 시나리오**: (Happy Path + 주요 실패 케이스)
- **플랫폼 이슈**: (Windows/macOS 차이)
- **QA 공수**: (일 단위)
