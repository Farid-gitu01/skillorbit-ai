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

interface GeminiModelsResponse {
  models?: unknown[];
}

interface GeminiGenerateContentResponse {
  modelVersion?: string;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * Adapter for Google Gemini REST API (v1beta).
 * Uses GET /models for zero-token connectivity verification and
 * POST /models/{model}:generateContent for completions.
 */
export class GeminiProviderAdapter implements AiProviderAdapter {
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
      'x-goog-api-key': this.config.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async checkConnection(options?: { timeoutMs?: number }): Promise<AiConnectionCheckResult> {
    const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs;
    const baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    const { data, latencyMs } = await executeAiJsonRequest<GeminiModelsResponse>({
      provider: this.provider,
      url: `${baseUrl}/models`,
      method: 'GET',
      headers: this.buildHeaders(),
      timeoutMs,
      maxRetries: 0,
      httpClient: this.deps.httpClient,
      sleep: this.deps.sleep,
    });

    if (!data || typeof data !== 'object' || !Array.isArray(data.models)) {
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
      modelCount: data.models.length,
    };
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const rawModel = request.model ?? this.config.model;
    if (!rawModel) {
      throw new AiProviderError('AI model must be configured via AI_MODEL or specified per request.', {
        code: 'AI_INVALID_CONFIGURATION',
        statusCode: 400,
        retryable: false,
        provider: this.provider,
      });
    }

    const model = rawModel.trim().replace(/^models\//, '');
    if (!model) {
      throw new AiProviderError('AI model must be configured via AI_MODEL or specified per request.', {
        code: 'AI_INVALID_CONFIGURATION',
        statusCode: 400,
        retryable: false,
        provider: this.provider,
      });
    }

    const systemParts: string[] = [];
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    if (contents.length === 0) {
      throw new AiProviderError('Gemini requests require at least one user or assistant message.', {
        code: 'AI_INVALID_REQUEST',
        statusCode: 400,
        retryable: false,
        provider: this.provider,
      });
    }

    const payload: Record<string, unknown> = {
      contents,
    };

    if (systemParts.length > 0) {
      payload.systemInstruction = {
        parts: [{ text: systemParts.join('\n\n') }],
      };
    }

    const generationConfig: Record<string, unknown> = {};
    if (request.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }
    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }
    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
    }

    const baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    const { data, latencyMs } = await executeAiJsonRequest<GeminiGenerateContentResponse>({
      provider: this.provider,
      model,
      url: `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      method: 'POST',
      headers: this.buildHeaders(),
      body: payload,
      timeoutMs: request.timeoutMs ?? this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
      httpClient: this.deps.httpClient,
      sleep: this.deps.sleep,
    });

    const firstCandidate = Array.isArray(data?.candidates) ? data.candidates[0] : undefined;
    const textParts = Array.isArray(firstCandidate?.content?.parts)
      ? firstCandidate.content.parts
          .filter((part) => typeof part?.text === 'string')
          .map((part) => part.text!)
      : [];

    const content = textParts.join('\n').trim();
    if (!content) {
      throw new AiProviderError('AI provider returned an empty or malformed completion payload.', {
        code: 'AI_RESPONSE_INVALID',
        statusCode: 502,
        retryable: false,
        provider: this.provider,
      });
    }

    const inputTokens =
      typeof data.usageMetadata?.promptTokenCount === 'number'
        ? data.usageMetadata.promptTokenCount
        : undefined;
    const outputTokens =
      typeof data.usageMetadata?.candidatesTokenCount === 'number'
        ? data.usageMetadata.candidatesTokenCount
        : undefined;
    const totalTokens =
      typeof data.usageMetadata?.totalTokenCount === 'number'
        ? data.usageMetadata.totalTokenCount
        : inputTokens !== undefined && outputTokens !== undefined
          ? inputTokens + outputTokens
          : undefined;

    const usage =
      inputTokens !== undefined || outputTokens !== undefined || totalTokens !== undefined
        ? {
            ...(inputTokens !== undefined ? { inputTokens } : {}),
            ...(outputTokens !== undefined ? { outputTokens } : {}),
            ...(totalTokens !== undefined ? { totalTokens } : {}),
          }
        : undefined;

    return {
      provider: this.provider,
      model: typeof data.modelVersion === 'string' && data.modelVersion.trim() ? data.modelVersion : model,
      content,
      ...(typeof firstCandidate?.finishReason === 'string'
        ? { finishReason: firstCandidate.finishReason }
        : {}),
      ...(usage ? { usage } : {}),
      latencyMs,
      ...(request.requestId ? { requestId: request.requestId } : {}),
    };
  }
}
