import { modernizationStatusKey, loadModernizationStatus, type ModernizationStatusPayload } from './modernization-status-client';

export const modernizationStatusQuery = {
  queryKey: modernizationStatusKey,
  queryFn: loadModernizationStatus,
  staleTime: 30_000
} as const;

export type { ModernizationStatusPayload };
