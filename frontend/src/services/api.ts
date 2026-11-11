import axios, { type AxiosError, type AxiosInstance } from 'axios';
import type { ApiErrorResponse } from '../types/api.types';

const baseURL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';

/**
 * SkillOrbit AI centralized Axios HTTP client.
 *
 * Configured with:
 * - Environment-driven baseURL
 * - JSON content type headers
 * - withCredentials: true (enables HttpOnly session cookie transmission)
 * - Standardized response and error interceptors
 */
export const api: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 15000,
});

/**
 * Standard client-facing error representation
 */
export class ApiClientError extends Error {
  public readonly statusCode?: number;
  public readonly code?: string;
  public readonly errors?: Array<{ field: string; message: string }>;
  public readonly raw?: unknown;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      code?: string;
      errors?: Array<{ field: string; message: string }>;
      raw?: unknown;
    }
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = options?.statusCode;
    this.code = options?.code;
    this.errors = options?.errors;
    this.raw = options?.raw;
  }
}

/**
 * Normalizes Axios errors into a predictable ApiClientError matching the backend error envelope.
 */
export function normalizeApiError(error: unknown): ApiClientError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const responseData = axiosError.response?.data;
    const statusCode = axiosError.response?.status;

    if (responseData && typeof responseData === 'object' && 'message' in responseData) {
      return new ApiClientError(responseData.message || 'An error occurred', {
        statusCode,
        code: responseData.code,
        errors: responseData.errors,
        raw: axiosError,
      });
    }

    if (axiosError.code === 'ECONNABORTED') {
      return new ApiClientError('Request timed out. Please try again.', {
        statusCode: 408,
        code: 'REQUEST_TIMEOUT',
        raw: axiosError,
      });
    }

    if (!axiosError.response) {
      return new ApiClientError('Unable to connect to the server. Please check your network connection.', {
        statusCode: 0,
        code: 'NETWORK_ERROR',
        raw: axiosError,
      });
    }

    return new ApiClientError(axiosError.message || 'An unexpected network error occurred', {
      statusCode,
      code: 'HTTP_ERROR',
      raw: axiosError,
    });
  }

  if (error instanceof Error) {
    return new ApiClientError(error.message, { code: 'CLIENT_ERROR', raw: error });
  }

  return new ApiClientError('An unexpected error occurred', { code: 'UNKNOWN_ERROR', raw: error });
}

// Request interceptor foundation
api.interceptors.request.use(
  (config) => {
    // Note: HttpOnly cookie authentication is used.
    // Never store or inject Bearer JWT tokens from localStorage/sessionStorage.
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor foundation: normalize API error responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalizeApiError(error);
    return Promise.reject(normalized);
  }
);

export default api;
