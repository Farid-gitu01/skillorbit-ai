import { type z } from 'zod';
import { DEFAULT_AI_MAX_OUTPUT_CHARS } from './ai.config.js';
import { AiProviderError } from './ai.errors.js';

/**
 * Strips surrounding markdown code fences cleanly without backtracking regex risks.
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1) {
    return trimmed;
  }

  const lastFence = trimmed.lastIndexOf('```');
  if (lastFence <= firstNewline) {
    return trimmed;
  }

  return trimmed.slice(firstNewline + 1, lastFence).trim();
}

/**
 * Finds the first balanced JSON object or array span while respecting string escapes.
 */
function extractBalancedJsonSubstring(text: string): string | null {
  let startIndex = -1;
  let openChar = '';
  let closeChar = '';

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      startIndex = i;
      openChar = ch;
      closeChar = ch === '{' ? '}' : ']';
      break;
    }
  }

  if (startIndex === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

/**
 * Safely enforces output length bounds and extracts parsed JSON from model text.
 */
export function extractJsonPayload(
  rawText: string,
  maxOutputChars: number = DEFAULT_AI_MAX_OUTPUT_CHARS,
  provider?: string
): unknown {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new AiProviderError('AI provider returned an empty response.', {
      code: 'AI_RESPONSE_INVALID',
      statusCode: 502,
      retryable: false,
      provider,
    });
  }

  if (rawText.length > maxOutputChars) {
    throw new AiProviderError('AI provider text output exceeded maximum allowed character limit.', {
      code: 'AI_RESPONSE_TOO_LARGE',
      statusCode: 502,
      retryable: false,
      provider,
    });
  }

  const candidate = stripCodeFence(rawText);

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const balanced = extractBalancedJsonSubstring(candidate);
    if (balanced) {
      try {
        return JSON.parse(balanced) as unknown;
      } catch {
        // Fall through to safe invalid-response error
      }
    }
  }

  throw new AiProviderError('AI provider did not return valid JSON output.', {
    code: 'AI_RESPONSE_INVALID',
    statusCode: 502,
    retryable: false,
    provider,
  });
}

/**
 * Parses model output as JSON and validates it strictly against a Zod schema.
 * Never echoes raw model text or unexpected values in error messages.
 */
export function parseStructuredAiOutput<TSchema extends z.ZodTypeAny>(
  rawText: string,
  schema: TSchema,
  options: { maxOutputChars?: number; provider?: string } = {}
): z.infer<TSchema> {
  const maxChars = options.maxOutputChars ?? DEFAULT_AI_MAX_OUTPUT_CHARS;
  const parsed = extractJsonPayload(rawText, maxChars, options.provider);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    const failedFields = result.error.issues
      .map((issue) => (issue.path.length > 0 ? issue.path.map(String).join('.') : 'root'))
      .slice(0, 5);
    const fieldSummary =
      failedFields.length > 0 ? ` Fields: ${failedFields.join(', ')}.` : '';

    throw new AiProviderError(
      `AI provider output failed structured schema validation.${fieldSummary}`,
      {
        code: 'AI_OUTPUT_VALIDATION_FAILED',
        statusCode: 502,
        retryable: false,
        provider: options.provider,
      }
    );
  }

  return result.data;
}
