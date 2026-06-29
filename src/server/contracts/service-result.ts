export type ServiceErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_error'
  | 'storage_error'
  | 'database_error'
  | 'unexpected_error';

export type ServiceError = {
  code: ServiceErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type ServiceSuccess<TData> = {
  ok: true;
  data: TData;
};

export type ServiceFailure = {
  ok: false;
  error: ServiceError;
};

export type ServiceResult<TData> = ServiceSuccess<TData> | ServiceFailure;

export function serviceSuccess<TData>(data: TData): ServiceSuccess<TData> {
  return { ok: true, data };
}

export function serviceFailure(code: ServiceErrorCode, message: string, details?: Record<string, unknown>): ServiceFailure {
  return {
    ok: false,
    error: details ? { code, message, details } : { code, message }
  };
}

export function isServiceSuccess<TData>(result: ServiceResult<TData>): result is ServiceSuccess<TData> {
  return result.ok;
}
