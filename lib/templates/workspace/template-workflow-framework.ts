import type { DynamicTemplateInspectionResult, DynamicTemplateRule } from '../intelligence';
import type { TemplateLibraryContext } from './template-library-service';
import type { TemplateStructureInspection } from './template-studio-service';

export type WorkflowLane = 'detect' | 'classify' | 'map' | 'preserve' | 'render' | 'test';
export type WorkflowSeverity = 'ready' | 'warning' | 'blocked';

export type TemplateWorkflowRule = {
  id: string;
  lane: WorkflowLane;
  title: string;
  sourceText: string;
  canonicalTarget: string;
  renderAction: string;
  preservation: string;
  customization: string;
  status: WorkflowSeverity;
  reason: string;
};

export type TemplateWorkflowFramework = {
  title: string;
  summary: string;
  status: WorkflowSeverity;
  principles: string[];
  rules: TemplateWorkflowRule[];
  nextActions: string[];
};

const universalPrinciples = [
  'Match template wording and placeholders before rendering.',
  'Map detected wording to canonical Source Data fields.',
  'Replace values in the original template location when an anchor exists.',
  'Preserve legal and static wording unless the manager creates a specific rule.',
  'Block output when a required field has no canonical mapping.',
  'Reuse the same workflow for letters, affidavits, exhibits, and future templates.'
];

function cleanKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'rule';
}

function rule(input: Omit<TemplateWorkflowRule, 'id'>): TemplateWorkflowRule {
  return { id: cleanKey(`${input.lane}-${input.sourceText}-${input.canonicalTarget}`), ...input };
}

function statusFrom(items: Array<{ status?: string }>): WorkflowSeverity {
  if (items.some((item) => item.status === 'blocked' || item.status === 'BLOCKED')) return 'blocked';
  if (items.some((item) => item.status === 'warning' || item.status === 'WARNING')) return 'warning';
  return 'ready';
}

function accountInPlaceRule(): TemplateWorkflowRule {
  return rule({
    lane: 'render',
    title: 'Account identity fills in-place',
    sourceText: 'Account Name - Account number',
    canonicalTarget: 'accounts.lines + account.name + account.number',
    renderAction: 'Replace this wording in the same paragraph or table cell. Do not append the account value into another location.',
    preservation: 'Keep the surrounding affidavit wording and only replace the account value anchor.',
    customization: 'Manager can override the phrase, canonical fields, or fallback behavior in Studio registration notes.',
    status: 'warning',
    reason: 'This prevents account values from rendering in the wrong section.'
  });
}

function rulesFromInspection(inspection: DynamicTemplateInspectionResult, dynamicRules: DynamicTemplateRule[]): TemplateWorkflowRule[] {
  const detected = inspection.suggestedRules.slice(0, 14).map((finding) => rule({
    lane: finding.type === 'preserve-static-text' || finding.preserve ? 'preserve' : finding.type === 'table-layout' ? 'preserve' : finding.suggestedCanonicalField ? 'map' : finding.type === 'parser-directive' ? 'detect' : 'classify',
    title: finding.type.replace(/-/g, ' '),
    sourceText: finding.sourceText,
    canonicalTarget: finding.suggestedCanonicalField || finding.suggestedOutputToken || 'manager rule required',
    renderAction: finding.suggestedCanonicalField ? 'Render from canonical Source Data.' : finding.preserve ? 'Preserve this template content.' : 'Manager must classify this finding.',
    preservation: finding.preserve ? 'Preserve unless manager override exists.' : 'Replace only the detected field or anchor.',
    customization: 'Can be adjusted by manager rule, parser directive, or canonical mapping.',
    status: finding.required && !finding.suggestedCanonicalField ? 'blocked' : finding.confidence < 0.72 ? 'warning' : 'ready',
    reason: finding.reason
  }));

  const storedRules = dynamicRules.slice(0, 8).map((stored) => rule({
    lane: stored.ruleType === 'preserve-static-text' ? 'preserve' : stored.ruleType === 'renderer-directive' ? 'render' : stored.ruleType === 'parser-directive' ? 'detect' : 'map',
    title: stored.ruleKey,
    sourceText: stored.sourceText || stored.sourcePath || stored.ruleKey,
    canonicalTarget: stored.canonicalField || stored.outputToken || 'custom manager rule',
    renderAction: stored.enabled ? 'Enabled for generation.' : 'Disabled until manager enables it.',
    preservation: stored.preserve ? 'Preserve static content.' : 'Dynamic replacement allowed.',
    customization: 'Stored manager rule can be updated without changing the template file.',
    status: stored.validationState === 'blocked' ? 'blocked' : stored.validationState === 'warning' ? 'warning' : 'ready',
    reason: stored.validationReason || 'Manager rule is available.'
  }));

  const hasAccountAnchor = detected.some((item) => item.sourceText.toLowerCase().includes('account name'));
  return [...(hasAccountAnchor ? [] : [accountInPlaceRule()]), ...detected, ...storedRules];
}

export function buildTemplateWorkflowFramework(input: {
  context: TemplateLibraryContext;
  structure: TemplateStructureInspection;
  intelligence: DynamicTemplateInspectionResult;
  dynamicRules: DynamicTemplateRule[];
}): TemplateWorkflowFramework {
  const rules = rulesFromInspection(input.intelligence, input.dynamicRules);
  const status = statusFrom(rules);
  const nextActions = [
    status === 'blocked' ? 'Resolve blocked canonical mappings before generation.' : 'Run Template Test Lab before assigning to Disputers.',
    input.context.latestAsset ? 'Register or update the precision profile after changing template wording.' : 'Upload a manager template first.',
    'Use the account in-place rule for affidavits and any future template that contains account identity wording.'
  ];

  return {
    title: 'Universal Template Workflow Framework',
    summary: 'A single manager-owned workflow for phrase matching, parser rules, canonical mappings, variables, preservation logic, renderer behavior, and test preview across all templates.',
    status,
    principles: universalPrinciples,
    rules,
    nextActions
  };
}
