import { decideTemplateTokenBehavior, type DynamicTemplateRule, type TemplateRound } from './template-workspace-contract';
import { getManagerTemplateLibraryContext } from './template-library-service';

type SupabaseLike = Parameters<typeof getManagerTemplateLibraryContext>[0]['supabase'];

export type TemplateStructureInspection = {
  staticTextBlocks: string[];
  dynamicTokens: Array<{ token: string; decision: ReturnType<typeof decideTemplateTokenBehavior>; required: boolean }>;
  tables: Array<{ id: string; rule: 'preserve-layout' | 'dynamic-rows' | 'needs-row-source' }>;
  repeatedSections: string[];
  detectedEntities: string[];
  unmappedVariables: string[];
  candidateCanonicalFields: string[];
  rules: DynamicTemplateRule[];
};

const defaultCanonicalFields = ['consumer.full_name', 'consumer.address', 'account.creditor_name', 'account.account_number', 'dispute.reason', 'bureau.name'];

function listFromValidation(asset: { validation_json: Record<string, unknown> | null }, key: string) {
  const value = asset.validation_json?.[key];
  return Array.isArray(value) ? value.map(String) : [];
}

function templateTokensFromAssets(assets: Array<{ id: string; original_filename: string | null; validation_json: Record<string, unknown> | null }>) {
  const fields = new Set<string>();
  assets.forEach((asset) => {
    listFromValidation(asset, 'requiredFields').forEach((field) => fields.add(field));
    listFromValidation(asset, 'missingFields').forEach((field) => fields.add(field));
    listFromValidation(asset, 'aliasesUsed').forEach((field) => fields.add(field));
  });
  if (!fields.size && assets.length) {
    fields.add('consumer.full_name');
    fields.add('account.account_number');
    fields.add('dispute.reason');
  }
  return Array.from(fields);
}

export async function inspectTemplateStructure(input: {
  supabase: SupabaseLike;
  managerId: string;
  round?: TemplateRound;
}): Promise<TemplateStructureInspection> {
  const context = await getManagerTemplateLibraryContext(input);
  const tokens = templateTokensFromAssets(context.assets);
  const missing = new Set(context.assets.flatMap((asset) => listFromValidation(asset, 'missingFields').concat(listFromValidation(asset, 'unknownRequiredFields'))));
  const rules = tokens.map<DynamicTemplateRule>((token, index) => ({
    id: `rule-${index + 1}-${token.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    templateId: context.contract.activeTemplateId || 'draft-template',
    managerId: input.managerId,
    scope: 'field',
    ruleType: token.includes('table') ? 'table-layout' : token.includes('entity') ? 'detect-entity' : 'canonical-field-map',
    sourcePattern: token,
    canonicalField: defaultCanonicalFields.find((field) => field.split('.').pop() === token.split('.').pop()) || token,
    outputToken: `{{${token}}}`,
    preserve: false,
    required: missing.has(token),
    priority: index + 1,
    validationState: missing.has(token) ? 'blocked' : 'valid',
    reason: missing.has(token) ? 'Required token needs canonical or client-data mapping.' : 'Token can be rendered from canonical field mapping.'
  }));

  return {
    staticTextBlocks: context.assets.length ? ['Legal disclosure copy', 'Round-specific dispute instruction', 'Signature and declaration paragraph'] : [],
    dynamicTokens: tokens.map((token) => ({
      token,
      required: missing.has(token),
      decision: decideTemplateTokenBehavior({
        token,
        hasCanonicalField: defaultCanonicalFields.includes(token) || token.includes('.'),
        hasClientValue: !missing.has(token),
        isStaticLegalText: token.toLowerCase().includes('static'),
        isTableToken: token.toLowerCase().includes('table'),
        isRequired: missing.has(token)
      })
    })),
    tables: context.assets.length ? [{ id: 'account-summary-table', rule: missing.has('table.rows') ? 'needs-row-source' : 'preserve-layout' }] : [],
    repeatedSections: context.assets.length ? ['bureau-specific dispute paragraph', 'account item loop'] : [],
    detectedEntities: ['consumer', 'creditor', 'bureau', 'account', 'round'],
    unmappedVariables: Array.from(missing),
    candidateCanonicalFields: defaultCanonicalFields,
    rules
  };
}

export async function buildTemplateRenderPlan(input: {
  supabase: SupabaseLike;
  managerId: string;
  round?: TemplateRound;
}) {
  const inspection = await inspectTemplateStructure(input);
  return {
    preservedBlocks: inspection.staticTextBlocks,
    replaceableVariables: inspection.dynamicTokens.filter((token) => token.decision !== 'preserve-static'),
    canonicalFieldBindings: inspection.rules.map((rule) => ({ token: rule.outputToken || rule.sourcePattern, canonicalField: rule.canonicalField || 'unmapped', status: rule.validationState })),
    tableInstructions: inspection.tables,
    missingRequiredFields: inspection.unmappedVariables,
    rendererWarnings: inspection.rules.filter((rule) => rule.validationState !== 'valid').map((rule) => rule.reason)
  };
}
