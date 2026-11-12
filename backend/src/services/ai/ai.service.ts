import { inspectAiConfig, resolveAiConfig, validateAiCompletionRequest } from './ai.config.js';
import { AiHealthService, type AiHealthCheckOptions } from './ai.health.js';
import { defaultAiRegistry, type AiProviderRegistry } from './ai.registry.js';
import {
  type AiAdapterDependencies,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type AiConfigInspection,
  type AiHealthReport,
  type AiProviderAdapter,
  type RawAiConfigInput,
} from './ai.types.js';

export interface AiServiceOptions {
  configSource?: RawAiConfigInput | (() => RawAiConfigInput);
  registry?: AiProviderRegistry;
  adapterDeps?: AiAdapterDependencies;
  healthCacheTtlMs?: number;
  now?: () => number;
}

/**
 * Backend-only AI service gateway.
 * Decouples application callers from concrete AI SDKs/APIs while handling
 * unconfigured and unavailable states gracefully without crashing startup.
 */
export class AiService {
  private readonly getConfigSource: (() => RawAiConfigInput) | undefined;
  private readonly registry: AiProviderRegistry;
  private readonly adapterDeps: AiAdapterDependencies;
  private readonly healthService: AiHealthService;

  constructor(options: AiServiceOptions = {}) {
    if (typeof options.configSource === 'function') {
      this.getConfigSource = options.configSource;
    } else if (options.configSource) {
      const snapshot = options.configSource;
      this.getConfigSource = () => snapshot;
    }

    this.registry = options.registry ?? defaultAiRegistry;
    this.adapterDeps = options.adapterDeps ?? {};
    this.healthService = new AiHealthService({
      configSource: this.getConfigSource,
      registry: this.registry,
      adapterDeps: this.adapterDeps,
      cacheTtlMs: options.healthCacheTtlMs,
      now: options.now,
    });
  }

  private resolveAdapter(): AiProviderAdapter {
    const supported = this.registry.getSupportedProviders();
    const config = this.getConfigSource
      ? resolveAiConfig(this.getConfigSource(), supported)
      : resolveAiConfig(undefined, supported);
    return this.registry.createAdapter(config, this.adapterDeps);
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
    const validated = validateAiCompletionRequest(request);
    const adapter = this.resolveAdapter();
    return adapter.complete(validated);
  }
}

export function createAiService(options: AiServiceOptions = {}): AiService {
  return new AiService(options);
}

export const aiService = new AiService();

// Phase 2.6.2+ business feature stubs — intentionally unimplemented in Phase 2.6.1
export const analyzeResume = async (_resumeText: string): Promise<Record<string, unknown>> => {
  return {};
};

export const getSkillGap = async (
  _userSkills: string[],
  _jobRequirements: string[]
): Promise<string[]> => {
  return [];
};
