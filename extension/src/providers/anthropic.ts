import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  LLMModel,
  LLMMessage,
  LLMRequestOptions,
  LLMStreamEvent,
  StopReason,
} from '../types/llm';

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  private client: Anthropic | null = null;

  setApiKey(apiKey: string): void {
    this.client = new Anthropic({ apiKey });
  }

  /** Set OAuth token from Claude Code credentials */
  setAuthToken(token: string): void {
    this.client = new Anthropic({ authToken: token });
  }

  getModels(): LLMModel[] {
    return [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', tier: 'high', inputCostPer1M: 15, outputCostPer1M: 75, contextWindow: 200000, maxOutputTokens: 4096 },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', tier: 'medium', inputCostPer1M: 3, outputCostPer1M: 15, contextWindow: 200000, maxOutputTokens: 4096 },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', tier: 'low', inputCostPer1M: 0.8, outputCostPer1M: 4, contextWindow: 200000, maxOutputTokens: 4096 },
    ];
  }

  async *streamMessage(
    model: string,
    messages: LLMMessage[],
    options?: LLMRequestOptions,
  ): AsyncGenerator<LLMStreamEvent> {
    if (!this.client) throw new Error('API key not set — call setApiKey() or setAuthToken() first');


    let stream: ReturnType<typeof this.client.messages.stream>;

    try {
      stream = this.client.messages.stream({
        model,
        max_tokens: options?.maxTokens ?? 2048,
        system: options?.system,
        messages: messages.map(m => ({
          role: m.role,
          content:
            typeof m.content === 'string'
              ? m.content
              : m.content.map(b => {
                  if (b.type === 'text') return { type: 'text' as const, text: b.text };
                  throw new Error('Unsupported content block type');
                }),
        })),
      });
    } catch (err: any) {
      console.error(`[Anthropic] Stream creation failed:`, err.message, err.status);
      yield { type: 'error', code: 'request_failed', message: err.message, retryable: false };
      return;
    }

    if (options?.signal) {
      options.signal.addEventListener('abort', () => stream.abort(), { once: true });
    }

    try {
      for await (const event of stream) {
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
      if (err.name === 'AbortError') throw err;

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
