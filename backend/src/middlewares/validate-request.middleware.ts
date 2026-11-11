import { type RequestHandler } from 'express';
import { z } from 'zod';
import { sendError } from '../utils/api-response.util.js';

type RequestPart = 'body' | 'params' | 'query';
type RequestSchemas = Partial<Record<RequestPart, z.ZodType>>;
type ValidationError = { field: string; message: string };

/**
 * Validate one or more Express request parts and replace them with parsed data.
 * Parsed values are only committed when every configured schema succeeds.
 */
export const validateRequest = (
  schemas: RequestSchemas,
  message = 'Request validation failed'
): RequestHandler => (req, res, next) => {
  const parsed: Partial<Record<RequestPart, unknown>> = {};
  const errors: ValidationError[] = [];

  for (const part of ['body', 'params', 'query'] as const) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part]);
    if (result.success) {
      parsed[part] = result.data;
      continue;
    }

    for (const issue of result.error.issues) {
      if (issue.code === 'unrecognized_keys') {
        errors.push(...issue.keys.map((key) => ({ field: key, message: 'Unrecognized field' })));
      } else {
        errors.push({
          field: issue.path.map(String).join('.'),
          message: issue.message,
        });
      }
    }
  }

  if (errors.length > 0) {
    sendError(res, 400, message, { code: 'VALIDATION_ERROR', errors });
    return;
  }

  for (const part of ['body', 'params', 'query'] as const) {
    if (!Object.hasOwn(parsed, part)) continue;
    Object.defineProperty(req, part, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: parsed[part],
    });
  }

  next();
};
