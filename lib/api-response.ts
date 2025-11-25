import { NextResponse } from "next/server";

/**
 * Standardized API Response Helper
 *
 * All API responses should follow this format:
 * - Success: { success: true, data: T }
 * - Error: { success: false, error: string, details?: unknown }
 * - Paginated: { success: true, data: T[], pagination: PaginationMeta }
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a successful API response
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Create a successful paginated API response
 */
export function apiPaginated<T>(
  data: T[],
  pagination: PaginationMeta,
  status = 200
): NextResponse<ApiPaginatedResponse<T>> {
  return NextResponse.json({ success: true, data, pagination }, { status });
}

/**
 * Create an error API response
 */
export function apiError(
  error: string,
  status = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false, error, details }, { status });
}

/**
 * Create a validation error response (400)
 */
export function apiValidationError(
  error: string,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return apiError(error, 400, details);
}

/**
 * Create a not found error response (404)
 */
export function apiNotFound(resource = "Resource"): NextResponse<ApiErrorResponse> {
  return apiError(`${resource} not found`, 404);
}

/**
 * Create an unauthorized error response (401)
 */
export function apiUnauthorized(message = "Unauthorized"): NextResponse<ApiErrorResponse> {
  return apiError(message, 401);
}

/**
 * Create a forbidden error response (403)
 */
export function apiForbidden(message = "Forbidden"): NextResponse<ApiErrorResponse> {
  return apiError(message, 403);
}

/**
 * Create a server error response (500)
 */
export function apiServerError(
  error?: unknown,
  message = "Internal server error"
): NextResponse<ApiErrorResponse> {
  const details = error instanceof Error ? error.message : error;
  return apiError(message, 500, details);
}

/**
 * Helper to create pagination meta from query results
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  totalCount: number
): PaginationMeta {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    page,
    limit,
    totalPages,
    totalCount,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
