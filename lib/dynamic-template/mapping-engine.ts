import type { LetterRoute, ParsedSource } from '../letter-engine';
import type { Round } from '../reference-store';
import type { TemplateDocumentKind } from '../template-contracts';
import type { DynamicTemplateContractV2, DynamicTemplateFieldOccurrence, DynamicTemplateRepeatBlock } from './contract-v2';
import { dynamicFieldDefinition, type DynamicCanonicalFieldKey } from './field-registry';
import { createCanonicalSourceModel } from '../template-execution/canonical-source-model';

export type DynamicRenderPlanStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'STATIC';
export type DynamicRenderPlanOperationKind = 'INLINE_REPLACE' | 'MULTILINE_REPLACE' | 'REPEAT_BLOCK' | 'TABLE_ROW_CLONE' | 'CONDITIONAL_SECTION' | 'STATIC_INSERT';

export type DynamicRenderPlanValue = {
  canonicalKey: DynamicCanonicalFieldKey;
  value: string | string[] | Array<Record<string, string | string[]>> | boolean;
  available: boolean;
  source: string;
};

export type DynamicRenderPlanOperation = {
  kind: DynamicRenderPlanOperationKind;
  canonicalKey?: DynamicCanonicalFieldKey;
  alias?: string;
  partName?: string;
  occurrenceIndex?: number;
  location?: string;
  tableRowIndex?: number | null;
  value?: DynamicRenderPlanValue;
  repeatCount?: number;
  preserveStyle: boolean;
  notes: string[];
};

export type DynamicRenderPlan = {
  version: 1;
  rendererMode: 'CONTRACT_V2_RENDER_PLAN_ONLY';
  status: DynamicRenderPlanStatus;
  kind: TemplateDocumentKind;
  round: Round;
  routeKey: string | null;
  routeType: string | null;
  bureau: string | null;
  fieldValues: DynamicRenderPlanValue[];
  operations: DynamicRenderPlanOperation[];
  blockers: string[];
  warnings: string[];
  diagnostics: {
    requiredFieldCount: number;
    availableRequiredFieldCount: number;
    missingRequiredFieldCount: number;
    operationCount: number;
    inlineOperationCount: number;
    multilineOperationCount: number;
    repeatOperationCount: number;
    tableRowCloneCount: number;
    conditionalOperationCount: number;
    unresolvedPlaceholderCount: number;
  };
};

function operationKindForOccurrence(occurrence: DynamicTemplateFieldOccurrence): DynamicRenderPlanOperationKind {
  const definition = dynamicFieldDefinition(occurrence.canonicalKey);
  if (definition?.kind === 'CONDITIONAL_BLOCK') return 'CONDITIONAL_SECTION';
  if (definition?.kind === 'MULTILINE') return 'MULTILINE_REPLACE';
  if (definition?.kind === 'REPEATING_BLOCK') return occurrence.insideTableRow ? 'TABLE_ROW_CLONE' : 'REPEAT_BLOCK';
  return 'INLINE_REPLACE';
}

function repeatCount(value: DynamicRenderPlanValue | undefined) {
  return Array.isArray(value?.value) ? value.value.length : typeof value?.value === 'boolean' ? Number(value.value) : value?.available ? 1 : 0;
}

function operationForOccurrence(occurrence: DynamicTemplateFieldOccurrence, values: Map<DynamicCanonicalFieldKey, DynamicRenderPlanValue>): DynamicRenderPlanOperation {
  const value = values.get(occurrence.canonicalKey);
  const kind = operationKindForOccurrence(occurrence);
  return {
    kind,
    canonicalKey: occurrence.canonicalKey,
    alias: occurrence.alias,
    partName: occurrence.partName,
    occurrenceIndex: occurrence.occurrenceIndex,
    location: occurrence.location,
    tableRowIndex: occurrence.tableRowIndex || null,
    value,
    repeatCount: kind === 'REPEAT_BLOCK' || kind === 'TABLE_ROW_CLONE' ? repeatCount(value) : undefined,
    preserveStyle: true,
    notes: [
      'Do not rebuild this location from scratch.',
      occurrence.insideTableRow ? 'Clone and mutate the existing table row prototype.' : 'Replace placeholder content while preserving surrounding DOCX styles.'
    ]
  };
}

function operationForRepeatBlock(block: DynamicTemplateRepeatBlock, values: Map<DynamicCanonicalFieldKey, DynamicRenderPlanValue>): DynamicRenderPlanOperation {
  const value = values.get(block.canonicalKey);
  return {
    kind: block.renderIntent === 'CLONE_TABLE_ROW' ? 'TABLE_ROW_CLONE' : 'REPEAT_BLOCK',
    canonicalKey: block.canonicalKey,
    alias: block.alias,
    partName: block.partName,
    location: block.location,
    tableRowIndex: block.tableRowIndex || null,
    value,
    repeatCount: repeatCount(value),
    preserveStyle: true,
    notes: [
      block.blockType === 'TABLE_ROW_PROTOTYPE'
        ? 'Renderer-v2 must clone this table row and preserve widths, borders, shading, and run style.'
        : 'Renderer-v2 must clone the nearest styled paragraph/block prototype.'
    ]
  };
}

function emptyStaticPlan(input: { contract: DynamicTemplateContractV2; round: Round }): DynamicRenderPlan {
  return {
    version: 1,
    rendererMode: 'CONTRACT_V2_RENDER_PLAN_ONLY',
    status: 'STATIC',
    kind: input.contract.kind,
    round: input.round,
    routeKey: null,
    routeType: null,
    bureau: null,
    fieldValues: [],
    operations: [{ kind: 'STATIC_INSERT', preserveStyle: true, notes: ['Static PDF component must be inserted unchanged.'] }],
    blockers: [],
    warnings: input.contract.warnings,
    diagnostics: {
      requiredFieldCount: 0,
      availableRequiredFieldCount: 0,
      missingRequiredFieldCount: 0,
      operationCount: 1,
      inlineOperationCount: 0,
      multilineOperationCount: 0,
      repeatOperationCount: 0,
      tableRowCloneCount: 0,
      conditionalOperationCount: 0,
      unresolvedPlaceholderCount: 0
    }
  };
}

export function buildDynamicTemplateRenderPlan(input: {
  contract: DynamicTemplateContractV2;
  parsed: ParsedSource;
  round: Round;
  route?: LetterRoute | null;
  documentDate: string;
}): DynamicRenderPlan {
  if (input.contract.staticPdf) return emptyStaticPlan({ contract: input.contract, round: input.round });

  const sourceModel = createCanonicalSourceModel(input.parsed);
  const uniqueKeys = Array.from(new Set([...input.contract.requiredFields, ...input.contract.optionalFields, ...input.contract.fulfilledFields]));
  const fieldValues = uniqueKeys.map((key) => sourceModel.valueForField({ key, route: input.route, round: input.round, documentDate: input.documentDate }));
  const values = new Map(fieldValues.map((value) => [value.canonicalKey, value]));
  const blockers: string[] = [...input.contract.errors];
  const warnings: string[] = [...input.contract.warnings];

  for (const field of input.contract.requiredFields) {
    const value = values.get(field);
    if (!value?.available) blockers.push(`Required field ${field} has no source value for this route/document.`);
  }

  input.contract.unknownPlaceholders.filter((item) => item.required).forEach((item) => {
    blockers.push(`Unknown required placeholder ${item.alias} must be mapped before renderer-v2 can run.`);
  });

  const occurrenceOperations = input.contract.fieldOccurrences.map((occurrence) => operationForOccurrence(occurrence, values));
  const repeatOperations = input.contract.repeatBlocks.map((block) => operationForRepeatBlock(block, values));
  const operationKey = (operation: DynamicRenderPlanOperation) => [operation.kind, operation.canonicalKey, operation.partName, operation.tableRowIndex, operation.occurrenceIndex].join('::');
  const operations = Array.from(new Map([...occurrenceOperations, ...repeatOperations].map((operation) => [operationKey(operation), operation])).values());
  const availableRequired = input.contract.requiredFields.filter((field) => values.get(field)?.available).length;
  const tableRowCloneCount = operations.filter((operation) => operation.kind === 'TABLE_ROW_CLONE').length;
  const repeatOperationCount = operations.filter((operation) => operation.kind === 'REPEAT_BLOCK' || operation.kind === 'TABLE_ROW_CLONE').length;
  const status: DynamicRenderPlanStatus = blockers.length ? 'BLOCKED' : warnings.length ? 'WARNING' : 'READY';

  return {
    version: 1,
    rendererMode: 'CONTRACT_V2_RENDER_PLAN_ONLY',
    status,
    kind: input.contract.kind,
    round: input.round,
    routeKey: input.route ? `${input.route.type}:${input.route.bureau}` : null,
    routeType: input.route?.type || null,
    bureau: input.route?.bureau || null,
    fieldValues,
    operations,
    blockers,
    warnings,
    diagnostics: {
      requiredFieldCount: input.contract.requiredFields.length,
      availableRequiredFieldCount: availableRequired,
      missingRequiredFieldCount: input.contract.requiredFields.length - availableRequired,
      operationCount: operations.length,
      inlineOperationCount: operations.filter((operation) => operation.kind === 'INLINE_REPLACE').length,
      multilineOperationCount: operations.filter((operation) => operation.kind === 'MULTILINE_REPLACE').length,
      repeatOperationCount,
      tableRowCloneCount,
      conditionalOperationCount: operations.filter((operation) => operation.kind === 'CONDITIONAL_SECTION').length,
      unresolvedPlaceholderCount: input.contract.unknownPlaceholders.length
    }
  };
}

export function dynamicRenderPlanSummary(plan: DynamicRenderPlan) {
  return {
    version: plan.version,
    rendererMode: plan.rendererMode,
    status: plan.status,
    kind: plan.kind,
    round: plan.round,
    routeKey: plan.routeKey,
    bureau: plan.bureau,
    blockerCount: plan.blockers.length,
    warningCount: plan.warnings.length,
    diagnostics: plan.diagnostics,
    operations: plan.operations.map((operation) => ({
      kind: operation.kind,
      canonicalKey: operation.canonicalKey,
      alias: operation.alias,
      partName: operation.partName,
      repeatCount: operation.repeatCount,
      preserveStyle: operation.preserveStyle,
      notes: operation.notes
    }))
  };
}
