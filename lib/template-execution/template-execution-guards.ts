import type { LetterRoute, ParsedSource } from '../letter-engine';
import type { LetterReference, Round } from '../reference-store';
import type { TemplateExhibits } from '../template-exhibits';
import { ManagerTemplateResolver } from './manager-template-resolver';

export type TemplateExecutionGuardResult = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  summary: string;
};

function validationStatus(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

export function evaluateTemplateExecutionGuards(input: {
  round: Round;
  source: string;
  normalized: boolean;
  parsed: ParsedSource;
  routes: LetterRoute[];
  references: LetterReference[];
  templates: TemplateExhibits;
  resolver: ManagerTemplateResolver;
}): TemplateExecutionGuardResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!input.source.trim()) blockers.push('Source data is empty.');
  if (!input.normalized) blockers.push('Source data must be standardized before generation.');
  if (!input.parsed.name?.trim()) blockers.push('Client name is missing from the parsed source.');
  if (!input.routes.length) blockers.push('No actionable routes were detected.');

  for (const duplicate of input.resolver.duplicateActiveSlots()) {
    warnings.push(`Multiple active assets exist for ${duplicate.slotKey}. Resolver will use the freshest active asset.`);
  }

  for (const summary of input.resolver.templateSummary()) {
    if (summary.source === 'MISSING') blockers.push(`${summary.label} is missing for ${input.round}.`);
    const status = validationStatus(summary.validationStatus);
    if (status === 'blocked' || status === 'invalid') blockers.push(`${summary.label} failed validation with status "${status}".`);
  }

  const ok = blockers.length === 0;
  return {
    ok,
    blockers,
    warnings,
    summary: ok ? 'Template execution guards passed.' : `Template execution blocked: ${blockers.join(' ')}`
  };
}

export function assertTemplateExecutionReady(input: Parameters<typeof evaluateTemplateExecutionGuards>[0]) {
  const result = evaluateTemplateExecutionGuards(input);
  if (!result.ok) throw new Error(result.summary);
  return result;
}
