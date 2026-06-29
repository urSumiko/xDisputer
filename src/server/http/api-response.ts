import { NextResponse } from 'next/server';
import type { ServiceErrorCode, ServiceResult } from '../contracts/service-result';

const statusByCode: Record<ServiceErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_error: 422,
  storage_error: 502,
  database_error: 502,
  unexpected_error: 500
};

function rawJsonPayload<TData>(data: TData): TData | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;
  if (payload.__rawJson !== true) return null;
  const { __rawJson, ...rest } = payload;
  void __rawJson;
  return rest as TData;
}

export function jsonFromServiceResult<TData>(result: ServiceResult<TData>): NextResponse {
  if (result.ok) {
    return NextResponse.json(rawJsonPayload(result.data) ?? { ok: true, data: result.data }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  return NextResponse.json(
    { ok: false, error: result.error },
    {
      status: statusByCode[result.error.code],
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    }
  );
}

export function jsonOk<TData>(data: TData): NextResponse {
  return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
