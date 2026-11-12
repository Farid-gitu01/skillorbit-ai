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

interface OpenAiModelsResponse {
  data?: unknown[];
}

interface OpenAiChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Adapter for OpenAI and OpenAI-compatible HTTP APIs.
 * Uses /models for zero-token connectivity verification and /chat/completions for completions.
 */
export class OpenAiProviderAdapter implements AiProviderAdapter {
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
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async checkConnection(options?: { timeoutMs?: number }): Promise<AiConnectionCheckResult> {
    const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs;
    const { data, latencyMs } = await executeAiJsonRequest<OpenAiModelsResponse>({
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

    const payload: Record<string, unknown> = {
      model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    if (request.maxTokens !== undefined) {
      payload.max_tokens = request.maxTokens;
    }
    if (request.temperature !== undefined) {
      payload.temperature = request.temperature;
    }

    const { data, latencyMs } = await executeAiJsonRequest<OpenAiChatCompletionResponse>({
      provider: this.provider,
      url: `${this.config.baseUrl}/chat/completions`,
      method: 'POST',
      headers: this.buildHeaders(),
      body: payload,
      timeoutMs: request.timeoutMs ?? this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
      httpClient: this.deps.httpClient,
      sleep: this.deps.sleep,
    });

    const firstChoice = Array.isArray(data?.choices) ? data.choices[0] : undefined;
    const content = firstChoice?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AiProviderError('AI provider returned an empty or malformed completion payload.', {
        code: 'AI_RESPONSE_INVALID',
        statusCode: 502,
        retryable: false,
        provider: this.provider,
      });
    }

    const usage = data.usage
      ? {
          ...(typeof data.usage.prompt_tokens === 'number'
            ? { inputTokens: data.usage.prompt_tokens }
            : {}),
          ...(typeof data.usage.completion_tokens === 'number'
            ? { outputTokens: data.usage.completion_tokens }
            : {}),
          ...(typeof data.usage.total_tokens === 'number'
            ? { totalTokens: data.usage.total_tokens }
            : {}),
        }
      : undefined;

    return {
      provider: this.provider,
      model: typeof data.model === 'string' && data.model.trim() ? data.model : model,
      content,
      ...(typeof firstChoice?.finish_reason === 'string'
        ? { finishReason: firstChoice.finish_reason }
        : {}),
      ...(usage && Object.keys(usage).length > 0 ? { usage } : {}),
      latencyMs,
      ...(request.requestId ? { requestId: request.requestId } : {}),
    };
  }
}
