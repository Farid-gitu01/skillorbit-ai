import { type Response } from 'express';
import { ZodError } from 'zod';
import { AiProviderError, redactAiSecrets } from '../ai.errors.js';
import { sendError } from '../../../utils/api-response.util.js';
import { ApplicationError } from '../../../utils/application-error.js';

export interface SafeHttpErrorDescriptor {
  statusCode: number;
  code: string;
  message: string;
}

/**
 * Maps internal AI, validation, and operational errors into safe HTTP responses
 * without leaking provider secrets, stack traces, or raw third-party responses.
 */
export function mapAiErrorToHttpDescriptor(err: unknown): SafeHttpErrorDescriptor {
  if (err instanceof AiProviderError) {
    switch (err.code) {
      case 'AI_NOT_CONFIGURED':
      case 'AI_API_KEY_MISSING':
      case 'AI_INVALID_CONFIGURATION':
      case 'AI_UNSUPPORTED_PROVIDER':
      case 'AI_AUTHENTICATION_FAILED':
      case 'AI_PROVIDER_UNAVAILABLE':
        return {
          statusCode: 503,
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'AI assistant services are temporarily unavailable. Please try again later.',
        };
      case 'AI_RATE_LIMITED':
        return {
          statusCode: 429,
          code: 'AI_RATE_LIMITED',
          message: 'AI service rate limit reached. Please wait a moment before trying again.',
        };
      case 'AI_TIMEOUT':
        return {
          statusCode: 504,
          code: 'AI_TIMEOUT',
          message: 'The AI request took too long to complete. Please try again.',
        };
      case 'AI_INVALID_REQUEST':
        return {
          statusCode: 400,
          code: 'AI_INVALID_REQUEST',
          message: redactAiSecrets(err.message) || 'Invalid AI request input.',
        };
      case 'AI_RESPONSE_INVALID':
      case 'AI_RESPONSE_TOO_LARGE':
      case 'AI_OUTPUT_VALIDATION_FAILED':
        return {
          statusCode: 502,
          code: 'AI_INVALID_RESPONSE',
          message: 'AI service returned an unexpected format. Please retry your request.',
        };
    }
  }

  if (err instanceof ApplicationError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: redactAiSecrets(err.message),
    };
  }

  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: err.issues[0]?.message ?? 'Invalid request payload.',
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred while processing the AI request.',
  };
}

export function handleAiControllerError(res: Response, err: unknown): void {
  const mapped = mapAiErrorToHttpDescriptor(err);
  if (err instanceof ZodError) {
    sendError(res, 400, mapped.message, {
      code: mapped.code,
      errors: err.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof ApplicationError && err.errors) {
    sendError(res, mapped.statusCode, mapped.message, {
      code: mapped.code,
      errors: err.errors,
    });
    return;
  }

  sendError(res, mapped.statusCode, mapped.message, { code: mapped.code });
}
