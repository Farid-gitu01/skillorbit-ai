import { type ApiFieldError } from '../types/api-response.js';

export interface ApplicationErrorOptions {
  statusCode: number;
  code: string;
  errors?: ApiFieldError[];
  operational?: boolean;
}

export class ApplicationError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly errors?: ApiFieldError[];
  readonly operational: boolean;

  constructor(message: string, options: ApplicationErrorOptions) {
    if (!Number.isInteger(options.statusCode) || options.statusCode < 400 || options.statusCode > 599) {
      throw new RangeError('ApplicationError statusCode must be an integer from 400 to 599');
    }
    if (!options.code.trim()) {
      throw new Error('ApplicationError code must not be empty');
    }
    super(message);
    this.name = 'ApplicationError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.errors = options.errors;
    this.operational = options.operational ?? true;
    Error.captureStackTrace?.(this, ApplicationError);
  }
}
