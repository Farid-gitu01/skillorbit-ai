import {
  AiProviderError,
  mapTransportErrorToAiError,
  mapUpstreamStatusToAiError,
  redactAiSecrets,
} from './ai.errors.js';
import { type AiHttpClient, type SleepFn } from './ai.types.js';

export const DEFAULT_AI_MAX_RESPONSE_BYTES = 1_048_576; // 1 MiB safe JSON response cap

export interface AiJsonRequestOptions {
  provider: string;
  model?: string;
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  maxRetries: number;
  maxResponseBytes?: number;
  httpClient?: AiHttpClient;
  sleep?: SleepFn;
}

function sanitizeDiagnosticUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl.split('?')[0] ?? rawUrl;
  }
}

async function readSanitizedErrorSnippet(response: Response): Promise<string | undefined> {
  if (typeof response.text !== 'function') return undefined;
  try {
    const text = await response.text();
    const compact = text.replace(/\s+/g, ' ').trim();
    if (!compact) return undefined;
    return redactAiSecrets(compact.slice(0, 800));
  } catch {
    return undefined;
  }
}

export interface AiJsonResponse<TData> {
  data: TData;
  latencyMs: number;
}

const defaultSleep: SleepFn = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

async function readBoundedResponseJson(
  response: Response,
  maxBytes: number,
  provider: string
): Promise<unknown> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength.trim())) {
    const contentLength = Number.parseInt(declaredLength.trim(), 10);
    if (contentLength > maxBytes) {
      await response.body?.cancel().catch(() => {});
      throw new AiProviderError('AI provider HTTP response exceeded maximum allowed byte limit.', {
        code: 'AI_RESPONSE_TOO_LARGE',
        statusCode: 502,
        retryable: false,
        provider,
      });
    }
  }

  let rawText: string;
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new AiProviderError('AI provider HTTP response exceeded maximum allowed byte limit.', {
            code: 'AI_RESPONSE_TOO_LARGE',
            statusCode: 502,
            retryable: false,
            provider,
          });
        }
        chunks.push(decoder.decode(value, { stream: true }));
      }
    }
    chunks.push(decoder.decode());
    rawText = chunks.join('');
  } else {
    rawText = await response.text();
    if (Buffer.byteLength(rawText, 'utf8') > maxBytes) {
      throw new AiProviderError('AI provider HTTP response exceeded maximum allowed byte limit.', {
        code: 'AI_RESPONSE_TOO_LARGE',
        statusCode: 502,
        retryable: false,
        provider,
      });
    }
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    throw new AiProviderError('AI provider returned an unreadable response payload.', {
      code: 'AI_RESPONSE_INVALID',
      statusCode: 502,
      retryable: false,
      provider,
    });
  }
}

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
    let loggedAttemptFailure = false;
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
        const upstreamSnippet = await readSanitizedErrorSnippet(response);
        console.error(
          '[ai:http] Upstream HTTP failure:',
          JSON.stringify({
            provider: options.provider,
            ...(options.model ? { model: options.model } : {}),
            url: sanitizeDiagnosticUrl(options.url),
            upstreamStatus: response.status,
            errorCode: mappedError.code,
            timeoutMs: options.timeoutMs,
            didTimeout,
            attempt,
            maxAttempts,
            ...(upstreamSnippet ? { upstreamBody: upstreamSnippet } : {}),
          })
        );
        loggedAttemptFailure = true;
        throw mappedError;
      }

      const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_AI_MAX_RESPONSE_BYTES;
      const parsedBody = await readBoundedResponseJson(
        response,
        maxResponseBytes,
        options.provider
      );

      return {
        data: parsedBody as TData,
        latencyMs: Math.max(0, Date.now() - startedAt),
      };
    } catch (error) {
      const mapped = mapTransportErrorToAiError(options.provider, error, didTimeout);
      lastError = mapped;

      if (!loggedAttemptFailure) {
        const rawErrMessage =
          error instanceof Error ? redactAiSecrets(`${error.name}: ${error.message}`) : 'UnknownError';
        console.error(
          '[ai:http] Transport/boundary failure:',
          JSON.stringify({
            provider: options.provider,
            ...(options.model ? { model: options.model } : {}),
            url: sanitizeDiagnosticUrl(options.url),
            errorCode: mapped.code,
            timeoutMs: options.timeoutMs,
            didTimeout,
            attempt,
            maxAttempts,
            cause: rawErrMessage,
          })
        );
      }

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
