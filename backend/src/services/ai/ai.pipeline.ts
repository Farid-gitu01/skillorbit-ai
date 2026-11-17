import { randomUUID } from 'node:crypto';
import { type z } from 'zod';
import {
  DEFAULT_AI_MAX_OUTPUT_CHARS,
  DEFAULT_AI_MAX_TOKENS,
  resolveAiConfig,
  validateAiCompletionRequest,
} from './ai.config.js';
import { AiProviderError, normalizeAiExecutionError, redactAiSecrets } from './ai.errors.js';
import { parseStructuredAiOutput } from './ai.parser.js';
import {
  buildPromptMessages,
  composeIsolatedMessages,
  type AiPromptTemplate,
} from './ai.prompts.js';
import { defaultAiRegistry, type AiProviderRegistry } from './ai.registry.js';
import {
  type AiAdapterDependencies,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type AiExecutionMetadata,
  type AiStructuredExecutionResult,
  type AiTextExecutionResult,
  type AiUsageRecord,
  type AiUsageTracker,
  type RawAiConfigInput,
} from './ai.types.js';
import { InMemoryAiUsageTracker } from './ai.usage.js';

export interface AiPipelineDependencies {
  getConfigSource?: () => RawAiConfigInput;
  registry?: AiProviderRegistry;
  adapterDeps?: AiAdapterDependencies;
  usageTracker?: AiUsageTracker;
  now?: () => number;
}

export interface ExecuteTextRequest {
  feature: string;
  systemPrompt: string;
  userInput: string;
  userLabel?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxOutputChars?: number;
  requestId?: string;
  wrapUserContent?: boolean;
}

export interface ExecutePromptOptions<TSchema extends z.ZodTypeAny> {
  template: AiPromptTemplate<TSchema>;
  input: z.input<TSchema>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxOutputChars?: number;
  requestId?: string;
}

export interface ExecuteStructuredRequest<TSchema extends z.ZodTypeAny> extends ExecuteTextRequest {
  schema: TSchema;
}

export interface ExecuteStructuredPromptOptions<
  TSchema extends z.ZodTypeAny,
  TOutSchema extends z.ZodTypeAny,
> extends ExecutePromptOptions<TSchema> {
  schema: TOutSchema;
}

interface ExecutionContext {
  feature: string;
  promptId?: string;
  promptVersion?: string;
}

/**
 * Centralized AI request execution pipeline:
 * 1. Validates request inputs & applies safe token/output bounds
 * 2. Enforces isolated system/user prompt construction
 * 3. Resolves configured provider adapter via registry
 * 4. Executes provider request with timeout & bounded retry
 * 5. Validates response size & optional Zod structured JSON output
 * 6. Normalizes failures & records secret-free execution telemetry
 */
export class AiExecutionPipeline {
  private readonly getConfigSource: (() => RawAiConfigInput) | undefined;
  private readonly registry: AiProviderRegistry;
  private readonly adapterDeps: AiAdapterDependencies;
  private readonly usageTracker: AiUsageTracker;
  private readonly now: () => number;

  constructor(deps: AiPipelineDependencies = {}) {
    this.getConfigSource = deps.getConfigSource;
    this.registry = deps.registry ?? defaultAiRegistry;
    this.adapterDeps = deps.adapterDeps ?? {};
    this.usageTracker = deps.usageTracker ?? new InMemoryAiUsageTracker();
    this.now = deps.now ?? (() => Date.now());
  }

  private async safeRecordUsage(entry: AiUsageRecord): Promise<void> {
    try {
      await this.usageTracker.record(entry);
    } catch {
      // Telemetry failures must never disrupt AI operations
    }
  }

  private async executeTracked<TPayload>(
    request: AiCompletionRequest,
    context: ExecutionContext,
    transform: (response: AiCompletionResponse, maxOutputChars: number) => TPayload
  ): Promise<{ response: AiCompletionResponse; payload: TPayload; metadata: AiExecutionMetadata }> {
    const requestId = request.requestId?.trim() || randomUUID();
    const feature = context.feature.trim() || 'ai.completion';
    const startedMs = this.now();
    const timestamp = new Date(startedMs).toISOString();

    let resolvedProvider = 'unconfigured';
    let resolvedModel = request.model ?? 'unspecified';
    let capturedUsage: AiCompletionResponse['usage'];

    try {
      const validated = validateAiCompletionRequest({
        ...request,
        requestId,
        feature,
        maxTokens: request.maxTokens ?? DEFAULT_AI_MAX_TOKENS,
      });

      const supported = this.registry.getSupportedProviders();
      const config = this.getConfigSource
        ? resolveAiConfig(this.getConfigSource(), supported)
        : resolveAiConfig(undefined, supported);

      resolvedProvider = config.provider;
      resolvedModel = validated.model ?? config.model ?? 'unspecified';

      const adapter = this.registry.createAdapter(config, this.adapterDeps);
      const response = await adapter.complete(validated);
      resolvedProvider = response.provider;
      resolvedModel = response.model;
      capturedUsage = response.usage;

      const maxOutputChars = validated.maxOutputChars ?? DEFAULT_AI_MAX_OUTPUT_CHARS;
      if (response.content.length > maxOutputChars) {
        throw new AiProviderError(
          'AI provider text output exceeded maximum allowed character limit.',
          {
            code: 'AI_RESPONSE_TOO_LARGE',
            statusCode: 502,
            retryable: false,
            provider: response.provider,
          }
        );
      }

      const payload = transform(response, maxOutputChars);
      const durationMs = Math.max(0, this.now() - startedMs);

      const metadata: AiExecutionMetadata = {
        requestId,
        feature,
        ...(context.promptId ? { promptId: context.promptId } : {}),
        ...(context.promptVersion ? { promptVersion: context.promptVersion } : {}),
        provider: response.provider,
        model: response.model,
        timestamp,
        durationMs,
        ...(response.finishReason ? { finishReason: response.finishReason } : {}),
        ...(response.usage ? { usage: response.usage } : {}),
      };

      await this.safeRecordUsage({
        requestId,
        feature,
        promptId: context.promptId,
        promptVersion: context.promptVersion,
        provider: response.provider,
        model: response.model,
        timestamp,
        durationMs,
        status: 'success',
        tokenUsage: response.usage,
      });

      return { response, payload, metadata };
    } catch (error) {
      const normalized = normalizeAiExecutionError(
        error,
        resolvedProvider !== 'unconfigured' ? resolvedProvider : undefined
      );
      const durationMs = Math.max(0, this.now() - startedMs);

      console.error(
        '[ai:pipeline] Execution failed:',
        JSON.stringify({
          requestId,
          feature,
          provider: normalized.provider ?? resolvedProvider,
          model: resolvedModel,
          errorCode: normalized.code,
          statusCode: normalized.statusCode,
          timeoutMs: request.timeoutMs,
          durationMs,
          message: redactAiSecrets(normalized.message),
        })
      );

      await this.safeRecordUsage({
        requestId,
        feature,
        promptId: context.promptId,
        promptVersion: context.promptVersion,
        provider: normalized.provider ?? resolvedProvider,
        model: resolvedModel,
        timestamp,
        durationMs,
        status: 'failure',
        errorCode: normalized.code,
        ...(capturedUsage ? { tokenUsage: capturedUsage } : {}),
      });

      throw normalized;
    }
  }

  async runRawCompletion(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const feature = request.feature?.trim() || 'ai.completion';
    const { response } = await this.executeTracked(request, { feature }, (res) => res);
    return response;
  }

  async executeText(request: ExecuteTextRequest): Promise<AiTextExecutionResult> {
    if (!request.feature.trim()) {
      throw new AiProviderError('AI execution feature identifier is required.', {
        code: 'AI_INVALID_REQUEST',
        statusCode: 400,
        retryable: false,
      });
    }

    const messages = composeIsolatedMessages({
      systemPrompt: request.systemPrompt,
      userContent: request.userInput,
      userLabel: request.userLabel,
      wrapUserContent: request.wrapUserContent,
      requireJson: false,
    });

    const { payload, metadata } = await this.executeTracked(
      {
        messages,
        model: request.model,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        timeoutMs: request.timeoutMs,
        maxOutputChars: request.maxOutputChars,
        requestId: request.requestId,
      },
      { feature: request.feature },
      (res) => res.content
    );

    return { content: payload, metadata };
  }

  async executePrompt<TSchema extends z.ZodTypeAny>(
    options: ExecutePromptOptions<TSchema>
  ): Promise<AiTextExecutionResult> {
    const built = buildPromptMessages(options.template, options.input, { requireJson: false });
    const { payload, metadata } = await this.executeTracked(
      {
        messages: built.messages,
        model: options.model,
        maxTokens: options.maxTokens ?? built.defaultMaxTokens,
        temperature: options.temperature ?? built.defaultTemperature,
        timeoutMs: options.timeoutMs,
        maxOutputChars: options.maxOutputChars ?? built.maxOutputChars,
        requestId: options.requestId,
      },
      {
        feature: built.feature,
        promptId: built.promptId,
        promptVersion: built.promptVersion,
      },
      (res) => res.content
    );

    return { content: payload, metadata };
  }

  async executeStructured<TSchema extends z.ZodTypeAny>(
    request: ExecuteStructuredRequest<TSchema>
  ): Promise<AiStructuredExecutionResult<z.infer<TSchema>>> {
    if (!request.feature.trim()) {
      throw new AiProviderError('AI execution feature identifier is required.', {
        code: 'AI_INVALID_REQUEST',
        statusCode: 400,
        retryable: false,
      });
    }

    const messages = composeIsolatedMessages({
      systemPrompt: request.systemPrompt,
      userContent: request.userInput,
      userLabel: request.userLabel,
      wrapUserContent: request.wrapUserContent,
      requireJson: true,
    });

    const { response, payload, metadata } = await this.executeTracked(
      {
        messages,
        model: request.model,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        timeoutMs: request.timeoutMs,
        maxOutputChars: request.maxOutputChars,
        requestId: request.requestId,
      },
      { feature: request.feature },
      (res, maxOutputChars) =>
        parseStructuredAiOutput(res.content, request.schema, {
          maxOutputChars,
          provider: res.provider,
        })
    );

    return {
      data: payload,
      rawContentLength: response.content.length,
      metadata,
    };
  }

  async executeStructuredPrompt<
    TSchema extends z.ZodTypeAny,
    TOutSchema extends z.ZodTypeAny,
  >(
    options: ExecuteStructuredPromptOptions<TSchema, TOutSchema>
  ): Promise<AiStructuredExecutionResult<z.infer<TOutSchema>>> {
    const built = buildPromptMessages(options.template, options.input, { requireJson: true });
    const { response, payload, metadata } = await this.executeTracked(
      {
        messages: built.messages,
        model: options.model,
        maxTokens: options.maxTokens ?? built.defaultMaxTokens,
        temperature: options.temperature ?? built.defaultTemperature,
        timeoutMs: options.timeoutMs,
        maxOutputChars: options.maxOutputChars ?? built.maxOutputChars,
        requestId: options.requestId,
      },
      {
        feature: built.feature,
        promptId: built.promptId,
        promptVersion: built.promptVersion,
      },
      (res, maxOutputChars) =>
        parseStructuredAiOutput(res.content, options.schema, {
          maxOutputChars,
          provider: res.provider,
        })
    );

    return {
      data: payload,
      rawContentLength: response.content.length,
      metadata,
    };
  }
}
