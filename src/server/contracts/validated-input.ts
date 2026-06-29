import { serviceFailure, serviceSuccess, type ServiceResult } from './service-result';

export type SafeParseSuccess<TData> = {
  success: true;
  data: TData;
};

export type SafeParseFailure = {
  success: false;
  error: unknown;
};

export type SafeParseContract<TData> = {
  safeParse: (input: unknown) => SafeParseSuccess<TData> | SafeParseFailure;
};

export function validateInput<TData>(contract: SafeParseContract<TData>, input: unknown): ServiceResult<TData> {
  const parsed = contract.safeParse(input);
  if (parsed.success) return serviceSuccess(parsed.data);

  return serviceFailure('validation_error', 'Input validation failed.', {
    source: 'validated-input',
    error: parsed.error
  });
}
