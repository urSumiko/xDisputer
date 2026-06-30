import type { LetterRoute, ParsedSource } from '../letter-engine';
import type { Round } from '../reference-store';
import type { TemplateDocumentKind } from '../template-contracts';
import type { ReferenceDisputeValues } from '../docx-renderer';
import { repairDisputeStaticHeaderDuplication } from '../docx-dispute-header-repair';
import { inspectDynamicTemplateContractV2, type DynamicTemplateContractV2 } from './contract-v2';
import { buildDynamicTemplateRenderPlan, dynamicRenderPlanSummary, type DynamicRenderPlan, type DynamicRenderPlanValue } from './mapping-engine';
import { renderDocxLayoutV2, type DocxLayoutRendererV2Result } from './docx-layout-renderer-v2';
import { validateDynamicTemplateRender, dynamicTemplateRenderValidationManifest, type DynamicTemplateRenderValidationResult } from './render-validation';
import { gradeDynamicTemplateRender, dynamicTemplateQualityManifest, type DynamicTemplateQualityGrade } from './quality-framework';
import { evaluateDynamicTemplateAdvancedZones, dynamicTemplateAdvancedZoneManifest, type DynamicTemplateAdvancedZoneDecision } from './advanced-zone-policy';
import { resolveDynamicTemplateRendererMode, type DynamicTemplateRendererMode } from './renderer-mode';
import { managerOwnedGenerationManifest, mergeManagerOwnedWarningsIntoPlan, routeManagerOwnedDocxGeneration, type ManagerOwnedGenerationRoute } from '../manager-template-contract';

export type DynamicTemplateEngineV2Result = {
  version: 1;
  status: 'RENDERED' | 'BLOCKED';
  blob: Blob;
  contract: DynamicTemplateContractV2;
  managerOwnedRoute: ManagerOwnedGenerationRoute;
  advancedZones: DynamicTemplateAdvancedZoneDecision;
  plan: DynamicRenderPlan;
  renderResult: DocxLayoutRendererV2Result;
  validation: DynamicTemplateRenderValidationResult;
  quality: DynamicTemplateQualityGrade;
  manifest: Record<string, unknown>;
};

export function shouldUseDynamicDocxLayoutV2(mode?: DynamicTemplateRendererMode | string | null) {
  return resolveDynamicTemplateRendererMode({ explicitMode: mode }) === 'DOCX_LAYOUT_V2';
}

function planField(plan: DynamicRenderPlan, canonicalKey: string): DynamicRenderPlanValue | undefined {
  return plan.fieldValues.find((field) => field.canonicalKey === canonicalKey);
}

function fieldText(plan: DynamicRenderPlan, canonicalKey: string) {
  const value = planField(plan, canonicalKey)?.value;
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value.join('\n').trim();
  return '';
}

function fieldLines(plan: DynamicRenderPlan, canonicalKey: string) {
  const value = planField(plan, canonicalKey)?.value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value.map((item) => item.trim()).filter(Boolean) as string[];
  if (typeof value === 'string') return value.split('\n').map((line) => line.trim()).filter(Boolean);
  return [];
}

function disputeRepairValues(plan: DynamicRenderPlan): ReferenceDisputeValues | null {
  const consumerName = fieldText(plan, 'client.name');
  const letterDate = fieldText(plan, 'letter.date');
  const bureauName = fieldText(plan, 'bureau.name');
  if (!consumerName || !letterDate || !bureauName) return null;

  return {
    consumerName,
    addressLines: fieldLines(plan, 'client.addressLines'),
    dob: fieldText(plan, 'client.dob'),
    ssn: fieldText(plan, 'client.ssnMasked'),
    letterDate,
    bureauName,
    bureauAddressLines: fieldLines(plan, 'bureau.addressLines'),
    disputeItems: [],
    hardInquiryItems: []
  };
}

async function repairDynamicDisputeHeader(input: {
  kind: TemplateDocumentKind;
  plan: DynamicRenderPlan;
  renderResult: DocxLayoutRendererV2Result;
}) {
  if (input.kind !== 'DISPUTE_LETTER') return input.renderResult;
  const values = disputeRepairValues(input.plan);
  if (!values) return input.renderResult;

  const blob = await repairDisputeStaticHeaderDuplication(input.renderResult.blob, values);
  return {
    ...input.renderResult,
    blob,
    proof: {
      ...input.renderResult.proof,
      warnings: [...input.renderResult.proof.warnings, 'Dynamic dispute header cleanup checked for stale static client/bureau placeholders.']
    }
  };
}

export async function renderDynamicDocxTemplateV2(input: {
  template: File;
  kind: TemplateDocumentKind;
  parsed: ParsedSource;
  round: Round;
  route?: LetterRoute | null;
  documentDate: string;
  rendererMode?: DynamicTemplateRendererMode | string | null;
}): Promise<DynamicTemplateEngineV2Result> {
  const rendererMode = resolveDynamicTemplateRendererMode({ explicitMode: input.rendererMode });
  const contract = await inspectDynamicTemplateContractV2(input.template, input.kind, input.round);
  const managerOwnedRoute = await routeManagerOwnedDocxGeneration({ template: input.template, kind: input.kind });
  const advancedZones = evaluateDynamicTemplateAdvancedZones(contract);
  const basePlan = buildDynamicTemplateRenderPlan({
    contract,
    parsed: input.parsed,
    round: input.round,
    route: input.route,
    documentDate: input.documentDate
  });
  const plan = mergeManagerOwnedWarningsIntoPlan(basePlan, managerOwnedRoute);

  if (contract.status === 'BLOCKED' || plan.status === 'BLOCKED' || advancedZones.status === 'BLOCKED') {
    const reason = [
      ...contract.errors,
      ...advancedZones.blockers,
      ...plan.blockers,
      contract.missingFields.length ? `Missing required canonical field(s): ${contract.missingFields.join(', ')}.` : ''
    ].filter(Boolean).join(' ');
    throw new Error(`Dynamic Template Engine v2 blocked rendering. ${reason}`.trim());
  }

  const rawRenderResult = await renderDocxLayoutV2({
    template: input.template,
    plan: advancedZones.warnings.length ? { ...plan, warnings: [...plan.warnings, ...advancedZones.warnings] } : plan,
    rendererMode
  });
  const renderResult = await repairDynamicDisputeHeader({ kind: input.kind, plan, renderResult: rawRenderResult });
  const validation = await validateDynamicTemplateRender({ plan, renderResult });
  const quality = gradeDynamicTemplateRender({ contract, plan, validation });

  if (quality.status === 'BLOCKED') {
    throw new Error(`Dynamic Template Engine v2 output failed proof checks. ${quality.blockers.join(' ')}`.trim());
  }

  return {
    version: 1,
    status: 'RENDERED',
    blob: renderResult.blob,
    contract,
    managerOwnedRoute,
    advancedZones,
    plan,
    renderResult,
    validation,
    quality,
    manifest: {
      dynamicTemplateEngineV2: {
        version: 1,
        rendererMode,
        contract: {
          version: contract.version,
          kind: contract.kind,
          status: contract.status,
          confidence: contract.confidence,
          missingFields: contract.missingFields,
          warnings: contract.warnings,
          diagnostics: contract.diagnostics
        },
        ...managerOwnedGenerationManifest(managerOwnedRoute),
        ...dynamicTemplateAdvancedZoneManifest(advancedZones),
        renderPlan: dynamicRenderPlanSummary(plan),
        ...dynamicTemplateRenderValidationManifest(validation),
        ...dynamicTemplateQualityManifest(quality)
      }
    }
  };
}
