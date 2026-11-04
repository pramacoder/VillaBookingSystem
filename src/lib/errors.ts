import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DateConflictError, isExclusionViolation } from "./db-constraints";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DATE_CONFLICT"
  | "INVALID_TRANSITION"
  | "VERSION_CONFLICT"
  | "HAS_DEPENDENCIES"
  | "BUSINESS_RULE"
  | "RATE_LIMITED"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Request validation failed.", fields?: Record<string, string>) {
    super("VALIDATION_ERROR", 400, message, fields ? { fields } : undefined);
    this.name = "ValidationError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication is required.") {
    super("UNAUTHENTICATED", 401, message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super("FORBIDDEN", 403, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super("NOT_FOUND", 404, message);
    this.name = "NotFoundError";
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = "Too many requests. Please try again later.") {
    super("RATE_LIMITED", 429, message, { retryAfterSeconds });
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function generateRequestId(): string {
  return `req_${crypto.randomBytes(8).toString("hex")}`;
}

export function resolveRequestId(request?: Request | null): string {
  const fromHeader = request?.headers.get("x-request-id")?.trim();
  return fromHeader && fromHeader.length > 0 ? fromHeader : generateRequestId();
}

export function formatZodError(error: ZodError): ValidationError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!fields[key]) {
      fields[key] = issue.message;
    }
  }
  return new ValidationError("Invalid request payload.", fields);
}

export function toErrorResponse(
  error: unknown,
  options: { requestId?: string; isAdminRoute?: boolean } = {},
): NextResponse {
  const requestId = options.requestId ?? generateRequestId();
  const headers = new Headers({
    "x-request-id": requestId,
  });

  if (options.isAdminRoute) {
    headers.set("Cache-Control", "no-store");
  }

  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
    if (error instanceof RateLimitedError) {
      headers.set("Retry-After", String(error.retryAfterSeconds));
    }
  } else if (error instanceof ZodError) {
    appError = formatZodError(error);
  } else if (error instanceof DateConflictError || isExclusionViolation(error)) {
    appError = new AppError("DATE_CONFLICT", 409, "The selected dates are no longer available.");
  } else {
    appError = new AppError("INTERNAL", 500, "An unexpected server error occurred.");
  }

  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details ? { details: appError.details } : {}),
        requestId,
      },
    },
    {
      status: appError.status,
      headers,
    },
  );
}

export function createJsonResponse<T>(
  payload: T,
  options: {
    status?: number;
    requestId?: string;
    isAdminRoute?: boolean;
  } = {},
): NextResponse {
  const requestId = options.requestId ?? generateRequestId();
  const headers = new Headers({
    "x-request-id": requestId,
  });

  if (options.isAdminRoute) {
    headers.set("Cache-Control", "no-store");
  }

  return NextResponse.json(payload, {
    status: options.status ?? 200,
    headers,
  });
}
