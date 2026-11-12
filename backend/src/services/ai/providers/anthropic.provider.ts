import { AiProviderError } from '../ai.errors.js';
import { executeAiJsonRequest } from '../ai.http.js';
import {
  type AiAdapterDependencies,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type AiConnectionCheckResult,
  type AiProviderAdapter,
  type AiProviderConfig,
} from '../ai.types.js';

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_ANTHROPIC_MAX_TOKENS = 1024;

interface AnthropicModelsResponse {
  data?: unknown[];
}

interface AnthropicMessagesResponse {
  model?: string;
  stop_reason?: string | null;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

/**
 * Adapter for Anthropic-compatible HTTP APIs.
 * Uses GET /models for zero-token connectivity verification and POST /messages for completions.
 */
export class AnthropicProviderAdapter implements AiProviderAdapter {
  readonly provider: string;
  private readonly config: AiProviderConfig;
  private readonly deps: AiAdapterDependencies;

  constructor(config: AiProviderConfig, deps: AiAdapterDependencies = {}) {
    this.provider = config.provider;
    this.config = config;
    this.deps = deps;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
    };
  }

  async checkConnection(options?: { timeoutMs?: number }): Promise<AiConnectionCheckResult> {
    const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs;
    const { data, latencyMs } = await executeAiJsonRequest<AnthropicModelsResponse>({
      provider: this.provider,
      url: `${this.config.baseUrl}/models`,
      method: 'GET',
      headers: this.buildHeaders(),
      timeoutMs,
      maxRetries: 0,
      httpClient: this.deps.httpClient,
      sleep: this.deps.sleep,
    });

    if (!data || typeof data !== 'object' || !Array.isArray(data.data)) {
      throw new AiProviderError('AI provider returned an unexpected connectivity response.', {
        code: 'AI_RESPONSE_INVALID',
        statusCode: 502,
        retryable: false,
        provider: this.provider,
      });
    }

    return {
      connected: true,
      provider: this.provider,
      latencyMs,
      modelCount: data.data.length,
    };
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const model = request.model ?? this.config.model;
    if (!model) {
      throw new AiProviderError('AI model must be configured via AI_MODEL or specified per request.', {
        code: 'AI_INVALID_CONFIGURATION',
        statusCode: 400,
        retryable: false,
        provider: this.provider,
      });
    }

    if (request.temperature !== undefined && request.temperature > 1) {
      throw new AiProviderError('Anthropic temperature must be between 0 and 1.', {
        code: 'AI_INVALID_REQUEST',
        statusCode: 400,
        retryable: false,
        provider: this.provider,
      });
    }

    const systemParts: string[] = [];
    const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        conversationMessages.push({ role: msg.role, content: msg.content });
      }
    }

    if (conversationMessages.length === 0) {
      throw new AiProviderError('Anthropic requests require at least one user or assistant message.', {
        code: 'AI_INVALID_REQUEST',
        statusCode: 400,
        retryable: false,
        provider: this.provider,
      });
    }

    const payload: Record<string, unknown> = {
      model,
      max_tokens: request.maxTokens ?? DEFAULT_ANTHROPIC_MAX_TOKENS,
      messages: conversationMessages,
    };

    if (systemParts.length > 0) {
      payload.system = systemParts.join('\n\n');
    }
    if (request.temperature !== undefined) {
      payload.temperature = request.temperature;
    }

    const { data, latencyMs } = await executeAiJsonRequest<AnthropicMessagesResponse>({
      provider: this.provider,
      url: `${this.config.baseUrl}/messages`,
      method: 'POST',
      headers: this.buildHeaders(),
      body: payload,
      timeoutMs: request.timeoutMs ?? this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
      httpClient: this.deps.httpClient,
      sleep: this.deps.sleep,
    });

    const textBlocks = Array.isArray(data?.content)
      ? data.content
          .filter((block) => block.type === 'text' && typeof block.text === 'string')
          .map((block) => block.text!)
      : [];

    const content = textBlocks.join('\n').trim();
    if (!content) {
      throw new AiProviderError('AI provider returned an empty or malformed completion payload.', {
        code: 'AI_RESPONSE_INVALID',
        statusCode: 502,
        retryable: false,
        provider: this.provider,
      });
    }

    const inputTokens =
      typeof data.usage?.input_tokens === 'number' ? data.usage.input_tokens : undefined;
    const outputTokens =
      typeof data.usage?.output_tokens === 'number' ? data.usage.output_tokens : undefined;
    const totalTokens =
      inputTokens !== undefined && outputTokens !== undefined
        ? inputTokens + outputTokens
        : undefined;

    const usage =
      inputTokens !== undefined || outputTokens !== undefined
        ? {
            ...(inputTokens !== undefined ? { inputTokens } : {}),
            ...(outputTokens !== undefined ? { outputTokens } : {}),
            ...(totalTokens !== undefined ? { totalTokens } : {}),
          }
        : undefined;

    return {
      provider: this.provider,
      model: typeof data.model === 'string' && data.model.trim() ? data.model : model,
      content,
      ...(typeof data.stop_reason === 'string' ? { finishReason: data.stop_reason } : {}),
      ...(usage ? { usage } : {}),
      latencyMs,
      ...(request.requestId ? { requestId: request.requestId } : {}),
    };
  }
}
