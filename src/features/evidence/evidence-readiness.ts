export type EvidenceReadinessInput = {
  supportingCount: number;
};

export type EvidenceReadiness = {
  ready: boolean;
  blocker: string | null;
};

export function readEvidenceReadiness(input: EvidenceReadinessInput): EvidenceReadiness {
  const ready = input.supportingCount > 0;
  return {
    ready,
    blocker: ready ? null : 'Upload at least one supporting document image.'
  };
}
