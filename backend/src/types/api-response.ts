export interface ApiFieldError {
  field: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiSuccessResponse<T = never, M = never> {
  success: true;
  message?: string;
  data?: T;
  meta?: M;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: ApiFieldError[];
}

export type ApiResponse<T = never, M = never> = ApiSuccessResponse<T, M> | ApiErrorResponse;
