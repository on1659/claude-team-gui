/** 메시지 내 콘텐츠 블록 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; mediaType: string; data: string } };

/**
 * LLM 메시지
 * - role: 'user' | 'assistant' (system은 LLMRequestOptions.system으로 분리)
 * - content: 단순 문자열 또는 ContentBlock 배열
 *   - string: 편의용 shorthand (내부에서 [{ type: 'text', text: content }]로 변환)
 *   - ContentBlock[]: 멀티모달 지원 시 사용
 */
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

/** 스트리밍 종료 사유 */
export type StopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'tool_use'
  | null;

/** 토큰 사용량 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * 스트리밍 이벤트
 * AsyncGenerator가 순차적으로 yield
 */
export type LLMStreamEvent =
  | { type: 'delta'; chunk: string }
  | { type: 'done'; stopReason: StopReason; usage: TokenUsage }
  | { type: 'error'; code: string; message: string; retryable: boolean };

/** 모델 등급 — team.json의 salary와 1:1 매핑 */
export type ModelTier = 'high' | 'medium' | 'low';

/** LLM 모델 정보 */
export interface LLMModel {
  id: string;
  name: string;
  tier: ModelTier;
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextWindow: number;
  maxOutputTokens: number;
}

/** API 요청 옵션 */
export interface LLMRequestOptions {
  /** system prompt — Provider별로 다른 방식으로 주입됨 */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** 취소 신호 — AbortController.signal 전달 */
  signal?: AbortSignal;
}

/**
 * LLM Provider 인터페이스
 * v1: AnthropicProvider만 구현
 * v2: OpenAIProvider, GeminiProvider 추가
 * v2.2: Guided login (콘솔 열기 → 키 입력)
 */
export interface LLMProvider {
  readonly id: string;
  readonly name: string;

  /** Provider가 지원하는 모델 목록 */
  getModels(): LLMModel[];

  /**
   * API 키 설정 — ConfigService에서 SecretStorage 키를 로드한 후 호출
   * 이 메서드 호출 전에는 streamMessage() 사용 불가
   */
  setApiKey(apiKey: string): void;

  /**
   * 스트리밍 메시지 전송
   * AsyncGenerator로 chunk를 순차 전달
   * signal로 중간 취소 가능
   *
   * 에러 처리 전략:
   * - retryable 에러 (429, 500, timeout) → yield { type: 'error', retryable: true }
   * - non-retryable 에러 (401, 400) → yield { type: 'error', retryable: false }
   * - 취소 (AbortError) → throw DOMException (caller가 catch)
   */
  streamMessage(
    model: string,
    messages: LLMMessage[],
    options?: LLMRequestOptions,
  ): AsyncGenerator<LLMStreamEvent>;

  /** API 키 유효성 검증 (최소 비용 모델로 ping) */
  validateKey(apiKey: string): Promise<boolean>;

  /**
   * 토큰 수 추정
   * - Anthropic: POST /v1/messages/count_tokens API
   * - OpenAI: tiktoken 로컬 추정
   * - Gemini: countTokens API
   * - fallback: Math.ceil(text.length / 4)
   */
  countTokens?(text: string): Promise<number>;
}
