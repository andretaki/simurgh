import { NextResponse } from "next/server";
import { logger } from "./logger";
import { apiError, apiSuccess, apiValidationError, ApiSuccessResponse, ApiErrorResponse } from "./api-response";
import { ZodError, ZodSchema } from "zod";

/**
 * API Handler Wrapper
 *
 * Provides consistent error handling, logging, and response formatting
 * for all API routes. Ensures type-safe error handling and standardized responses.
 */

export interface ApiContext {
  route: string;
  method: string;
}

/**
 * Custom API Error class for throwing structured errors
 */
export class ApiHandlerError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiHandlerError";
  }
}

/**
 * Type guard to check if error is an instance of Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiHandlerError) {
    return error.message;
  }
  if (error instanceof ZodError) {
    return "Validation failed";
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

/**
 * Get error status code from error type
 */
function getErrorStatusCode(error: unknown): number {
  if (error instanceof ApiHandlerError) {
    return error.statusCode;
  }
  if (error instanceof ZodError) {
    return 400;
  }
  return 500;
}

/**
 * Get error details for logging/response
 */
function getErrorDetails(error: unknown): unknown {
  if (error instanceof ApiHandlerError) {
    return error.details;
  }
  if (error instanceof ZodError) {
    return error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));
  }
  return undefined;
}

/**
 * Wrap an async handler with standardized error handling
 *
 * @example
 * export async function GET(request: Request) {
 *   return withErrorHandling(
 *     async () => {
 *       const data = await fetchData();
 *       return data;
 *     },
 *     { route: "/api/example", method: "GET" }
 *   );
 * }
 */
export async function withErrorHandling<T>(
  handler: () => Promise<T>,
  context: ApiContext
): Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>> {
  try {
    const result = await handler();
    return apiSuccess(result);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const statusCode = getErrorStatusCode(error);
    const details = getErrorDetails(error);

    logger.error(`API Error [${context.method} ${context.route}]`, error, {
      statusCode,
      details,
    });

    if (error instanceof ZodError) {
      return apiValidationError(message, details);
    }

    return apiError(message, statusCode, details);
  }
}

/**
 * Parse and validate request body with Zod schema
 *
 * @example
 * const body = await parseRequestBody(request, MySchema);
 */
export async function parseRequestBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

/**
 * Safe parse request body - returns result object instead of throwing
 */
export async function safeParseRequestBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: ZodError }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  } catch {
    return {
      success: false,
      error: new ZodError([
        {
          code: "custom",
          path: [],
          message: "Invalid JSON body",
        },
      ]),
    };
  }
}

/**
 * Create a not found error that can be thrown in handlers
 */
export function notFound(resource = "Resource"): never {
  throw new ApiHandlerError(`${resource} not found`, 404);
}

/**
 * Create a validation error that can be thrown in handlers
 */
export function validationError(message: string, details?: unknown): never {
  throw new ApiHandlerError(message, 400, details);
}

/**
 * Create an unauthorized error that can be thrown in handlers
 */
export function unauthorized(message = "Unauthorized"): never {
  throw new ApiHandlerError(message, 401);
}

/**
 * Create a forbidden error that can be thrown in handlers
 */
export function forbidden(message = "Forbidden"): never {
  throw new ApiHandlerError(message, 403);
}
