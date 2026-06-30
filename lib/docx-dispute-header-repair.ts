import type { ReferenceDisputeValues } from './docx-renderer';
import { normalizeDisputeLetterHeader } from './docx-letter-header-normalizer';

export async function repairDisputeStaticHeaderDuplication(blob: Blob, values: ReferenceDisputeValues): Promise<Blob> {
  const normalized = await normalizeDisputeLetterHeader(blob, values);
  return normalized.blob;
}
