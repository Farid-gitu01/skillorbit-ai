import { z } from 'zod';
import {
  AI_API_KEY,
  AI_BASE_URL,
  AI_MAX_RETRIES,
  AI_MODEL,
  AI_PROVIDER,
  AI_TIMEOUT_MS,
} from '../../config/constants.js';
import { AiProviderError } from './ai.errors.js';
import {
  type AiCompletionRequest,
  type AiConfigInspection,
  type AiProviderConfig,
  type RawAiConfigInput,
} from './ai.types.js';

export const DEFAULT_AI_TIMEOUT_MS = 30_000;
export const MIN_AI_TIMEOUT_MS = 500;
export const MAX_AI_TIMEOUT_MS = 120_000;

export const DEFAULT_AI_MAX_RETRIES = 1;
export const MAX_AI_MAX_RETRIES = 3;

export const DOCUMENTED_PROVIDER_BASE_URLS: Readonly<Record<string, string>> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

const normalizedBaseUrlSchema = z
  .string()
  .trim()
  .min(1, 'Base URL cannot be empty')
  .max(500, 'Base URL cannot exceed 500 characters')
  .refine((raw) => {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
      if (parsed.username || parsed.password) return false;
      if (parsed.search || parsed.hash) return false;
      return true;
    } catch {
      return false;
    }
  }, 'Base URL must be a valid HTTP/HTTPS origin path without credentials or query strings')
  .transform((raw) => raw.replace(/\/+$/, ''));

const aiModelSchema = z
  .string()
  .trim()
  .min(1, 'Model identifier cannot be empty')
  .max(128, 'Model identifier cannot exceed 128 characters')
  .refine((value) => !/\s/.test(value), 'Model identifier must not contain whitespace');

export const aiCompletionRequestSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string().trim().min(1, 'Message content cannot be empty').max(64_000),
          })
          .strict()
      )
      .min(1, 'At least one message is required')
      .max(50, 'Request exceeds maximum supported message count'),
    model: aiModelSchema.optional(),
    maxTokens: z.number().int().min(1).max(32_768).optional(),
    temperature: z.number().min(0).max(2).optional(),
    timeoutMs: z.number().int().min(MIN_AI_TIMEOUT_MS).max(MAX_AI_TIMEOUT_MS).optional(),
    requestId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

function readDefaultEnvSource(): RawAiConfigInput {
  return {
    provider: AI_PROVIDER,
    apiKey: AI_API_KEY,
    model: AI_MODEL,
    baseUrl: AI_BASE_URL,
    timeoutMs: AI_TIMEOUT_MS,
    maxRetries: AI_MAX_RETRIES,
  };
}

function parseBoundedInteger(
  raw: number | string | undefined,
  defaultValue: number,
  min: number,
  max: number,
  fieldLabel: string
): { value: number } | { error: string } {
  if (raw === undefined || raw === '') {
    return { value: defaultValue };
  }

  let numericValue: number;
  if (typeof raw === 'number') {
    numericValue = raw;
  } else {
    const trimmed = raw.trim();
    if (!trimmed) return { value: defaultValue };
    if (!/^-?\d+$/.test(trimmed)) {
      return { error: `${fieldLabel} must be an integer between ${min} and ${max}.` };
    }
    numericValue = Number.parseInt(trimmed, 10);
  }

  if (!Number.isInteger(numericValue) || numericValue < min || numericValue > max) {
    return { error: `${fieldLabel} must be an integer between ${min} and ${max}.` };
  }

  return { value: numericValue };
}

/**
 * Safely validates and inspects AI configuration without throwing or logging secrets.
 */
export function inspectAiConfig(
  source: RawAiConfigInput = readDefaultEnvSource(),
  supportedProviders: ReadonlyArray<string> = ['openai', 'openai-compatible', 'anthropic']
): AiConfigInspection {
  const providerRaw = source.provider?.trim().toLowerCase();
  const apiKeyRaw = source.apiKey?.trim();
  const modelRaw = source.model !== undefined ? source.model.trim() : undefined;
  const baseUrlRaw = source.baseUrl !== undefined ? source.baseUrl.trim() : undefined;
  const modelConfigured = Boolean(modelRaw && modelRaw.length > 0);

  if (!providerRaw && !apiKeyRaw) {
    return {
      status: 'unconfigured',
      provider: null,
      modelConfigured,
      code: 'AI_NOT_CONFIGURED',
      message: 'AI provider is not configured.',
    };
  }

  if (!providerRaw && apiKeyRaw) {
    return {
      status: 'invalid_configuration',
      provider: null,
      modelConfigured,
      code: 'AI_INVALID_CONFIGURATION',
      message: 'AI_PROVIDER must be set when AI_API_KEY is configured.',
      issues: [{ field: 'AI_PROVIDER', message: 'Required when AI_API_KEY is set' }],
    };
  }

  const normalizedProvider = providerRaw!;

  if (!supportedProviders.includes(normalizedProvider)) {
    return {
      status: 'invalid_configuration',
      provider: normalizedProvider,
      modelConfigured,
      code: 'AI_UNSUPPORTED_PROVIDER',
      message: `Unsupported AI provider "${normalizedProvider}".`,
      issues: [{ field: 'AI_PROVIDER', message: 'Unsupported AI provider' }],
    };
  }

  if (!apiKeyRaw) {
    return {
      status: 'api_key_missing',
      provider: normalizedProvider,
      modelConfigured,
      code: 'AI_API_KEY_MISSING',
      message: 'AI API key is missing.',
      issues: [{ field: 'AI_API_KEY', message: 'Missing API key' }],
    };
  }

  const issues: Array<{ field: string; message: string }> = [];

  if (apiKeyRaw.length < 8) {
    issues.push({ field: 'AI_API_KEY', message: 'API key format appears invalid' });
  }

  let validatedModel: string | undefined;
  if (modelRaw !== undefined && modelRaw !== '') {
    const modelResult = aiModelSchema.safeParse(modelRaw);
    if (!modelResult.success) {
      issues.push({
        field: 'AI_MODEL',
        message: modelResult.error.issues[0]?.message ?? 'Invalid model identifier',
      });
    } else {
      validatedModel = modelResult.data;
    }
  } else if (source.model !== undefined && source.model.trim() === '' && source.model.length > 0) {
    issues.push({ field: 'AI_MODEL', message: 'AI_MODEL cannot be whitespace-only' });
  }

  let resolvedBaseUrl = DOCUMENTED_PROVIDER_BASE_URLS[normalizedProvider] ?? '';
  if (baseUrlRaw && baseUrlRaw.length > 0) {
    const baseUrlResult = normalizedBaseUrlSchema.safeParse(baseUrlRaw);
    if (!baseUrlResult.success) {
      issues.push({
        field: 'AI_BASE_URL',
        message: baseUrlResult.error.issues[0]?.message ?? 'Invalid AI_BASE_URL',
      });
    } else {
      resolvedBaseUrl = baseUrlResult.data;
    }
  } else if (!resolvedBaseUrl) {
    issues.push({
      field: 'AI_BASE_URL',
      message: `AI_BASE_URL is required for provider "${normalizedProvider}"`,
    });
  }

  const timeoutResult = parseBoundedInteger(
    source.timeoutMs,
    DEFAULT_AI_TIMEOUT_MS,
    MIN_AI_TIMEOUT_MS,
    MAX_AI_TIMEOUT_MS,
    'AI_TIMEOUT_MS'
  );
  if ('error' in timeoutResult) {
    issues.push({ field: 'AI_TIMEOUT_MS', message: timeoutResult.error });
  }

  const retriesResult = parseBoundedInteger(
    source.maxRetries,
    DEFAULT_AI_MAX_RETRIES,
    0,
    MAX_AI_MAX_RETRIES,
    'AI_MAX_RETRIES'
  );
  if ('error' in retriesResult) {
    issues.push({ field: 'AI_MAX_RETRIES', message: retriesResult.error });
  }

  if (issues.length > 0) {
    return {
      status: 'invalid_configuration',
      provider: normalizedProvider,
      modelConfigured: Boolean(validatedModel),
      code: 'AI_INVALID_CONFIGURATION',
      message: 'AI provider configuration is invalid.',
      issues,
    };
  }

  const config: AiProviderConfig = {
    provider: normalizedProvider,
    apiKey: apiKeyRaw,
    ...(validatedModel ? { model: validatedModel } : {}),
    baseUrl: resolvedBaseUrl,
    timeoutMs: 'value' in timeoutResult ? timeoutResult.value : DEFAULT_AI_TIMEOUT_MS,
    maxRetries: 'value' in retriesResult ? retriesResult.value : DEFAULT_AI_MAX_RETRIES,
  };

  return {
    status: 'configured',
    provider: config.provider,
    modelConfigured: Boolean(config.model),
    config,
  };
}

/**
 * Resolves a validated AI provider config or throws an operational AiProviderError.
 */
export function resolveAiConfig(
  source: RawAiConfigInput = readDefaultEnvSource(),
  supportedProviders?: ReadonlyArray<string>
): AiProviderConfig {
  const inspection = inspectAiConfig(source, supportedProviders);
  if (inspection.status === 'configured') {
    return inspection.config;
  }

  const statusCode = inspection.code === 'AI_INVALID_CONFIGURATION' || inspection.code === 'AI_UNSUPPORTED_PROVIDER'
    ? 400
    : 503;

  throw new AiProviderError(inspection.message, {
    code: inspection.code,
    statusCode,
    retryable: false,
    provider: inspection.provider ?? undefined,
  });
}

export function validateAiCompletionRequest(request: AiCompletionRequest): AiCompletionRequest {
  const parsed = aiCompletionRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new AiProviderError('Invalid AI completion request parameters.', {
      code: 'AI_INVALID_REQUEST',
      statusCode: 400,
      retryable: false,
    });
  }
  return parsed.data;
}
