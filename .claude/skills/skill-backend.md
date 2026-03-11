# 개발자① BE (태준) — 이 프로젝트 컨텍스트

## 확정된 기술 스택
- **프레임워크**: Electron (메인 프로세스 = Node.js)
- **API**: Anthropic SDK 직접 호출 (`@anthropic-ai/sdk`)
- **API 키**: OS 키체인 (`keytar`) — 렌더러 노출 절대 금지
- **데이터**: profiles.json (meeting-team-profiles.md → JSON 마이그레이션)
- **병렬 실행**: `Promise.all` (8 에이전트 동시)

## 핵심 아키텍처 패턴

### Electron IPC 구조
```
Renderer (React) → ipcRenderer.invoke → Main Process → Anthropic API
                                      → 파일 시스템 (profiles.json)
                                      → 키체인 (API Key)
```

### 에러 응답 형식 (통일)
```typescript
interface AgentResult {
  memberId: string;
  status: 'success' | 'error' | 'timeout';
  content?: string;
  error?: { code: string; retryable: boolean };
  tokensUsed?: number;
}
```

## 데이터 모델 (이 프로젝트)
```typescript
interface TeamMember {
  id: string;
  name: string;
  role: 'PD' | 'PLANNER_RESEARCH' | 'PLANNER_STRATEGY' | 'BACKEND' | 'FRONTEND' | 'QA' | 'UI' | 'UX';
  employment: '정규직' | '비정규직' | '프리랜서';
  profile: string;       // 프롬프트용 프로필 전문
  skillFile?: string;    // 스킬 파일 경로
}

interface Meeting {
  id: string;
  topic: string;
  type: 'meeting' | 'meeting-multi' | 'meeting-agent' | 'meeting-team';
  participantIds: string[];
  results: AgentResult[];
  totalTokens: number;
  status: 'idle' | 'running' | 'partial' | 'done' | 'error';
  createdAt: string;
}
```

## 성능 목표 (이 프로젝트)
| 작업 | 목표 | 한계 |
|------|------|------|
| profiles.json 읽기 | < 100ms | — |
| API 단일 에이전트 | < 30초 | → timeout + retry |
| 8 에이전트 병렬 | < 60초 | < 120초 |

## Anthropic API 특수 케이스 처리
```
- 429 (레이트 리밋): 5초 대기 후 retry
- 타임아웃 (30초): 해당 에이전트만 retry 1회
- 부분 실패 (N/8 성공): 실패한 에이전트만 재시도, 나머지는 표시
- 스트리밍 중단: 받은 내용까지 저장 후 에러 표시
```

## API 키 관리 (keytar)
```typescript
// 저장
await keytar.setPassword('claude-team-gui', 'anthropic-api-key', apiKey);
// 조회
const apiKey = await keytar.getPassword('claude-team-gui', 'anthropic-api-key');
// 렌더러에는 절대 전달하지 않음 — 메인 프로세스에서만 사용
```

## 회의 중 확인할 것
1. Electron 메인 프로세스에서 처리해야 하는가, 렌더러에서 가능한가?
2. 병렬 에이전트 실패 시 어떻게 처리하는가?
3. API 키가 어떤 경로로도 노출되지 않는가?
4. 프론트엔드가 필요한 인터페이스가 정의됐는가?

## 의견 형식
- **구현 방안**: (메인/렌더러 어디서, 어떻게)
- **예상 공수**: (일 단위)
- **리스크**: (Anthropic API 제약, Electron IPC 주의점)
- **인터페이스**: (렌더러에 노출할 API 형태)
