import {
  AiProviderError,
  mapTransportErrorToAiError,
  mapUpstreamStatusToAiError,
} from './ai.errors.js';
import { type AiHttpClient, type SleepFn } from './ai.types.js';

export interface AiJsonRequestOptions {
  provider: string;
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  maxRetries: number;
  httpClient?: AiHttpClient;
  sleep?: SleepFn;
}

export interface AiJsonResponse<TData> {
  data: TData;
  latencyMs: number;
}

const defaultSleep: SleepFn = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

/**
 * Shared HTTP JSON executor for AI provider adapters.
 * Applies strict per-attempt AbortController timeouts, bounded retries strictly
 * on retryable failures, and never logs or echoes secret credentials.
 */
export async function executeAiJsonRequest<TData>(
  options: AiJsonRequestOptions
): Promise<AiJsonResponse<TData>> {
  const fetchImpl = options.httpClient ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new AiProviderError('HTTP client unavailable for AI requests.', {
      code: 'AI_PROVIDER_UNAVAILABLE',
      statusCode: 503,
      retryable: false,
      provider: options.provider,
    });
  }

  const sleepImpl = options.sleep ?? defaultSleep;
  const maxAttempts = Math.max(1, Math.min(options.maxRetries + 1, 4));
  const startedAt = Date.now();
  let lastError: AiProviderError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutHandle = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, options.timeoutMs);

    try {
      const response = await fetchImpl(options.url, {
        method: options.method,
        headers: options.headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        signal: controller.signal,
      });

      if (!response.ok) {
        const mappedError = mapUpstreamStatusToAiError(
          options.provider,
          response.status,
          response.headers.get('retry-after')
        );
        throw mappedError;
      }

      let parsedBody: unknown;
      try {
        parsedBody = await response.json();
      } catch {
        throw new AiProviderError('AI provider returned an unreadable response payload.', {
          code: 'AI_RESPONSE_INVALID',
          statusCode: 502,
          retryable: false,
          provider: options.provider,
        });
      }

      return {
        data: parsedBody as TData,
        latencyMs: Math.max(0, Date.now() - startedAt),
      };
    } catch (error) {
      const mapped = mapTransportErrorToAiError(options.provider, error, didTimeout);
      lastError = mapped;

      if (!mapped.retryable || attempt >= maxAttempts) {
        throw mapped;
      }

      const backoffMs = Math.min(mapped.retryAfterMs ?? attempt * 150, 1_000);
      if (backoffMs > 0) {
        await sleepImpl(backoffMs);
      }
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw (
    lastError ??
    new AiProviderError('AI provider request failed.', {
      code: 'AI_PROVIDER_UNAVAILABLE',
      statusCode: 503,
      retryable: false,
      provider: options.provider,
    })
  );
}
