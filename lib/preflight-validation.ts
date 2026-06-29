import type { LetterRoute, ParsedSource } from './letter-engine';
import type { PacketAssets } from './packet-assets';
import type { LetterReference } from './reference-store';
import type { TemplateExhibits } from './template-exhibits';
import type { WorkspacePreferences } from './workspace-preferences';
import { READINESS_CHECKLIST_DISABLED, READINESS_CHECKLIST_DISABLED_REASON } from './readiness-checklist-control';

export type PreflightSeverity = 'pass' | 'warning' | 'blocker';

export type PreflightCheck = {
  id: string;
  label: string;
  severity: PreflightSeverity;
  detail: string;
};

export type GenerationPreflightInput = {
  round?: string | null;
  source: string;
  normalized: boolean;
  parsed: ParsedSource;
  routes: LetterRoute[];
  references: LetterReference[];
  templates: TemplateExhibits;
  evidence: PacketAssets;
  affidavitReady: boolean;
  customReady: boolean;
  strictValidation: boolean;
  preferences?: WorkspacePreferences;
};

export type GenerationPreflightResult = {
  ready: boolean;
  blockers: PreflightCheck[];
  warnings: PreflightCheck[];
  checks: PreflightCheck[];
  summary: string;
};

const DISABLED_PREFLIGHT_RESULT: GenerationPreflightResult = {
  ready: true,
  blockers: [],
  warnings: [],
  checks: [],
  summary: READINESS_CHECKLIST_DISABLED_REASON
};

export function evaluateGenerationPreflight(_input: GenerationPreflightInput): GenerationPreflightResult {
  if (READINESS_CHECKLIST_DISABLED) return DISABLED_PREFLIGHT_RESULT;

  // Keep a safe default if the checklist is re-enabled before the previous rule engine is restored.
  // This prevents accidental generation blocking while the readiness checklist remains under owner review.
  return DISABLED_PREFLIGHT_RESULT;
}

export function preflightFailureMessage(_result: GenerationPreflightResult) {
  return '';
}
