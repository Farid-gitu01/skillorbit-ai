import { type Response } from 'express';
import { type ApiErrorResponse, type ApiFieldError, type ApiResponse, type ApiSuccessResponse, type PaginationMeta } from '../types/api-response.js';

export const sendSuccess = <T>(
  res: Response,
  status: number,
  data: T,
  message?: string
): Response<ApiSuccessResponse<T>> => {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(message ? { message } : {}),
  };
  return res.status(status).json(body);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message?: string
): Response<ApiSuccessResponse<T>> => sendSuccess(res, 201, data, message);

export const sendMessage = (
  res: Response,
  status: number,
  message: string
): Response<ApiSuccessResponse> => res.status(status).json({ success: true, message });

export const sendPaginated = <T>(
  res: Response,
  status: number,
  data: T,
  meta: PaginationMeta,
  message?: string
): Response<ApiSuccessResponse<T, PaginationMeta>> => {
  const body: ApiSuccessResponse<T, PaginationMeta> = {
    success: true,
    data,
    meta,
    ...(message ? { message } : {}),
  };
  return res.status(status).json(body);
};

export const sendError = (
  res: Response,
  status: number,
  message: string,
  options: { code?: string; errors?: ApiFieldError[] } = {}
): Response<ApiErrorResponse> => {
  const body: ApiErrorResponse = {
    success: false,
    message,
    code: options.code ?? `HTTP_${status}`,
    ...(options.errors?.length ? { errors: options.errors } : {}),
  };
  return res.status(status).json(body);
};

export const sendEmptySuccess = sendMessage;

export type { ApiResponse, ApiErrorResponse, ApiSuccessResponse, ApiFieldError, PaginationMeta };
