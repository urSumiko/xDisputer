export type PacketReadyInput = {
  canGenerate: boolean;
  evidenceReady: boolean;
  affidavitReady: boolean;
  customReady: boolean;
  strictTemplateReady: boolean;
  scopeConfirmed: boolean;
};

export function packetIsReady(input: PacketReadyInput) {
  return input.canGenerate && input.evidenceReady && input.affidavitReady && input.customReady && input.strictTemplateReady && input.scopeConfirmed;
}

export function uniqueBlockers(reasons: string[]) {
  return Array.from(new Set(reasons.map((reason) => reason.trim()).filter(Boolean))).slice(0, 8);
}
