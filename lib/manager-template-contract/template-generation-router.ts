import type { TemplateDocumentKind } from '../template-contracts';
import type { DynamicRenderPlan } from '../dynamic-template/mapping-engine';
import { buildManagerOwnedTemplateRuntimeContract, managerOwnedTemplateRuntimeManifest, type ManagerOwnedTemplateRuntimeContract } from './template-runtime-contract';

export type ManagerOwnedGenerationRoute = {
  mode: 'manager-owned-docx';
  canRender: boolean;
  requiresRepair: boolean;
  shouldPreserveUnknownStaticText: boolean;
  shouldUseEntityStyleSeed: boolean;
  reason: string;
  contract: ManagerOwnedTemplateRuntimeContract;
};

export async function routeManagerOwnedDocxGeneration(input: {
  template: Blob | ArrayBuffer | Uint8Array | string;
  kind: TemplateDocumentKind;
}): Promise<ManagerOwnedGenerationRoute> {
  const contract = await buildManagerOwnedTemplateRuntimeContract({ template: input.template, kind: input.kind });
  return {
    mode: 'manager-owned-docx',
    canRender: contract.status !== 'blocked',
    requiresRepair: contract.status === 'repair-needed',
    shouldPreserveUnknownStaticText: true,
    shouldUseEntityStyleSeed: contract.entityBlocks.some((entity) => entity.ruleStatus === 'active' || entity.ruleStatus === 'needs-review'),
    reason: contract.status === 'ready'
      ? 'Manager-owned DOCX contract is ready. Preserve the uploaded document body and mutate only mapped fields/entity zones.'
      : contract.status === 'repair-needed'
        ? 'Manager-owned DOCX can continue with repair warnings; Template Studio should show anchor/field review tasks.'
        : `Manager-owned DOCX is blocked: ${contract.blockers.join(' ')}`,
    contract
  };
}

export function mergeManagerOwnedWarningsIntoPlan(plan: DynamicRenderPlan, route: ManagerOwnedGenerationRoute): DynamicRenderPlan {
  const warnings = [
    ...plan.warnings,
    ...route.contract.warnings,
    route.requiresRepair ? 'Manager-owned DOCX repair warnings exist. Preserve static blocks and surface repair tasks in Template Studio.' : '',
    'Manager-owned generation policy: preserve unknown manager custom text by default.'
  ].filter(Boolean);
  const blockers = route.canRender ? plan.blockers : [...plan.blockers, ...route.contract.blockers];
  return {
    ...plan,
    status: blockers.length ? 'BLOCKED' : warnings.length ? 'WARNING' : plan.status,
    warnings,
    blockers
  };
}

export function managerOwnedGenerationManifest(route: ManagerOwnedGenerationRoute) {
  return {
    managerOwnedGenerationRoute: {
      mode: route.mode,
      canRender: route.canRender,
      requiresRepair: route.requiresRepair,
      shouldPreserveUnknownStaticText: route.shouldPreserveUnknownStaticText,
      shouldUseEntityStyleSeed: route.shouldUseEntityStyleSeed,
      reason: route.reason
    },
    ...managerOwnedTemplateRuntimeManifest(route.contract)
  };
}
