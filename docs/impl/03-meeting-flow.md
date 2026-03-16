# 03. 회의 실행 흐름 — 상태머신, 디바운스, 취소

> CRITICAL #1 (디바운스), #2 (낙관적 UI), HIGH #8 (상태머신), #9 (취소), #10 (비용 보정), MEDIUM #13 (seq) 해결

---

## 1. 회의 모드

| 모드 | 내부명 | API 호출 | 비용 | 용도 |
|------|--------|----------|------|------|
| **빠른 회의** | `quick` | 1회 (medium tier 모델) | ~$0.001~0.07 | 방향 체크, 빠른 피드백 |
| **심층 회의** | `deep` | N회 병렬 (팀원별 tier) | ~$0.012~0.19 | 아키텍처 결정, 구현 계획 |

---

## 2. 전체 실행 흐름

### 2.1 빠른 회의 (quick)

```
[Sidebar Webview]
  사용자: 주제 입력 + 팀원 선택 + "빠른 회의" 모드
  클릭: ▶ 회의 시작
    │
    ├── [즉시] 버튼 비활성화 + "연결 중..." 표시
    ├── postMessage → { type: 'startMeeting', mode: 'quick', ... }
    │
[Extension Host]
    ├── MeetingService.startMeeting()
    │   ├── meetingId = UUID 생성
    │   ├── AbortController 생성 → controllers.set(meetingId, controller)
    │   ├── postToWebview → { type: 'meetingStarted', meetingId, participants }
    │   │
    │   ├── system prompt 생성 (8명 역할 주입)
    │   ├── provider.streamMessage(medium_model, messages, { system, signal })
    │   │
    │   ├── for await (event of stream)
    │   │   ├── delta → 역할별 파싱 → agentId 할당
    │   │   │   └── postToWebview → { type: 'agentStream', agentId, seq, chunk }
    │   │   ├── done → 각 역할별 agentDone 생성
    │   │   └── error → agentError
    │   │
    │   └── postToWebview → { type: 'meetingDone', summary }
    │
[Panel Webview]
    ├── meetingStarted → 패널 탭 열림, AgentCard idle 렌더
    ├── agentStream → 해당 AgentCard streaming 전환, chunk 표시
    ├── agentDone → 해당 AgentCard done 전환
    └── meetingDone → SummaryView 표시, ActionBar 활성화
```

### 2.2 심층 회의 (deep)

```
[Extension Host]
    ├── MeetingService.startMeeting()
    │   ├── meetingId = UUID, AbortController 생성
    │   ├── postToWebview → { type: 'meetingStarted', meetingId, participants }
    │   │
    │   ├── 참여자별 병렬 실행 (200ms stagger)
    │   │   participants.map((member, idx) =>
    │   │     delay(idx * 200).then(() =>
    │   │       runSingleAgent(member, topic, signal)
    │   │     )
    │   │   )
    │   │
    │   ├── Promise.allSettled(tasks)
    │   │   ├── fulfilled → agentDone
    │   │   └── rejected → agentError (retryable 판단)
    │   │
    │   └── postToWebview → { type: 'meetingDone', summary }
```

**stagger 200ms 근거**: Anthropic API rate limit 60 req/min → 8명 × 200ms = 1.6초 간격 → 충분

---

## 3. 디바운스 전략 (이슈 #1 해결)

### 확정: Host raw 전송 + Webview requestAnimationFrame

3종 회의에서 "Host 50ms + Webview 100ms 이중 디바운스"가 합의되었으나, 팀 회의 검토 결과 150ms 지연이 체감 성능을 저하시킬 수 있어 다음으로 확정:

```
Extension Host                      Panel Webview
──────────────────────              ──────────────────────────────
agentStream chunk 발생               onMessage 수신
→ 즉시 postMessage 전송              → pendingChunks Map에 추가
  (배치 없음, raw 전송)                → requestAnimationFrame 예약
                                     → 다음 프레임(~16ms)에 일괄 flush
                                       - seq 순 정렬
                                       - batch setState
```

**Webview 측 구현**:

```typescript
// hooks/useChunkBuffer.ts
const pendingChunks = useRef<Map<string, { seq: number; text: string }[]>>(new Map());
const flushRef = useRef<number | null>(null);

function handleAgentStream(agentId: string, seq: number, chunk: string) {
  const q = pendingChunks.current.get(agentId) ?? [];
  q.push({ seq, text: chunk });
  pendingChunks.current.set(agentId, q);

  if (flushRef.current !== null) cancelAnimationFrame(flushRef.current);
  flushRef.current = requestAnimationFrame(() => {
    // seq 순 정렬 후 batch dispatch
    for (const [id, chunks] of pendingChunks.current) {
      chunks.sort((a, b) => a.seq - b.seq);
      const text = chunks.map(c => c.text).join('');
      dispatch({ type: 'APPEND_CHUNK', agentId: id, text, lastSeq: chunks.at(-1)!.seq });
    }
    pendingChunks.current.clear();
    flushRef.current = null;
  });
}
```

**왜 이 방식인가**:
- Host 배치 제거 → 첫 chunk 지연 0ms (낙관적 UI 체감 개선)
- rAF 기반 → 정확히 렌더 주기(~16ms)에 맞춤, 불필요한 리렌더 방지
- seq 정렬 → 순서 보장
- batch dispatch → React 18 자동 배칭과 결합

---

## 4. 낙관적 UI (이슈 #2 해결)

### 3단계 전이

```
[0ms]  사용자 클릭
  ├── 버튼: "▶ 회의 시작" → "⏳ 연결 중..." (즉시, disabled)
  ├── 사이드바: 선택된 팀원 카드 하이라이트 유지
  └── 패널: 탭 열림 요청 (Host에 meetingStarted 전)
        → AgentCard 전원 idle 상태로 즉시 렌더
        → "회의를 준비하고 있습니다..." 메시지

[~50-200ms]  meetingStarted 수신 (Host ACK)
  ├── 진행률 바 0% 표시
  └── 비용 표시 영역 활성화

[~1-3s]  첫 agentStream 수신 (각 에이전트별)
  ├── 해당 AgentCard: idle → streaming 전환
  ├── 아바타 talk 애니메이션 시작
  └── 커서 블링크 + 텍스트 스트리밍

[완료]  agentDone 수신
  ├── 해당 AgentCard: streaming → done 전환
  ├── 아바타 체크마크 오버레이
  ├── 진행률 바 업데이트
  └── 토큰/시간 표시
```

**핵심**: 사용자 클릭 → 시각 피드백까지 0ms. Host 응답을 기다리지 않고 UI를 먼저 전환.

```typescript
// MeetingConfig.tsx (Sidebar Webview)
function handleStartMeeting() {
  // 1. 즉시 — Host 응답 전
  setButtonState('loading');

  // 2. Panel에 낙관적 렌더 요청 (Sidebar → Host → Panel)
  vscodeApi.postMessage({
    type: 'startMeeting',
    topic,
    participants: selectedMembers.map(m => m.id),
    mode: selectedMode,
  });
}
```

---

## 5. 에이전트 상태머신 (이슈 #8 해결)

### 상태 정의

```typescript
export type AgentStatus =
  | { type: 'idle' }
  | { type: 'selected' }              // 참여 예정 (낙관적 UI)
  | { type: 'streaming'; buffer: string; seq: number }
  | { type: 'done'; content: string; usage: TokenUsage; durationMs: number }
  | { type: 'error'; message: string; retryable: boolean; attempt: number }
  | { type: 'retrying'; attempt: number };
```

### 전이 다이어그램

```
                    ┌──────────┐
                    │   idle   │
                    └────┬─────┘
                         │ MEETING_STARTED
                    ┌────▼─────┐
                    │ selected │
                    └────┬─────┘
                         │ STREAM_START (첫 chunk 도착)
                    ┌────▼──────┐
              ┌────►│ streaming │
              │     └────┬──┬───┘
              │          │  │
              │    DONE  │  │ ERROR
              │          │  │
         STREAM_START  ┌─▼──▼──┐
              │        │  분기  │
              │        └─┬──┬──┘
              │          │  │
              │    ┌─────▼┐ ┌▼────────┐
              │    │ done │ │  error   │
              │    └──────┘ └────┬────┘
              │                  │ RETRY (retryable && attempt < max)
              │            ┌────▼─────┐
              └────────────┤ retrying │
                           └──────────┘
```

### Reducer 구현

```typescript
type AgentEvent =
  | { type: 'MEETING_STARTED' }
  | { type: 'STREAM_START' }
  | { type: 'CHUNK'; text: string; seq: number }
  | { type: 'DONE'; content: string; usage: TokenUsage; durationMs: number }
  | { type: 'ERROR'; message: string; retryable: boolean }
  | { type: 'RETRY' }
  | { type: 'CANCEL' };

function agentReducer(state: AgentStatus, event: AgentEvent): AgentStatus {
  switch (state.type) {
    case 'idle':
      if (event.type === 'MEETING_STARTED') return { type: 'selected' };
      break;
    case 'selected':
      if (event.type === 'STREAM_START') return { type: 'streaming', buffer: '', seq: 0 };
      if (event.type === 'CANCEL') return { type: 'idle' };
      break;
    case 'streaming':
      if (event.type === 'CHUNK') return { ...state, buffer: state.buffer + event.text, seq: event.seq };
      if (event.type === 'DONE') return { type: 'done', content: event.content, usage: event.usage, durationMs: event.durationMs };
      if (event.type === 'ERROR') return { type: 'error', message: event.message, retryable: event.retryable, attempt: 1 };
      if (event.type === 'CANCEL') return { type: 'idle' };
      break;
    case 'error':
      if (event.type === 'RETRY' && state.retryable) return { type: 'retrying', attempt: state.attempt };
      break;
    case 'retrying':
      if (event.type === 'STREAM_START') return { type: 'streaming', buffer: '', seq: 0 };
      if (event.type === 'ERROR') return { type: 'error', message: event.message, retryable: event.retryable, attempt: state.attempt + 1 };
      break;
  }
  return state; // 잘못된 전이 → 무시
}
```

---

## 6. 취소 경로 (이슈 #9 해결)

### AbortController 관리

```typescript
// src/services/meeting-service.ts
class MeetingService {
  private controllers = new Map<string, AbortController>();

  startMeeting(meetingId: string, config: MeetingConfig): void {
    const controller = new AbortController();
    this.controllers.set(meetingId, controller);

    this.runMeeting(meetingId, config, controller)
      .finally(() => this.controllers.delete(meetingId));
  }

  cancelMeeting(meetingId: string): void {
    const controller = this.controllers.get(meetingId);
    if (!controller) return;
    controller.abort();
    // → signal.aborted = true
    // → 연결된 모든 스트림이 AbortError throw
    // → Promise.allSettled가 rejected로 수집
    // → agentError (retryable: false) 전송
    // → meetingCancelled 전송
    this.postToPanel({ type: 'meetingCancelled', meetingId });
  }
}
```

### Provider별 signal 처리

```typescript
// providers/anthropic.ts
async *streamMessage(model, messages, options) {
  const stream = this.client.messages.stream({
    model,
    max_tokens: options?.maxTokens ?? 2048,
    system: options?.system,
    messages: this.convertMessages(messages),
    // ✅ Anthropic SDK는 AbortSignal 네이티브 지원
  });

  // signal 연결
  if (options?.signal) {
    options.signal.addEventListener('abort', () => stream.abort());
  }

  for await (const event of stream) {
    if (options?.signal?.aborted) {
      throw new DOMException('Meeting cancelled', 'AbortError');
    }
    // ... yield events
  }
}
```

### 취소 시퀀스 다이어그램

```
[Webview] "⏹ 중단" 클릭
    │
    ├── postMessage → { type: 'cancelMeeting', meetingId }
    │
[Host] cancelMeeting(meetingId)
    ├── controller.abort()
    │   ├── Agent 1: stream.abort() → AbortError throw
    │   ├── Agent 2: stream.abort() → AbortError throw
    │   └── Agent N: stream.abort() → AbortError throw
    ├── Promise.allSettled 수집
    │   ├── 이미 done인 에이전트 → 결과 유지 ✅
    │   └── 진행 중이던 에이전트 → rejected (AbortError)
    ├── postToPanel → meetingCancelled
    │
[Webview]
    ├── 완료된 AgentCard → done 상태 유지 ✅
    ├── 진행 중이던 AgentCard → idle 상태로 리셋
    ├── 버튼 → "▶ 회의 시작" 복원
    └── 진행률 바 → 숨김
```

---

## 7. seq 손실 대응 (이슈 #13 해결)

### 전략: 감지만 하고 조용히 이어붙이기

postMessage는 VS Code 내부 IPC이므로 손실 확률이 극히 낮음. 만약 발생해도:

```typescript
// Webview에서 seq 갭 감지
function handleChunk(agentId: string, seq: number, chunk: string) {
  const lastSeq = lastSeqMap.get(agentId) ?? -1;

  if (seq > lastSeq + 1) {
    // 갭 감지 — 로그만 남기고 계속 진행
    console.warn(`[seq gap] agent=${agentId} expected=${lastSeq+1} got=${seq}`);
  }

  lastSeqMap.set(agentId, seq);
  // chunk를 그대로 이어붙임 (재전송 요청 안 함)
}
```

**이유**: seq 갭이 발생한 chunk는 영구 소실. 재전송 프로토콜을 만들면 복잡도 대비 이득이 없음. 최종 결과는 `agentDone.content`에 전체 텍스트가 들어있으므로, 스트리밍 중 누락은 최종 결과에 영향 없음.

---

## 8. MeetingService 전체 구현 가이드

```typescript
class MeetingService {
  private readonly STAGGER_MS: number;  // 설정에서 로드 (기본 200)
  private readonly MAX_RETRIES: number; // 설정에서 로드 (기본 2)
  private controllers = new Map<string, AbortController>();

  constructor(
    private registry: LLMRegistry,
    private panel: PanelManager,
    private config: ConfigService
  ) {
    this.STAGGER_MS = config.get('staggerDelayMs', 200);
    this.MAX_RETRIES = config.get('maxRetries', 2);
  }

  async runMeeting(meetingId: string, config: MeetingConfig, controller: AbortController) {
    const provider = this.registry.getActive();
    const signal = controller.signal;

    if (config.mode === 'quick') {
      await this.runQuickMeeting(meetingId, config, provider, signal);
    } else {
      await this.runDeepMeeting(meetingId, config, provider, signal);
    }
  }

  private async runDeepMeeting(
    meetingId: string,
    config: MeetingConfig,
    provider: LLMProvider,
    signal: AbortSignal
  ) {
    const tasks = config.participants.map((member, idx) =>
      this.delay(idx * this.STAGGER_MS).then(() =>
        this.runSingleAgent(meetingId, member, config.topic, provider, signal)
      )
    );

    const results = await Promise.allSettled(tasks);

    if (!signal.aborted) {
      const summary = this.buildSummary(results, config);
      this.panel.post({ type: 'meetingDone', meetingId, summary });
    }
  }

  private async runSingleAgent(
    meetingId: string,
    member: TeamMember,
    topic: string,
    provider: LLMProvider,
    signal: AbortSignal
  ): Promise<AgentResult> {
    const model = this.getModelForTier(provider, member.salary);
    const system = this.buildAgentSystemPrompt(member);
    const messages: LLMMessage[] = [{ role: 'user', content: topic }];

    let seq = 0;
    let fullContent = '';
    const startTime = Date.now();

    for await (const event of provider.streamMessage(model, messages, { system, signal })) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');

      switch (event.type) {
        case 'delta':
          fullContent += event.chunk;
          this.panel.post({
            type: 'agentStream', meetingId,
            agentId: member.id, seq: seq++, chunk: event.chunk,
          });
          break;
        case 'done':
          const result: AgentResult = {
            content: fullContent,
            tokenUsage: event.usage,
            durationMs: Date.now() - startTime,
            model,
          };
          this.panel.post({ type: 'agentDone', meetingId, agentId: member.id, result });
          return result;
        case 'error':
          // retryable/code 정보를 보존하여 상위에서 agentError 메시지에 전달
          const err = new Error(event.message) as Error & { retryable: boolean; code: string };
          err.retryable = event.retryable;
          err.code = event.code;
          throw err;
      }
    }

    throw new Error('Stream ended without done event');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getModelForTier(provider: LLMProvider, tier: ModelTier): string {
    const models = provider.getModels();
    return models.find(m => m.tier === tier)?.id ?? models[0].id;
  }

  private buildAgentSystemPrompt(member: TeamMember): string {
    return `당신은 ${member.name}입니다.
역할: ${member.roleLabel}
설명: ${member.description}
판단 기준: ${member.criteria}

위 역할의 전문성과 관점에서 주어진 주제에 대해 분석하세요.
다음을 포함하세요:
1. 핵심 의견
2. 우려사항 또는 리스크
3. 제안하는 방향`;
  }
}
```
