import type { TemplateRound } from './template-workspace-contract';
import { getManagerTemplateLibraryContext } from './template-library-service';
import { buildTemplateRenderPlan } from './template-studio-service';

type SupabaseLike = Parameters<typeof getManagerTemplateLibraryContext>[0]['supabase'];

export type GenerationEnginePlan = {
  id: string;
  managerId: string;
  templateId: string | null;
  clientId?: string;
  round: TemplateRound;
  renderMode: 'preview' | 'client-output' | 'release-test';
  readiness: 'ready' | 'needs-template-rule' | 'needs-mapping' | 'needs-client-data' | 'blocked';
  preservedStaticText: string[];
  generatedVariables: Array<{ token: string; canonicalField: string; valuePreview: string | null; status: 'ready' | 'missing' | 'conflict' }>;
  tablePlans: Array<{ tableId: string; layoutStatus: 'preserved' | 'dynamic-rows' | 'blocked'; rowSource: string | null }>;
  warnings: string[];
  blockers: string[];
  releaseAction: { enabled: boolean; label: string; reason: string };
};

function readinessFrom(input: { hasTemplate: boolean; missing: string[]; warnings: string[] }) {
  if (!input.hasTemplate) return 'needs-template-rule' as const;
  if (input.missing.length) return 'needs-mapping' as const;
  if (input.warnings.some((warning) => warning.toLowerCase().includes('table'))) return 'blocked' as const;
  return 'ready' as const;
}

export async function previewGenerationPlan(input: {
  supabase: SupabaseLike;
  managerId: string;
  templateId?: string | null;
  clientId?: string;
  round?: TemplateRound;
  renderMode?: GenerationEnginePlan['renderMode'];
}): Promise<GenerationEnginePlan> {
  const round = input.round || '1st Round';
  const [library, renderPlan] = await Promise.all([
    getManagerTemplateLibraryContext({ supabase: input.supabase, managerId: input.managerId, round }),
    buildTemplateRenderPlan({ supabase: input.supabase, managerId: input.managerId, round })
  ]);
  const templateId = input.templateId || library.contract.activeTemplateId;
  const missing = renderPlan.missingRequiredFields;
  const warnings = [...renderPlan.rendererWarnings, ...library.contract.engine.warnings];
  const readiness = readinessFrom({ hasTemplate: Boolean(templateId), missing, warnings });
  const blockers = [
    ...(!templateId ? ['No active manager-owned template is selected for this round.'] : []),
    ...missing.map((field) => `Required canonical field missing: ${field}`),
    ...library.contract.engine.blockers
  ];

  return {
    id: `engine-${input.managerId}-${round.replace(/\s+/g, '-').toLowerCase()}`,
    managerId: input.managerId,
    templateId,
    clientId: input.clientId,
    round,
    renderMode: input.renderMode || 'preview',
    readiness,
    preservedStaticText: renderPlan.preservedBlocks,
    generatedVariables: renderPlan.canonicalFieldBindings.map((binding) => ({
      token: binding.token,
      canonicalField: binding.canonicalField,
      valuePreview: binding.status === 'valid' ? 'Resolved at generation time' : null,
      status: binding.status === 'blocked' ? 'missing' : binding.status === 'warning' ? 'conflict' : 'ready'
    })),
    tablePlans: renderPlan.tableInstructions.map((table) => ({ tableId: table.id, layoutStatus: table.rule === 'needs-row-source' ? 'blocked' : table.rule === 'dynamic-rows' ? 'dynamic-rows' : 'preserved', rowSource: table.rule === 'needs-row-source' ? null : 'client account records' })),
    warnings,
    blockers,
    releaseAction: blockers.length
      ? { enabled: false, label: 'Release blocked', reason: blockers[0] }
      : readiness === 'ready'
        ? { enabled: true, label: 'Ready for release validation', reason: 'Preview plan has mappings, preserved text, and no blockers.' }
        : { enabled: false, label: 'Preview required', reason: 'Run a preview after completing studio rules.' }
  };
}

export async function validateTemplateRelease(input: { supabase: SupabaseLike; managerId: string; templateId?: string | null; round?: TemplateRound }) {
  const plan = await previewGenerationPlan({ ...input, renderMode: 'release-test' });
  return {
    ok: plan.releaseAction.enabled,
    plan,
    reason: plan.releaseAction.reason
  };
}
