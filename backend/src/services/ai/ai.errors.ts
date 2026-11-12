/**
 * Standardized AI error types, secret redaction, and safe error normalization.
 * Never embeds API keys, authorization headers, or raw upstream credentials in messages.
 */

export type AiErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_API_KEY_MISSING'
  | 'AI_INVALID_CONFIGURATION'
  | 'AI_UNSUPPORTED_PROVIDER'
  | 'AI_INVALID_REQUEST'
  | 'AI_AUTHENTICATION_FAILED'
  | 'AI_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_RESPONSE_INVALID';

export interface AiProviderErrorOptions {
  code: AiErrorCode;
  statusCode: number;
  retryable?: boolean;
  provider?: string;
  retryAfterMs?: number;
}

export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly provider?: string;
  readonly retryAfterMs?: number;

  constructor(message: string, options: AiProviderErrorOptions) {
    super(redactAiSecrets(message));
    this.name = 'AiProviderError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    this.provider = options.provider;
    this.retryAfterMs = options.retryAfterMs;
    Error.captureStackTrace?.(this, AiProviderError);
  }

  toSafeJSON(): {
    name: string;
    code: AiErrorCode;
    statusCode: number;
    provider?: string;
    message: string;
  } {
    return {
      name: this.name,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.provider ? { provider: this.provider } : {}),
      message: this.message,
    };
  }
}

/**
 * Strips common secret token patterns and any explicitly provided secret strings
 * so diagnostic messages or caught error text can never expose credentials.
 */
export function redactAiSecrets(
  input: string,
  knownSecrets: ReadonlyArray<string | undefined> = []
): string {
  let sanitized = input;

  for (const secret of knownSecrets) {
    if (secret && secret.trim().length > 0) {
      sanitized = sanitized.split(secret).join('[REDACTED]');
    }
  }

  return sanitized
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{6,}/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-(?:ant-|proj-|svcacct-)?[A-Za-z0-9_-]{8,}/g, '[REDACTED_KEY]')
    .replace(/([?&](?:api_?key|key|token|secret)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b(x-api-key|authorization)\s*[:=]\s*([^\s,;]+)/gi, '$1: [REDACTED]');
}

export function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const trimmed = headerValue.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const seconds = Number.parseFloat(trimmed);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.round(seconds * 1000), 10_000);
    }
  }
  return undefined;
}

export function mapUpstreamStatusToAiError(
  provider: string,
  status: number,
  retryAfterHeader?: string | null
): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError('AI provider authentication failed.', {
      code: 'AI_AUTHENTICATION_FAILED',
      statusCode: 503,
      retryable: false,
      provider,
    });
  }

  if (status === 429) {
    return new AiProviderError('AI provider rate limit exceeded. Please try again shortly.', {
      code: 'AI_RATE_LIMITED',
      statusCode: 429,
      retryable: true,
      provider,
      retryAfterMs: parseRetryAfterMs(retryAfterHeader ?? null),
    });
  }

  if (status === 408 || status === 504) {
    return new AiProviderError('AI provider request timed out.', {
      code: 'AI_TIMEOUT',
      statusCode: 504,
      retryable: true,
      provider,
    });
  }

  if (status >= 400 && status < 500) {
    return new AiProviderError('AI provider rejected the request parameters or configuration.', {
      code: 'AI_INVALID_REQUEST',
      statusCode: 400,
      retryable: false,
      provider,
    });
  }

  return new AiProviderError('AI provider service is temporarily unavailable.', {
    code: 'AI_PROVIDER_UNAVAILABLE',
    statusCode: 503,
    retryable: true,
    provider,
  });
}

export function mapTransportErrorToAiError(
  provider: string,
  error: unknown,
  timedOut: boolean
): AiProviderError {
  if (error instanceof AiProviderError) {
    return error;
  }

  if (
    timedOut ||
    (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
  ) {
    return new AiProviderError('AI provider request timed out.', {
      code: 'AI_TIMEOUT',
      statusCode: 504,
      retryable: true,
      provider,
    });
  }

  return new AiProviderError('AI provider could not be reached.', {
    code: 'AI_PROVIDER_UNAVAILABLE',
    statusCode: 503,
    retryable: true,
    provider,
  });
}
