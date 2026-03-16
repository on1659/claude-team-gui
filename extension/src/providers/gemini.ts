import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  LLMProvider,
  LLMModel,
  LLMMessage,
  LLMRequestOptions,
  LLMStreamEvent,
  StopReason,
} from '../types/llm';

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string | null = null;

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client = new GoogleGenerativeAI(apiKey);
  }

  getModels(): LLMModel[] {
    return [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'high', inputCostPer1M: 1.25, outputCostPer1M: 10, contextWindow: 1000000, maxOutputTokens: 8192 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tier: 'medium', inputCostPer1M: 0.075, outputCostPer1M: 0.3, contextWindow: 1000000, maxOutputTokens: 8192 },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', tier: 'low', inputCostPer1M: 0.0375, outputCostPer1M: 0.15, contextWindow: 100000, maxOutputTokens: 8192 },
    ];
  }

  async *streamMessage(
    model: string,
    messages: LLMMessage[],
    options?: LLMRequestOptions,
  ): AsyncGenerator<LLMStreamEvent> {
    if (!this.client) throw new Error('API key not set');

    try {
      // Build model config with optional system instruction
      const modelConfig: Record<string, unknown> = { model };
      if (options?.system) {
        modelConfig.systemInstruction = options.system;
      }

      const generativeModel = this.client.getGenerativeModel(
        modelConfig as any,
        {
          apiVersion: 'v1beta',
        },
      );

      // Convert LLMMessages to Gemini format
      // Gemini uses role 'model' instead of 'assistant'
      // Gemini uses parts: [{ text }] instead of content: string
      const geminiHistory = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: typeof m.content === 'string'
          ? [{ text: m.content }]
          : m.content.map((b) => {
              if (b.type === 'text') return { text: b.text };
              throw new Error('Unsupported content block type');
            }),
      }));

      // The last message must be a user message for sendMessageStream
      // History = all messages except the last one
      const lastMessage = geminiHistory.pop();
      if (!lastMessage || lastMessage.role !== 'user') {
        yield {
          type: 'error',
          code: 'invalid_request',
          message: 'Last message must be a user message',
          retryable: false,
        };
        return;
      }

      const chat = generativeModel.startChat({
        history: geminiHistory,
        generationConfig: {
          maxOutputTokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature,
        },
      });

      const result = await chat.sendMessageStream(lastMessage.parts);

      for await (const chunk of result.stream) {
        // Check abort signal between chunks
        if (options?.signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const text = chunk.text();
        if (text) {
          yield { type: 'delta', chunk: text };
        }
      }

      // After stream completes, get final response for usage metadata
      const response = await result.response;
      const usage = response.usageMetadata;
      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      yield {
        type: 'done',
        stopReason: mapFinishReason(finishReason),
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        },
      };
    } catch (err: any) {
      // AbortError → throw (not yield), matching Anthropic pattern
      if (err.name === 'AbortError') throw err;

      const statusCode = extractStatusCode(err);
      const retryable = [429, 500, 502, 503].includes(statusCode);
      const code = statusCode ? `http_${statusCode}` : 'stream_error';
      yield {
        type: 'error',
        code,
        message: err.message ?? String(err),
        retryable,
      };
    }
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const tempClient = new GoogleGenerativeAI(apiKey);
      const model = tempClient.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
      await model.generateContent('ping');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Map Gemini finishReason to our StopReason type
 * Gemini reasons: STOP, MAX_TOKENS, SAFETY, RECITATION, OTHER
 */
function mapFinishReason(reason: string | undefined): StopReason {
  switch (reason) {
    case 'STOP':
      return 'end_turn';
    case 'MAX_TOKENS':
      return 'max_tokens';
    case 'SAFETY':
    case 'RECITATION':
    case 'OTHER':
      return 'end_turn';
    default:
      return null;
  }
}

/**
 * Extract HTTP status code from Gemini SDK errors.
 * GoogleGenerativeAIError may include status in message like "[404 Not Found]"
 * or have a status property.
 */
function extractStatusCode(err: any): number {
  // Check for direct status property
  if (typeof err.status === 'number') return err.status;
  if (typeof err.httpErrorCode === 'number') return err.httpErrorCode;

  // GoogleGenerativeAIError often embeds status in error message
  // e.g., "[429 Too Many Requests]" or "[500 Internal Server Error]"
  const match = err.message?.match(/\[(\d{3})\s/);
  if (match) return parseInt(match[1], 10);

  return 0;
}
