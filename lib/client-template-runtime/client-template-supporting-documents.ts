export function validateSupportingDocuments(input: { packetScope: Record<string, unknown>; supportingDocuments: Array<Record<string, unknown>> }) {
  const rawRequired = input.packetScope.requiredSupportingDocuments;
  const required = Array.isArray(rawRequired) ? rawRequired.map(String) : [];
  const available = new Set(input.supportingDocuments.map((doc) => String(doc.kind || doc.type || '')).filter(Boolean));
  const missing = required.filter((kind) => !available.has(kind));
  return {
    ok: missing.length === 0,
    missing,
    available: Array.from(available),
    reason: missing.length ? `Missing supporting documents: ${missing.join(', ')}` : 'Supporting documents are ready.'
  };
}
