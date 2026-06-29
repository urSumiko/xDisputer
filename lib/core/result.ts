export type AppErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'AI_ERROR'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_ERROR';

export type AppError = {
  code: AppErrorCode;
  message: string;
  details?: unknown;
};

export type FailureResult = { ok: false; error: AppError };

export type Result<T> =
  | { ok: true; data: T }
  | FailureResult;

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(code: AppErrorCode, message: string, details?: unknown): FailureResult {
  return { ok: false, error: { code, message, details } };
}

export function statusForErrorCode(code: AppErrorCode): number {
  switch (code) {
    case 'BAD_REQUEST':
    case 'VALIDATION_ERROR':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'RATE_LIMITED':
      return 429;
    case 'AI_ERROR':
    case 'DATABASE_ERROR':
    case 'EXTERNAL_SERVICE_ERROR':
    case 'CONFIGURATION_ERROR':
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}

export function safeMessage(error: unknown, fallback = 'Unexpected error.'): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  if (typeof error === 'string') return error.slice(0, 300);
  return fallback;
}
