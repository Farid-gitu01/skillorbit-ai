/**
 * Standard successful API response envelope emitted by the SkillOrbit AI backend
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Field-level validation error structure
 */
export interface ApiFieldError {
  field: string;
  message: string;
}

/**
 * Standard error response envelope emitted by the SkillOrbit AI backend
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: ApiFieldError[];
}

/**
 * Standard pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * Paginated API response envelope
 */
export interface PaginatedResponse<T> {
  success: boolean;
  message?: string;
  data: T[];
  meta?: {
    pagination?: PaginationMeta;
    [key: string]: unknown;
  };
}
