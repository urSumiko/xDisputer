export const modernizationStatusKey = ['system', 'modernization-status'] as const;

export type ModernizationStatusPayload = {
  ok: boolean;
  data?: {
    layer: 'modernization-boundary';
    status: string;
    coded: readonly string[];
    deferred: readonly string[];
    nextAction: string;
  };
  error?: {
    code: string;
    message: string;
  };
};

export async function loadModernizationStatus(): Promise<ModernizationStatusPayload> {
  const response = await fetch('/api/system/modernization', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });

  const payload = await response.json() as ModernizationStatusPayload;
  if (!response.ok) {
    return payload.error ? payload : { ok: false, error: { code: 'request_failed', message: 'Unable to load modernization status.' } };
  }

  return payload;
}
