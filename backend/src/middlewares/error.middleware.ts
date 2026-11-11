import { type ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { ApplicationError } from '../utils/application-error.js';
import { sendError } from '../utils/api-response.util.js';

interface NormalizedError {
  statusCode: number;
  message: string;
  code: string;
  errors?: Array<{ field: string; message: string }>;
  operational: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeZodError = (error: ZodError): NormalizedError => ({
  statusCode: 400,
  message: 'Request validation failed',
  code: 'VALIDATION_ERROR',
  errors: error.issues.map((issue) => ({
    field: issue.path.map(String).join('.'),
    message: 'Invalid value',
  })),
  operational: true,
});

const normalizeMongooseValidationError = (error: mongoose.Error.ValidationError): NormalizedError => ({
  statusCode: 400,
  message: 'Database validation failed',
  code: 'VALIDATION_ERROR',
  errors: Object.keys(error.errors).map((field) => ({ field, message: 'Invalid value' })),
  operational: true,
});

const getDuplicateKeyFields = (error: Record<string, unknown>): string[] => {
  const keyPattern = isRecord(error.keyPattern) ? Object.keys(error.keyPattern) : [];
  const keyValue = isRecord(error.keyValue) ? Object.keys(error.keyValue) : [];
  return [...new Set([...keyPattern, ...keyValue])];
};

const normalizeExpressParserError = (error: Record<string, unknown>): NormalizedError | undefined => {
  const status = typeof error.status === 'number' ? error.status : undefined;
  const type = typeof error.type === 'string' ? error.type : undefined;

  if (type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'Malformed request body', code: 'MALFORMED_REQUEST', operational: true };
  }
  if (type === 'entity.too.large') {
    return { statusCode: 413, message: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE', operational: true };
  }
  if (status === 400) {
    return { statusCode: 400, message: 'Bad request', code: 'BAD_REQUEST', operational: true };
  }
  if (status === 413) {
    return { statusCode: 413, message: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE', operational: true };
  }
  return undefined;
};

export const normalizeError = (error: unknown): NormalizedError => {
  if (error instanceof ApplicationError) {
    if (!error.operational || error.statusCode >= 500) {
      return { statusCode: 500, message: 'Internal Server Error', code: 'INTERNAL_SERVER_ERROR', operational: false };
    }
    return {
      statusCode: error.statusCode,
      message: error.message,
      code: error.code,
      ...(error.errors?.length ? { errors: error.errors } : {}),
      operational: true,
    };
  }

  if (error instanceof ZodError) return normalizeZodError(error);
  if (error instanceof mongoose.Error.ValidationError) return normalizeMongooseValidationError(error);
  if (error instanceof mongoose.Error.CastError) {
    return { statusCode: 400, message: 'Invalid request value', code: 'INVALID_ID', operational: true };
  }
  if (isRecord(error) && error.code === 11000) {
    const fields = getDuplicateKeyFields(error);
    return {
      statusCode: 409,
      message: 'A record with this value already exists',
      code: 'DUPLICATE_KEY',
      ...(fields.length ? { errors: fields.map((field) => ({ field, message: 'Already exists' })) } : {}),
      operational: true,
    };
  }
  if (error instanceof jwt.TokenExpiredError) {
    return { statusCode: 401, message: 'Invalid or expired authentication', code: 'INVALID_AUTHENTICATION', operational: true };
  }
  if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.NotBeforeError) {
    return { statusCode: 401, message: 'Invalid authentication', code: 'INVALID_AUTHENTICATION', operational: true };
  }
  if (isRecord(error)) {
    const parserError = normalizeExpressParserError(error);
    if (parserError) return parserError;
    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      return {
        statusCode: error.statusCode,
        message: 'Request failed',
        code: `HTTP_${error.statusCode}`,
        operational: true,
      };
    }
  }

  return { statusCode: 500, message: 'Internal Server Error', code: 'INTERNAL_SERVER_ERROR', operational: false };
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalized = normalizeError(error);
  if (!normalized.operational) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error('[api:error]', {
      method: req.method,
      path: req.path,
      name: errorName,
      code: normalized.code,
    });
  }

  sendError(res, normalized.statusCode, normalized.message, {
    code: normalized.code,
    errors: normalized.errors,
  });
};
