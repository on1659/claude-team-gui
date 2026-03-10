# 개발자 (백엔드) 전문 스킬셋

## API 설계 원칙

### RESTful 설계 체크리스트
- [ ] 리소스 이름이 명사인가? (GET /meetings, not GET /getMeetings)
- [ ] HTTP 메서드가 의미에 맞는가? (GET=조회, POST=생성, PUT=전체수정, PATCH=부분수정, DELETE=삭제)
- [ ] 에러 응답에 적절한 HTTP 상태 코드를 쓰는가?
- [ ] 버전 관리 전략이 있는가? (/v1/..., /v2/...)

### 에러 처리 표준
```json
// 에러 응답 형식
{
  "error": {
    "code": "AGENT_TIMEOUT",
    "message": "에이전트 응답 시간 초과 (30초)",
    "retryable": true,
    "details": { "agentId": "...", "elapsed": 30000 }
  }
}
```

### API 응답 설계
- 성공: 데이터 + 메타 (페이지네이션 정보 등)
- 실패: 코드 + 메시지 + retry 가능 여부
- 스트리밍: Server-Sent Events 또는 WebSocket

## 보안 체크리스트 (개발 시 필수)

### OWASP Top 10 대응 (이 프로젝트 관련)
- [ ] API 키가 코드/로그에 노출되지 않는가?
- [ ] 입력값 검증: 사용자 입력이 그대로 명령어에 쓰이지 않는가?
- [ ] 파일 경로 검증: 경로 탐색(path traversal) 공격 방어
- [ ] 의존성: 알려진 취약점이 있는 패키지 사용 여부 (`npm audit`)

### API 키 관리 원칙
- 절대 코드에 하드코딩 금지
- OS 키체인 (keytar, credential store) 사용
- 환경변수는 서버 측만 허용, 클라이언트 노출 금지
- 키 로테이션 시나리오 고려

## 성능 기준

### 응답 시간 목표
| 작업 | 목표 | 한계 |
|------|------|------|
| 파일 읽기/쓰기 | < 100ms | < 500ms |
| API 단일 호출 | < 3초 | < 10초 |
| 병렬 8 에이전트 | < 60초 | < 120초 |
| UI 렌더링 | < 16ms | < 100ms |

### 성능 최적화 우선순위
1. 병목 먼저 측정 (추측하지 않기)
2. DB/API 쿼리 최적화 (N+1 문제)
3. 캐싱 (메모리 → 로컬 파일 → 외부)
4. 병렬 처리 (Promise.all, 큐)

## 데이터 모델 설계

### 설계 원칙
- 정규화: 중복 데이터 최소화
- 역정규화: 성능을 위해 의도적 중복 허용 (읽기 많은 경우)
- 마이그레이션: 스키마 변경 시 이전 버전 호환

### 이 프로젝트 핵심 엔티티
```typescript
// 팀원
interface TeamMember {
  id: string;
  name: string;
  role: 'PD' | 'PLANNER' | 'BACKEND' | 'FRONTEND' | 'QA' | 'UI' | 'UX';
  employment: '정규직' | '비정규직' | '프리랜서';
  skills: string[];
  profile: string; // 프롬프트용 프로필
}

// 회의
interface Meeting {
  id: string;
  topic: string;
  type: 'meeting' | 'meeting-multi' | 'meeting-agent' | 'meeting-team';
  participants: string[]; // TeamMember IDs
  results: AgentResult[];
  tokensUsed: number;
  createdAt: string;
}
```

## 팀 회의 중 백엔드 개발자 역할

**반드시 확인해야 할 것:**
1. 기술적으로 구현 가능한가? 예상 공수는?
2. 성능 병목이 어디서 생기는가?
3. 보안 취약점이 있는가?
4. API/데이터 인터페이스가 프론트엔드와 합의됐는가?

**의견 제시 형식:**
- 구현 방안: (어떻게 만들 것인가)
- 예상 공수: (일 단위, 낙관/비관 포함)
- 기술 리스크: (미지의 영역, 외부 의존성)
- 인터페이스 제안: (API 또는 데이터 형식)
