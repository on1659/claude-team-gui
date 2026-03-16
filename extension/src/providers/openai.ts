import OpenAI from 'openai';
import type {
  LLMProvider,
  LLMModel,
  LLMMessage,
  LLMRequestOptions,
  LLMStreamEvent,
  StopReason,
} from '../types/llm';

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  private client: OpenAI | null = null;

  setApiKey(apiKey: string): void {
    this.client = new OpenAI({ apiKey });
  }

  getModels(): LLMModel[] {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', tier: 'high', inputCostPer1M: 5, outputCostPer1M: 15, contextWindow: 128000, maxOutputTokens: 4096 },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', tier: 'medium', inputCostPer1M: 0.15, outputCostPer1M: 0.6, contextWindow: 128000, maxOutputTokens: 4096 },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', tier: 'low', inputCostPer1M: 0.4, outputCostPer1M: 1.6, contextWindow: 1000000, maxOutputTokens: 4096 },
    ];
  }

  async *streamMessage(
    model: string,
    messages: LLMMessage[],
    options?: LLMRequestOptions,
  ): AsyncGenerator<LLMStreamEvent> {
    if (!this.client) throw new Error('API key not set');

    // Build OpenAI message array
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [];

    // Prepend system message if provided
    if (options?.system) {
      openaiMessages.push({ role: 'system', content: options.system });
    }

    // Convert LLMMessage[] to OpenAI format
    for (const m of messages) {
      const content =
        typeof m.content === 'string'
          ? m.content
          : m.content.map(b => {
              if (b.type === 'text') return { type: 'text' as const, text: b.text };
              throw new Error('Unsupported content block type');
            });

      openaiMessages.push({
        role: m.role,
        content,
      } as OpenAI.ChatCompletionMessageParam);
    }

    let response: AsyncIterable<OpenAI.ChatCompletionChunk>;

    try {
      response = await this.client.chat.completions.create({
        model,
        messages: openaiMessages,
        max_tokens: options?.maxTokens ?? 2048,
        temperature: options?.temperature,
        stream: true,
        stream_options: { include_usage: true },
      });
    } catch (err: any) {
      yield { type: 'error', code: 'request_failed', message: err.message, retryable: false };
      return;
    }

    // Handle abort signal
    if (options?.signal) {
      options.signal.addEventListener(
        'abort',
        () => {
          // The OpenAI stream returned by create() with stream:true is an
          // async iterator backed by an AbortableAsyncIterable — calling
          // controller.abort() on the underlying request will cause the
          // iterator to throw, which we catch below.
          if ('controller' in (response as any) && typeof (response as any).controller?.abort === 'function') {
            (response as any).controller.abort();
          }
        },
        { once: true },
      );
    }

    let finishReason: string | null = null;
    let usage: { inputTokens: number; outputTokens: number } | null = null;

    try {
      for await (const chunk of response) {
        if (options?.signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const choice = chunk.choices[0];

        if (choice?.delta?.content) {
          yield { type: 'delta', chunk: choice.delta.content };
        }

        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }

        // stream_options: { include_usage: true } delivers usage in the
        // final chunk (choices is empty, usage is populated)
        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          };
        }
      }

      // Map OpenAI finish_reason to our StopReason
      let stopReason: StopReason;
      switch (finishReason) {
        case 'stop':
          stopReason = 'end_turn';
          break;
        case 'length':
          stopReason = 'max_tokens';
          break;
        case 'tool_calls':
        case 'function_call':
          stopReason = 'tool_use';
          break;
        default:
          stopReason = null;
          break;
      }

      yield {
        type: 'done',
        stopReason,
        usage: usage ?? { inputTokens: 0, outputTokens: 0 },
      };
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;

      const status = err.status ?? err.statusCode ?? 0;
      const retryable = [429, 500, 502, 503].includes(status);
      const code = status ? `http_${status}` : 'stream_error';
      yield { type: 'error', code, message: err.message, retryable };
    }
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const client = new OpenAI({ apiKey });
      await client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
