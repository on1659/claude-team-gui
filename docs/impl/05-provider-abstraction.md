# 05. LLM Provider 추상화 — 멀티 모델 지원

> CRITICAL #4 (LLMMessage), HIGH #10 (비용 보정), MEDIUM #11 (stopReason), #12 (countTokens), #14 (모델명) 해결
> 핵심 요구: 현재 Claude만 사용, 향후 OpenAI/Gemini로 교체 가능해야 함

---

## 1. Tier 매핑 테이블

팀원의 `salary` 필드가 `ModelTier`로 매핑되고, 각 Provider가 tier에 맞는 모델을 반환:

| salary | ModelTier | Anthropic | OpenAI | Gemini |
|--------|-----------|-----------|--------|--------|
| `high` | `high` | claude-opus-4-6 | gpt-4o | gemini-2.5-pro |
| `medium` | `medium` | claude-sonnet-4-6 | gpt-4o-mini | gemini-2.0-flash |
| `low` | `low` | claude-haiku-4-5-20251001 | gpt-4.1-mini | gemini-2.0-flash-lite |

> 이슈 #14 해결: `gpt-4.1-nano` → `gpt-4.1-mini`로 수정 (존재하는 모델)

### 가격표 (2026년 기준, USD per 1M tokens)

| 모델 | 입력 | 출력 | Context Window |
|------|------|------|----------------|
| claude-opus-4-6 | $15.00 | $75.00 | 200K |
| claude-sonnet-4-6 | $3.00 | $15.00 | 200K |
| claude-haiku-4-5-20251001 | $0.80 | $4.00 | 200K |
| gpt-4o | $5.00 | $15.00 | 128K |
| gpt-4o-mini | $0.15 | $0.60 | 128K |
| gpt-4.1-mini | $0.40 | $1.60 | 1M |
| gemini-2.5-pro | $1.25 | $10.00 | 1M |
| gemini-2.0-flash | $0.075 | $0.30 | 1M |
| gemini-2.0-flash-lite | $0.0375 | $0.15 | 100K |

### Provider별 Rate Limit 참고

> 03-meeting-flow.md §2.2의 stagger 200ms는 Anthropic 기준. Provider 교체 시 stagger 값 조정 필요.

| Provider | Rate Limit (기본 Tier) | 권장 stagger | 비고 |
|----------|----------------------|-------------|------|
| Anthropic | 60 req/min | 200ms | 8명×200ms=1.6s, 충분 |
| OpenAI | 500 req/min (GPT-4o) | 100ms | 여유 있음 |
| Gemini | 360 req/min (Flash) | 100ms | 여유 있음 |

v1에서는 Anthropic 기준 200ms 고정. v2에서 Provider별 `getRecommendedStaggerMs()` 메서드 추가 검토.

---

## 2. System Prompt 처리 (Provider별)

`LLMRequestOptions.system`으로 system prompt를 받고, 각 Provider가 자기 방식으로 변환:

```typescript
// AnthropicProvider
async *streamMessage(model, messages, options) {
  const stream = this.client.messages.stream({
    model,
    max_tokens: options?.maxTokens ?? 2048,
    system: options?.system,  // ← Anthropic: 별도 필드
    messages: this.toAnthropicMessages(messages),
  });
  // ...
}

// OpenAIProvider (v2)
async *streamMessage(model, messages, options) {
  const openaiMessages = [];
  if (options?.system) {
    openaiMessages.push({ role: 'system', content: options.system }); // ← OpenAI: messages[0]
  }
  openaiMessages.push(...this.toOpenAIMessages(messages));
  const stream = await this.client.chat.completions.create({
    model, messages: openaiMessages, stream: true,
  });
  // ...
}

// GeminiProvider (v2)
async *streamMessage(model, messages, options) {
  const result = await this.model.generateContentStream({
    systemInstruction: options?.system ? { parts: [{ text: options.system }] } : undefined, // ← Gemini: 별도
    contents: this.toGeminiContents(messages),
  });
  // ...
}
```

---

## 3. countTokens (이슈 #12)

### Interface

```typescript
// LLMProvider.countTokens (optional)
countTokens?(text: string): Promise<number>;
```

### Provider별 구현

| Provider | 방식 | 정확도 |
|----------|------|--------|
| Anthropic | `POST /v1/messages/count_tokens` API | 정확 |
| OpenAI | tiktoken 로컬 라이브러리 | 정확 |
| Gemini | `countTokens()` API | 정확 |
| fallback | `Math.ceil(text.length / 4)` | 대략적 |

**v1**: fallback만 사용 (API 호출 비용 절약)
**v2**: Provider API 활용

---

## 4. 비용 추정 (이슈 #10 해결)

> **소속 모듈**: `src/services/cost-estimator.ts` — MeetingService에서 import하여 사용
> Sidebar의 CostEstimate 컴포넌트에 표시하기 위해 Host에서 계산 후 `costUpdate` 메시지로 전달

### 보정된 토큰 추정

기존 추정 `2000 + N × 500`은 과소. system prompt에 팀원 프로필(description + criteria)이 포함되면 입력 토큰이 급증.

```typescript
function estimateCost(
  participants: TeamMember[],
  mode: MeetingMode,
  provider: LLMProvider
): CostEstimate {
  const models = provider.getModels();

  if (mode === 'quick') {
    // 단일 호출 — medium tier
    const model = models.find(m => m.tier === 'medium')!;
    // 보정: 기본 프롬프트 ~1500 + 팀원 프로필 주입 ~500/명 + 주제 ~200
    const inputTokens = 1700 + participants.length * 500;
    // 출력: 팀원당 ~400 토큰 응답
    const outputTokens = participants.length * 400;
    return {
      inputTokens,
      outputTokens,
      cost: (inputTokens / 1_000_000) * model.inputCostPer1M
          + (outputTokens / 1_000_000) * model.outputCostPer1M,
    };
  }

  // deep — 팀원별 개별 호출
  let total = { inputTokens: 0, outputTokens: 0, cost: 0 };
  const breakdown: Record<string, { tokens: number; cost: number; model: string }> = {};

  for (const member of participants) {
    const model = models.find(m => m.tier === member.salary)!;
    // 보정: system prompt ~800 + 주제 ~200 + 역할 설명 ~300
    const inputTokens = 1300;
    const outputTokens = 800;
    const memberCost = (inputTokens / 1_000_000) * model.inputCostPer1M
                     + (outputTokens / 1_000_000) * model.outputCostPer1M;

    breakdown[member.id] = { tokens: inputTokens + outputTokens, cost: memberCost, model: model.id };
    total.inputTokens += inputTokens;
    total.outputTokens += outputTokens;
    total.cost += memberCost;
  }

  return { ...total, breakdown };
}
```

### 비용 비교 예시 (8명 전원 참여)

**산출 근거** (team.json 기준: high 1명 + medium 7명):

| 모드 | 계산식 | Anthropic | OpenAI | Gemini |
|------|--------|-----------|--------|--------|
| quick (medium 1회) | in=5700, out=3200 | ~$0.07 | ~$0.003 | ~$0.001 |
| deep (tier별 8회) | high×1 + medium×7, 각 in=1300 out=800 | ~$0.19 | ~$0.023 | ~$0.012 |

**deep 상세 산출**:
- **Anthropic**: Opus 1명($0.08) + Sonnet 7명($0.016×7=$0.11) = **$0.19**
- **OpenAI**: gpt-4o 1명($0.019) + gpt-4o-mini 7명($0.001×7=$0.005) = **$0.023**
- **Gemini**: gemini-2.5-pro 1명($0.010) + gemini-2.0-flash 7명($0.0003×7=$0.002) = **$0.012**

> Gemini가 가장 저렴. Provider 교체 시 비용 절감 효과가 큼.

---

## 5. LLMRegistry 구현

```typescript
// src/services/llm-registry.ts
export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();
  private activeProviderId: string = 'anthropic';

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  getActive(): LLMProvider {
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) throw new Error(`Provider not found: ${this.activeProviderId}`);
    return provider;
  }

  setActive(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    this.activeProviderId = providerId;
  }

  getAll(): LLMProvider[] {
    return [...this.providers.values()];
  }

  getProviderInfo(): ProviderInfo[] {
    return this.getAll().map(p => ({
      id: p.id,
      name: p.name,
      hasKey: false, // ConfigService에서 채워줌
      models: p.getModels().map(m => ({ id: m.id, name: m.name, tier: m.tier })),
    }));
  }
}
```

### hasKey 통합 흐름 (ConfigService → Registry → Webview)

`LLMRegistry.getProviderInfo()`는 `hasKey: false`를 기본값으로 반환합니다. 실제 키 존재 여부는 `ConfigService`가 `SecretStorage`를 조회하여 채워줍니다:

```typescript
// src/services/config-service.ts
class ConfigService {
  constructor(
    private secrets: vscode.SecretStorage,
    private registry: LLMRegistry
  ) {}

  /** Registry의 ProviderInfo에 hasKey를 채워서 반환 */
  async getProviderListForWebview(): Promise<{ providers: ProviderInfo[]; activeId: string }> {
    const infos = this.registry.getProviderInfo();
    const enriched = await Promise.all(
      infos.map(async (info) => ({
        ...info,
        hasKey: !!(await this.secrets.get(`claude-team.apiKey.${info.id}`)),
      }))
    );
    return {
      providers: enriched,
      activeId: this.registry.getActive().id,
    };
  }

  /**
   * API 키 설정 — validateKey 통과 시에만 저장 (02-extension-manifest §5 롤백 안전 요구사항)
   * 순서: validateKey → SecretStorage 저장 → Provider 주입
   * 실패 시: 기존 키 유지, 서비스 중단 없음 (DoD #7)
   */
  async setApiKey(providerId: string, apiKey: string): Promise<{ valid: boolean; error?: string }> {
    const provider = this.registry.getAll().find(p => p.id === providerId);
    if (!provider) return { valid: false, error: `Unknown provider: ${providerId}` };

    // 1. 키 유효성 검증 (실패 시 저장 안 함)
    const valid = await provider.validateKey(apiKey);
    if (!valid) return { valid: false, error: 'API key validation failed' };

    // 2. SecretStorage 저장 (실패 시 Provider 주입 안 함)
    try {
      await this.secrets.store(`claude-team.apiKey.${providerId}`, apiKey);
    } catch (err: any) {
      return { valid: false, error: `Failed to store key: ${err.message}` };
    }

    // 3. Provider에 주입 (여기까지 오면 키가 검증 + 저장 완료)
    provider.setApiKey(apiKey);
    return { valid: true };
  }
}
```

**호출 시점**:
- Extension activate → `ConfigService.getProviderListForWebview()` → Sidebar에 `providerList` 전송
- 사용자가 키 입력 → `ConfigService.setApiKey()` → `validateKey()` → 결과를 `apiKeyValidated`로 전송
- Provider 전환 → `registry.setActive()` + 해당 Provider에 저장된 키 로드

### Extension 초기화 시 등록

```typescript
// src/extension.ts
export function activate(context: vscode.ExtensionContext) {
  const registry = new LLMRegistry();

  // v1: Anthropic만 등록
  registry.register(new AnthropicProvider());

  // v2: 추가 Provider 등록
  // registry.register(new OpenAIProvider());
  // registry.register(new GeminiProvider());

  // ... 나머지 서비스 초기화
}
```

---

## 6. AnthropicProvider 구현 (v1)

```typescript
// src/providers/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  private client: Anthropic | null = null;

  setApiKey(apiKey: string): void {
    this.client = new Anthropic({ apiKey });
  }

  getModels(): LLMModel[] {
    return [
      // maxOutputTokens: 회의 응답 기준 보수적 설정. API 상 Opus/Sonnet은 8192+까지 가능하나
      // 회의 1인당 응답 ~800 토큰이므로 4096이면 충분. streamMessage의 기본 max_tokens=2048.
      { id: 'claude-opus-4-6',          name: 'Claude Opus 4.6',   tier: 'high',   inputCostPer1M: 15,   outputCostPer1M: 75,   contextWindow: 200000, maxOutputTokens: 4096 },
      { id: 'claude-sonnet-4-6',        name: 'Claude Sonnet 4.6', tier: 'medium', inputCostPer1M: 3,    outputCostPer1M: 15,   contextWindow: 200000, maxOutputTokens: 4096 },
      { id: 'claude-haiku-4-5-20251001',name: 'Claude Haiku 4.5',  tier: 'low',    inputCostPer1M: 0.8,  outputCostPer1M: 4,    contextWindow: 200000, maxOutputTokens: 4096 },
    ];
  }

  async *streamMessage(
    model: string,
    messages: LLMMessage[],
    options?: LLMRequestOptions
  ): AsyncGenerator<LLMStreamEvent> {
    if (!this.client) throw new Error('API key not set');

    let stream: ReturnType<typeof this.client.messages.stream>;

    try {
      stream = this.client.messages.stream({
        model,
        max_tokens: options?.maxTokens ?? 2048,
        system: options?.system,
        messages: messages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : m.content.map(b => {
            if (b.type === 'text') return { type: 'text' as const, text: b.text };
            throw new Error('Unsupported content block type');
          }),
        })),
      });
    } catch (err: any) {
      // 요청 생성 자체 실패 (잘못된 파라미터 등)
      yield { type: 'error', code: 'request_failed', message: err.message, retryable: false };
      return;
    }

    if (options?.signal) {
      options.signal.addEventListener('abort', () => stream.abort(), { once: true });
    }

    try {
      for await (const event of stream) {
        // 취소는 throw로 전파 (caller가 catch)
        if (options?.signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'delta', chunk: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        type: 'done',
        stopReason: finalMessage.stop_reason as StopReason,
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        },
      };
    } catch (err: any) {
      // AbortError는 그대로 throw (취소 경로)
      if (err.name === 'AbortError') throw err;

      // API 에러 → yield error event (retryable 판단)
      const retryable = [429, 500, 502, 503].includes(err.status ?? 0);
      const code = err.status ? `http_${err.status}` : 'stream_error';
      yield { type: 'error', code, message: err.message, retryable };
    }
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 7. v2 Provider Stub

> v2 stub은 `throw` 대신 `yield error`로 구현하여 Extension 크래시를 방지.
> 실수로 호출되더라도 caller의 기존 에러 처리 경로(`case 'error'`)에서 안전하게 처리됨.

```typescript
// src/providers/openai.ts
export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';

  setApiKey(_apiKey: string): void {
    // v2에서 구현: this.client = new OpenAI({ apiKey })
  }

  getModels(): LLMModel[] {
    return [
      { id: 'gpt-4o',      name: 'GPT-4o',      tier: 'high',   inputCostPer1M: 5,    outputCostPer1M: 15,   contextWindow: 128000, maxOutputTokens: 4096 },
      { id: 'gpt-4o-mini',  name: 'GPT-4o mini', tier: 'medium', inputCostPer1M: 0.15, outputCostPer1M: 0.6,  contextWindow: 128000, maxOutputTokens: 4096 },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini',tier: 'low',    inputCostPer1M: 0.4,  outputCostPer1M: 1.6,  contextWindow: 1000000,maxOutputTokens: 4096 },
    ];
  }

  async *streamMessage(
    _model: string,
    _messages: LLMMessage[],
    _options?: LLMRequestOptions
  ): AsyncGenerator<LLMStreamEvent> {
    yield { type: 'error', code: 'not_implemented', message: 'OpenAI provider not yet implemented. Coming in v2.', retryable: false };
  }

  async validateKey(_apiKey: string): Promise<boolean> {
    return false; // v2에서 구현
  }
}
```

```typescript
// src/providers/gemini.ts
export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';

  setApiKey(_apiKey: string): void {
    // v2에서 구현: this.model = genAI.getGenerativeModel(...)
  }

  getModels(): LLMModel[] {
    return [
      { id: 'gemini-2.5-pro',       name: 'Gemini 2.5 Pro',       tier: 'high',   inputCostPer1M: 1.25,   outputCostPer1M: 10,   contextWindow: 1000000, maxOutputTokens: 8192 },
      { id: 'gemini-2.0-flash',     name: 'Gemini 2.0 Flash',     tier: 'medium', inputCostPer1M: 0.075,  outputCostPer1M: 0.3,  contextWindow: 1000000, maxOutputTokens: 8192 },
      { id: 'gemini-2.0-flash-lite',name: 'Gemini 2.0 Flash Lite',tier: 'low',    inputCostPer1M: 0.0375, outputCostPer1M: 0.15, contextWindow: 100000,  maxOutputTokens: 8192 },
    ];
  }

  async *streamMessage(
    _model: string,
    _messages: LLMMessage[],
    _options?: LLMRequestOptions
  ): AsyncGenerator<LLMStreamEvent> {
    yield { type: 'error', code: 'not_implemented', message: 'Gemini provider not yet implemented. Coming in v2.', retryable: false };
  }

  async validateKey(_apiKey: string): Promise<boolean> {
    return false; // v2에서 구현
  }
}
```
