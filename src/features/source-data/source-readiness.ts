export type SourceDataReadinessInput = {
  verified: boolean;
  hasRoutes: boolean;
  hasVisibleBureaus: boolean;
  affidavitReady: boolean;
  customReady: boolean;
};

export function firstSourceDataReadinessBlocker(input: SourceDataReadinessInput): string | null {
  if (!input.verified) return 'Standardize the working Notepad draft before reviewing packet scope.';
  if (!input.affidavitReady) return 'Affidavit execution jurisdiction could not be mapped from the current address.';
  if (!input.customReady) return 'Complete the additional template fields required by the configured DOCX template.';
  if (!input.hasRoutes || !input.hasVisibleBureaus) return 'No dispute, inquiry, or late-payment routes were detected. Review the Notepad headings before continuing.';
  return null;
}
