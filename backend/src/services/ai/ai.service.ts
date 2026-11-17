import { type z } from 'zod';
import { inspectAiConfig } from './ai.config.js';
import { AiHealthService, type AiHealthCheckOptions } from './ai.health.js';
import {
  AiExecutionPipeline,
  type ExecutePromptOptions,
  type ExecuteStructuredPromptOptions,
  type ExecuteStructuredRequest,
  type ExecuteTextRequest,
} from './ai.pipeline.js';
import { AiPromptRegistry } from './ai.prompts.js';
import { defaultAiRegistry, type AiProviderRegistry } from './ai.registry.js';
import {
  type AiAdapterDependencies,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type AiConfigInspection,
  type AiHealthReport,
  type AiStructuredExecutionResult,
  type AiTextExecutionResult,
  type AiUsageRecord,
  type AiUsageSummary,
  type AiUsageTracker,
  type RawAiConfigInput,
} from './ai.types.js';
import { InMemoryAiUsageTracker } from './ai.usage.js';

export interface AiServiceOptions {
  configSource?: RawAiConfigInput | (() => RawAiConfigInput);
  registry?: AiProviderRegistry;
  adapterDeps?: AiAdapterDependencies;
  usageTracker?: AiUsageTracker;
  promptRegistry?: AiPromptRegistry;
  healthCacheTtlMs?: number;
  now?: () => number;
}

export interface ExecuteRegisteredPromptOptions {
  promptId: string;
  version?: string;
  input: unknown;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxOutputChars?: number;
  requestId?: string;
}

export interface ExecuteRegisteredStructuredPromptOptions<TSchema extends z.ZodTypeAny>
  extends ExecuteRegisteredPromptOptions {
  schema: TSchema;
}

/**
 * Centralized backend-only AI orchestration gateway.
 * Coordinates configuration inspection, health probes, versioned prompts,
 * provider-independent execution, structured JSON validation, and usage telemetry.
 */
export class AiService {
  private readonly getConfigSource: (() => RawAiConfigInput) | undefined;
  private readonly registry: AiProviderRegistry;
  private readonly usageTracker: AiUsageTracker;
  private readonly promptRegistry: AiPromptRegistry;
  private readonly healthService: AiHealthService;
  private readonly pipeline: AiExecutionPipeline;

  constructor(options: AiServiceOptions = {}) {
    if (typeof options.configSource === 'function') {
      this.getConfigSource = options.configSource;
    } else if (options.configSource) {
      const snapshot = options.configSource;
      this.getConfigSource = () => snapshot;
    }

    this.registry = options.registry ?? defaultAiRegistry;
    this.usageTracker = options.usageTracker ?? new InMemoryAiUsageTracker();
    this.promptRegistry = options.promptRegistry ?? new AiPromptRegistry();

    const adapterDeps = options.adapterDeps ?? {};

    this.healthService = new AiHealthService({
      configSource: this.getConfigSource,
      registry: this.registry,
      adapterDeps,
      cacheTtlMs: options.healthCacheTtlMs,
      now: options.now,
    });

    this.pipeline = new AiExecutionPipeline({
      getConfigSource: this.getConfigSource,
      registry: this.registry,
      adapterDeps,
      usageTracker: this.usageTracker,
      now: options.now,
    });
  }

  get prompts(): AiPromptRegistry {
    return this.promptRegistry;
  }

  inspectConfiguration(): AiConfigInspection {
    const supported = this.registry.getSupportedProviders();
    return this.getConfigSource
      ? inspectAiConfig(this.getConfigSource(), supported)
      : inspectAiConfig(undefined, supported);
  }

  isConfigured(): boolean {
    return this.inspectConfiguration().status === 'configured';
  }

  getReadiness(): AiHealthReport {
    return this.healthService.getStatus();
  }

  async checkHealth(options?: AiHealthCheckOptions): Promise<AiHealthReport> {
    return this.healthService.checkHealth(options);
  }

  clearHealthCache(): void {
    this.healthService.clearCache();
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    return this.pipeline.runRawCompletion(request);
  }

  async executeText(request: ExecuteTextRequest): Promise<AiTextExecutionResult> {
    return this.pipeline.executeText(request);
  }

  async executePrompt<TSchema extends z.ZodTypeAny>(
    options: ExecutePromptOptions<TSchema>
  ): Promise<AiTextExecutionResult> {
    return this.pipeline.executePrompt(options);
  }

  async executeStructured<TSchema extends z.ZodTypeAny>(
    request: ExecuteStructuredRequest<TSchema>
  ): Promise<AiStructuredExecutionResult<z.infer<TSchema>>> {
    return this.pipeline.executeStructured(request);
  }

  async executeStructuredPrompt<
    TSchema extends z.ZodTypeAny,
    TOutSchema extends z.ZodTypeAny,
  >(
    options: ExecuteStructuredPromptOptions<TSchema, TOutSchema>
  ): Promise<AiStructuredExecutionResult<z.infer<TOutSchema>>> {
    return this.pipeline.executeStructuredPrompt(options);
  }

  async executeRegisteredPrompt(
    options: ExecuteRegisteredPromptOptions
  ): Promise<AiTextExecutionResult> {
    const template = this.promptRegistry.get(options.promptId, options.version);
    return this.pipeline.executePrompt({
      template,
      input: options.input,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      timeoutMs: options.timeoutMs,
      maxOutputChars: options.maxOutputChars,
      requestId: options.requestId,
    });
  }

  async executeRegisteredStructuredPrompt<TSchema extends z.ZodTypeAny>(
    options: ExecuteRegisteredStructuredPromptOptions<TSchema>
  ): Promise<AiStructuredExecutionResult<z.infer<TSchema>>> {
    const template = this.promptRegistry.get(options.promptId, options.version);
    return this.pipeline.executeStructuredPrompt({
      template,
      input: options.input,
      schema: options.schema,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      timeoutMs: options.timeoutMs,
      maxOutputChars: options.maxOutputChars,
      requestId: options.requestId,
    });
  }

  getUsageSummary(): AiUsageSummary | undefined {
    return this.usageTracker.getSummary?.();
  }

  getRecentUsage(limit?: number): ReadonlyArray<AiUsageRecord> {
    return this.usageTracker.getRecent?.(limit) ?? [];
  }
}

export function createAiService(options: AiServiceOptions = {}): AiService {
  return new AiService(options);
}

export const aiService = new AiService();

// Future Phase AI business feature stubs — intentionally unimplemented in Phase 2.6.2
export const analyzeResume = async (_resumeText: string): Promise<Record<string, unknown>> => {
  return {};
};

export const getSkillGap = async (
  _userSkills: string[],
  _jobRequirements: string[]
): Promise<string[]> => {
  return [];
};
