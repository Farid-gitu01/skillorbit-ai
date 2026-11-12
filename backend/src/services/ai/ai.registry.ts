import { AiProviderError } from './ai.errors.js';
import {
  type AiAdapterDependencies,
  type AiProviderAdapter,
  type AiProviderConfig,
} from './ai.types.js';
import { AnthropicProviderAdapter } from './providers/anthropic.provider.js';
import { OpenAiProviderAdapter } from './providers/openai.provider.js';

export type AiProviderFactory = (
  config: AiProviderConfig,
  deps?: AiAdapterDependencies
) => AiProviderAdapter;

/**
 * Registry/factory decoupling AI provider selection from callers and business logic.
 * Future provider adapters can be registered without modifying consumers.
 */
export class AiProviderRegistry {
  private readonly factories = new Map<string, AiProviderFactory>();

  constructor(registerBuiltins = true) {
    if (registerBuiltins) {
      this.register('openai', (config, deps) => new OpenAiProviderAdapter(config, deps));
      this.register('openai-compatible', (config, deps) => new OpenAiProviderAdapter(config, deps));
      this.register('anthropic', (config, deps) => new AnthropicProviderAdapter(config, deps));
    }
  }

  register(providerName: string, factory: AiProviderFactory): this {
    const normalized = providerName.trim().toLowerCase();
    if (!normalized) {
      throw new AiProviderError('Provider name cannot be empty when registering an AI adapter.', {
        code: 'AI_INVALID_CONFIGURATION',
        statusCode: 400,
        retryable: false,
      });
    }
    this.factories.set(normalized, factory);
    return this;
  }

  has(providerName: string): boolean {
    return this.factories.has(providerName.trim().toLowerCase());
  }

  getSupportedProviders(): string[] {
    return Array.from(this.factories.keys());
  }

  createAdapter(config: AiProviderConfig, deps?: AiAdapterDependencies): AiProviderAdapter {
    const normalized = config.provider.trim().toLowerCase();
    const factory = this.factories.get(normalized);
    if (!factory) {
      throw new AiProviderError(`Unsupported AI provider "${normalized}".`, {
        code: 'AI_UNSUPPORTED_PROVIDER',
        statusCode: 400,
        retryable: false,
        provider: normalized,
      });
    }
    return factory({ ...config, provider: normalized }, deps);
  }
}

export const defaultAiRegistry = new AiProviderRegistry(true);
