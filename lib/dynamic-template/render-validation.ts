import PizZip from 'pizzip';
import type { DynamicRenderPlan, DynamicRenderPlanOperation } from './mapping-engine';
import type { DocxLayoutRendererV2Result } from './docx-layout-renderer-v2';

export type DynamicTemplateUnresolvedPlaceholder = {
  alias: string;
  partName: string;
  required: boolean;
};

export type DynamicTemplateRepeatValidation = {
  expectedRepeatOperations: number;
  appliedRepeatOperations: number;
  expectedTableRowCloneOperations: number;
  appliedTableRowCloneOperations: number;
  expectedRepeatedItems: number;
  appliedRepeatedItems: number;
  skippedRepeatOperations: number;
  skippedTableRowCloneOperations: number;
  warnings: string[];
  blockers: string[];
};

type OperationIdentityLike = {
  kind?: string | null;
  canonicalKey?: string | null;
  alias?: string | null;
  partName?: string | null;
  tableRowIndex?: number | null;
};

export type DynamicTemplateRenderValidationResult = {
  version: 1;
  status: 'PASS' | 'WARNING' | 'FAIL';
  renderer: string;
  rendererVersion: string;
  rendererMode: string;
  planStatus: DynamicRenderPlan['status'];
  unresolvedPlaceholders: DynamicTemplateUnresolvedPlaceholder[];
  unresolvedRequiredPlaceholders: DynamicTemplateUnresolvedPlaceholder[];
  repeatValidation: DynamicTemplateRepeatValidation;
  appliedOperationCount: number;
  skippedOperationCount: number;
  mutatedPartCount: number;
  repeatedOperationCount: number;
  tableRowCloneOperationCount: number;
  warnings: string[];
  blockers: string[];
  proof: {
    source: 'dynamic-template-render-validation';
    generatedAt: string;
    requiredFieldCount: number;
    availableRequiredFieldCount: number;
    missingRequiredFieldCount: number;
    operationCount: number;
    inlineOperationCount: number;
    multilineOperationCount: number;
    repeatOperationCount: number;
    tableRowCloneCount: number;
    conditionalOperationCount: number;
    expectedRepeatedItems: number;
    appliedRepeatedItems: number;
    skippedRepeatOperations: number;
    skippedTableRowCloneOperations: number;
    unresolvedPlaceholderCount: number;
    unresolvedRequiredPlaceholderCount: number;
    mutatedParts: string[];
  };
};

const WORD_XML_PART = /^word\/(?:document|header\d+|footer\d+)\.xml$/i;
const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}|\[\[\s*([^\[\]]+?)\s*\]\]|«\s*([^«»]+?)\s*»/g;

function tokenFromMatch(match: RegExpExecArray) {
  return String(match[1] || match[2] || match[3] || '').trim();
}

function normalizeAlias(value: string) {
  return value
    .replace(/^#|^\/|^if\./i, '')
    .replace(/^each\./i, '')
    .replace(/[{}\[\]«»]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .trim()
    .toLowerCase();
}

function requiredAliases(plan: DynamicRenderPlan) {
  const requiredCanonicalKeys = new Set(plan.fieldValues.filter((field) => field.available === false).map((field) => field.canonicalKey));
  const operationAliases = new Set<string>();

  plan.operations.forEach((operation) => {
    if (operation.alias && operation.canonicalKey && requiredCanonicalKeys.has(operation.canonicalKey)) {
      operationAliases.add(normalizeAlias(operation.alias));
    }
  });

  return operationAliases;
}

async function arrayBufferFromBlob(blob: Blob | ArrayBuffer) {
  return blob instanceof ArrayBuffer ? blob : await blob.arrayBuffer();
}

function repeatOperations(plan: DynamicRenderPlan) {
  return plan.operations.filter((operation) => operation.kind === 'REPEAT_BLOCK' || operation.kind === 'TABLE_ROW_CLONE');
}

function repeatCount(operation: DynamicRenderPlanOperation) {
  return Math.max(0, Number(operation.repeatCount || 0));
}

function operationIdentity(operation: OperationIdentityLike) {
  return [operation.kind || '', operation.canonicalKey || '', operation.alias || '', operation.partName || '', operation.tableRowIndex || ''].join('::');
}

function validateRepeatProof(input: {
  plan: DynamicRenderPlan;
  renderResult: DocxLayoutRendererV2Result;
}): DynamicTemplateRepeatValidation {
  const plannedRepeats = repeatOperations(input.plan);
  const plannedRepeatIds = new Set(plannedRepeats.map(operationIdentity));
  const plannedTableIds = new Set(plannedRepeats.filter((operation) => operation.kind === 'TABLE_ROW_CLONE').map(operationIdentity));
  const appliedRepeatIds = new Set(input.renderResult.proof.appliedOperations.filter((operation) => operation.kind === 'REPEAT_BLOCK' || operation.kind === 'TABLE_ROW_CLONE').map(operationIdentity));
  const appliedTableIds = new Set(input.renderResult.proof.appliedOperations.filter((operation) => operation.kind === 'TABLE_ROW_CLONE').map(operationIdentity));
  const skippedRepeatIds = new Set(input.renderResult.proof.skippedOperations.filter((operation) => operation.kind === 'REPEAT_BLOCK' || operation.kind === 'TABLE_ROW_CLONE').map(operationIdentity));
  const skippedTableIds = new Set(input.renderResult.proof.skippedOperations.filter((operation) => operation.kind === 'TABLE_ROW_CLONE').map(operationIdentity));
  const expectedRepeatedItems = plannedRepeats.reduce((total, operation) => total + repeatCount(operation), 0);
  const appliedRepeatedItems = plannedRepeats
    .filter((operation) => appliedRepeatIds.has(operationIdentity(operation)))
    .reduce((total, operation) => total + repeatCount(operation), 0);
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (plannedRepeatIds.size && appliedRepeatIds.size < plannedRepeatIds.size) {
    warnings.push(`Renderer-v2 applied ${appliedRepeatIds.size} of ${plannedRepeatIds.size} planned repeat operation(s).`);
  }

  if (plannedTableIds.size && appliedTableIds.size < plannedTableIds.size) {
    warnings.push(`Renderer-v2 applied ${appliedTableIds.size} of ${plannedTableIds.size} planned table-row clone operation(s).`);
  }

  if (expectedRepeatedItems > 0 && appliedRepeatedItems === 0) {
    blockers.push(`Renderer-v2 expected ${expectedRepeatedItems} repeated item(s) but did not apply any repeat/table clone operation.`);
  }

  return {
    expectedRepeatOperations: plannedRepeatIds.size,
    appliedRepeatOperations: appliedRepeatIds.size,
    expectedTableRowCloneOperations: plannedTableIds.size,
    appliedTableRowCloneOperations: appliedTableIds.size,
    expectedRepeatedItems,
    appliedRepeatedItems,
    skippedRepeatOperations: skippedRepeatIds.size,
    skippedTableRowCloneOperations: skippedTableIds.size,
    warnings,
    blockers
  };
}

export async function scanUnresolvedPlaceholders(input: {
  rendered: Blob | ArrayBuffer;
  plan: DynamicRenderPlan;
}) {
  const zip = new PizZip(await arrayBufferFromBlob(input.rendered));
  const required = requiredAliases(input.plan);
  const unresolved: DynamicTemplateUnresolvedPlaceholder[] = [];

  for (const partName of Object.keys(zip.files).filter((name) => WORD_XML_PART.test(name))) {
    const file = zip.file(partName);
    if (!file) continue;

    const xml = file.asText();
    const matches = Array.from(xml.matchAll(PLACEHOLDER_PATTERN));

    matches.forEach((match) => {
      const alias = tokenFromMatch(match);
      if (!alias) return;
      const normalized = normalizeAlias(alias);
      unresolved.push({
        alias,
        partName,
        required: required.has(normalized) || !/^optional\./i.test(alias)
      });
    });
  }

  return unresolved;
}

export async function validateDynamicTemplateRender(input: {
  plan: DynamicRenderPlan;
  renderResult: DocxLayoutRendererV2Result;
}): Promise<DynamicTemplateRenderValidationResult> {
  const unresolvedPlaceholders = await scanUnresolvedPlaceholders({
    rendered: input.renderResult.blob,
    plan: input.plan
  });
  const unresolvedRequiredPlaceholders = unresolvedPlaceholders.filter((placeholder) => placeholder.required);
  const repeatValidation = validateRepeatProof(input);
  const warnings = [...input.renderResult.proof.warnings, ...repeatValidation.warnings];
  const blockers = [...input.renderResult.proof.blockers, ...repeatValidation.blockers];

  if (unresolvedRequiredPlaceholders.length) {
    blockers.push(`Rendered DOCX still contains ${unresolvedRequiredPlaceholders.length} unresolved required placeholder(s).`);
  }

  if (unresolvedPlaceholders.length && !unresolvedRequiredPlaceholders.length) {
    warnings.push(`Rendered DOCX still contains ${unresolvedPlaceholders.length} optional or review placeholder(s).`);
  }

  const status: DynamicTemplateRenderValidationResult['status'] = blockers.length
    ? 'FAIL'
    : warnings.length || input.renderResult.proof.skippedOperations.length
      ? 'WARNING'
      : 'PASS';

  return {
    version: 1,
    status,
    renderer: input.renderResult.proof.renderer,
    rendererVersion: input.renderResult.proof.rendererVersion,
    rendererMode: input.renderResult.proof.rendererMode,
    planStatus: input.plan.status,
    unresolvedPlaceholders,
    unresolvedRequiredPlaceholders,
    repeatValidation,
    appliedOperationCount: input.renderResult.proof.appliedOperations.length,
    skippedOperationCount: input.renderResult.proof.skippedOperations.length,
    mutatedPartCount: input.renderResult.proof.mutatedParts.length,
    repeatedOperationCount: input.plan.diagnostics.repeatOperationCount,
    tableRowCloneOperationCount: input.plan.diagnostics.tableRowCloneCount,
    warnings,
    blockers,
    proof: {
      source: 'dynamic-template-render-validation',
      generatedAt: new Date().toISOString(),
      requiredFieldCount: input.plan.diagnostics.requiredFieldCount,
      availableRequiredFieldCount: input.plan.diagnostics.availableRequiredFieldCount,
      missingRequiredFieldCount: input.plan.diagnostics.missingRequiredFieldCount,
      operationCount: input.plan.diagnostics.operationCount,
      inlineOperationCount: input.plan.diagnostics.inlineOperationCount,
      multilineOperationCount: input.plan.diagnostics.multilineOperationCount,
      repeatOperationCount: input.plan.diagnostics.repeatOperationCount,
      tableRowCloneCount: input.plan.diagnostics.tableRowCloneCount,
      conditionalOperationCount: input.plan.diagnostics.conditionalOperationCount,
      expectedRepeatedItems: repeatValidation.expectedRepeatedItems,
      appliedRepeatedItems: repeatValidation.appliedRepeatedItems,
      skippedRepeatOperations: repeatValidation.skippedRepeatOperations,
      skippedTableRowCloneOperations: repeatValidation.skippedTableRowCloneOperations,
      unresolvedPlaceholderCount: unresolvedPlaceholders.length,
      unresolvedRequiredPlaceholderCount: unresolvedRequiredPlaceholders.length,
      mutatedParts: input.renderResult.proof.mutatedParts
    }
  };
}

export function dynamicTemplateRenderValidationManifest(validation: DynamicTemplateRenderValidationResult) {
  return {
    dynamicTemplateRenderer: {
      version: validation.version,
      status: validation.status,
      renderer: validation.renderer,
      rendererVersion: validation.rendererVersion,
      rendererMode: validation.rendererMode,
      planStatus: validation.planStatus,
      appliedOperationCount: validation.appliedOperationCount,
      skippedOperationCount: validation.skippedOperationCount,
      mutatedPartCount: validation.mutatedPartCount,
      repeatedOperationCount: validation.repeatedOperationCount,
      tableRowCloneOperationCount: validation.tableRowCloneOperationCount,
      repeatValidation: validation.repeatValidation,
      unresolvedPlaceholderCount: validation.unresolvedPlaceholders.length,
      unresolvedRequiredPlaceholderCount: validation.unresolvedRequiredPlaceholders.length,
      warnings: validation.warnings,
      blockers: validation.blockers,
      proof: validation.proof
    }
  };
}
