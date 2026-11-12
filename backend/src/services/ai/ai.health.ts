import { inspectAiConfig } from './ai.config.js';
import { AiProviderError } from './ai.errors.js';
import { defaultAiRegistry, type AiProviderRegistry } from './ai.registry.js';
import {
  type AiAdapterDependencies,
  type AiHealthReport,
  type RawAiConfigInput,
} from './ai.types.js';

const DEFAULT_HEALTH_CACHE_TTL_MS = 30_000;

export interface AiHealthCheckOptions {
  verifyConnection?: boolean;
  forceRefresh?: boolean;
  timeoutMs?: number;
}

export interface AiHealthServiceOptions {
  configSource?: RawAiConfigInput | (() => RawAiConfigInput);
  registry?: AiProviderRegistry;
  adapterDeps?: AiAdapterDependencies;
  cacheTtlMs?: number;
  now?: () => number;
}

export class AiHealthService {
  private readonly getConfigSource: (() => RawAiConfigInput) | undefined;
  private readonly registry: AiProviderRegistry;
  private readonly adapterDeps: AiAdapterDependencies;
  private readonly cacheTtlMs: number;
  private readonly now: () => number;
  private cachedReport: { report: AiHealthReport; expiresAt: number } | null = null;

  constructor(options: AiHealthServiceOptions = {}) {
    if (typeof options.configSource === 'function') {
      this.getConfigSource = options.configSource;
    } else if (options.configSource) {
      const snapshot = options.configSource;
      this.getConfigSource = () => snapshot;
    }
    this.registry = options.registry ?? defaultAiRegistry;
    this.adapterDeps = options.adapterDeps ?? {};
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_HEALTH_CACHE_TTL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  private inspectCurrentConfig() {
    const supported = this.registry.getSupportedProviders();
    return this.getConfigSource
      ? inspectAiConfig(this.getConfigSource(), supported)
      : inspectAiConfig(undefined, supported);
  }

  /**
   * Returns a safe, secret-free readiness snapshot without performing network requests.
   */
  getStatus(): AiHealthReport {
    const inspection = this.inspectCurrentConfig();
    const checkedAt = new Date(this.now()).toISOString();

    if (inspection.status === 'configured') {
      return {
        status: 'configured',
        configured: true,
        available: true,
        connected: null,
        provider: inspection.provider,
        modelConfigured: inspection.modelConfigured,
        checkedAt,
        message: 'AI provider configuration is valid.',
      };
    }

    if (inspection.status === 'api_key_missing') {
      return {
        status: 'api_key_missing',
        configured: false,
        available: false,
        connected: null,
        provider: inspection.provider,
        modelConfigured: inspection.modelConfigured,
        checkedAt,
        message: 'AI API key is missing.',
      };
    }

    if (inspection.status === 'invalid_configuration') {
      return {
        status: 'invalid_configuration',
        configured: false,
        available: false,
        connected: null,
        provider: inspection.provider,
        modelConfigured: inspection.modelConfigured,
        checkedAt,
        message: inspection.message,
      };
    }

    return {
      status: 'unavailable',
      configured: false,
      available: false,
      connected: null,
      provider: null,
      modelConfigured: inspection.modelConfigured,
      checkedAt,
      message: 'AI provider is not configured.',
    };
  }

  /**
   * Evaluates configuration readiness and, when verifyConnection is true,
   * runs a cached lightweight upstream connectivity check.
   */
  async checkHealth(options: AiHealthCheckOptions = {}): Promise<AiHealthReport> {
    const inspection = this.inspectCurrentConfig();
    if (inspection.status !== 'configured') {
      return this.getStatus();
    }

    if (!options.verifyConnection) {
      return this.getStatus();
    }

    if (
      !options.forceRefresh &&
      this.cacheTtlMs > 0 &&
      this.cachedReport &&
      this.now() < this.cachedReport.expiresAt
    ) {
      return this.cachedReport.report;
    }

    const checkedAt = new Date(this.now()).toISOString();
    try {
      const adapter = this.registry.createAdapter(inspection.config, this.adapterDeps);
      const connectivity = await adapter.checkConnection({
        timeoutMs: options.timeoutMs ?? inspection.config.timeoutMs,
      });

      const report: AiHealthReport = {
        status: 'ready',
        configured: true,
        available: true,
        connected: connectivity.connected,
        provider: inspection.provider,
        modelConfigured: inspection.modelConfigured,
        checkedAt,
        latencyMs: connectivity.latencyMs,
        message: 'AI provider connection verified.',
      };

      if (this.cacheTtlMs > 0) {
        this.cachedReport = { report, expiresAt: this.now() + this.cacheTtlMs };
      }

      return report;
    } catch (error) {
      const report = this.mapConnectivityErrorToReport(
        error,
        inspection.provider,
        inspection.modelConfigured,
        checkedAt
      );

      if (this.cacheTtlMs > 0) {
        this.cachedReport = { report, expiresAt: this.now() + this.cacheTtlMs };
      }

      return report;
    }
  }

  private mapConnectivityErrorToReport(
    error: unknown,
    provider: string,
    modelConfigured: boolean,
    checkedAt: string
  ): AiHealthReport {
    if (error instanceof AiProviderError) {
      if (error.code === 'AI_TIMEOUT') {
        return {
          status: 'timed_out',
          configured: true,
          available: false,
          connected: false,
          provider,
          modelConfigured,
          checkedAt,
          message: 'AI provider connectivity check timed out.',
        };
      }

      if (error.code === 'AI_AUTHENTICATION_FAILED') {
        return {
          status: 'unavailable',
          configured: true,
          available: false,
          connected: false,
          provider,
          modelConfigured,
          checkedAt,
          message: 'AI provider authentication check failed.',
        };
      }

      if (error.code === 'AI_INVALID_CONFIGURATION' || error.code === 'AI_UNSUPPORTED_PROVIDER') {
        return {
          status: 'invalid_configuration',
          configured: false,
          available: false,
          connected: false,
          provider,
          modelConfigured,
          checkedAt,
          message: 'AI provider configuration is invalid.',
        };
      }
    }

    return {
      status: 'unavailable',
      configured: true,
      available: false,
      connected: false,
      provider,
      modelConfigured,
      checkedAt,
      message: 'AI provider is currently unavailable.',
    };
  }

  clearCache(): void {
    this.cachedReport = null;
  }
}

export function createAiHealthService(options: AiHealthServiceOptions = {}): AiHealthService {
  return new AiHealthService(options);
}

export const aiHealthService = new AiHealthService();
