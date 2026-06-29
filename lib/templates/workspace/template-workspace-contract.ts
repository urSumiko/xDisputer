export type TemplateWorkspaceProcess = 'template-source-of-truth' | 'template-authoring-rules' | 'template-execution-control';
export type TemplateWorkspaceReadiness = 'ready' | 'needs-template' | 'needs-rules' | 'needs-mapping' | 'needs-client-data' | 'needs-preview' | 'blocked';
export type TemplateRound = '1st Round' | '2nd Round' | '3rd Round' | 'Final';

export type PreserveDecision = 'preserve-static' | 'replace-with-canonical-field' | 'generate-from-client-data' | 'generate-from-manager-rule' | 'block-until-mapped';

export type TemplateWorkspaceContract = {
  managerId: string;
  round: TemplateRound;
  activeTemplateId: string | null;
  activeClientScope: 'all-assigned' | 'selected-client' | 'preview-only';
  readiness: TemplateWorkspaceReadiness;
  library: {
    templatesCount: number;
    assignedClientsCount: number;
    latestVersion: string | null;
    syncStatus: 'synced' | 'syncing' | 'out-of-date' | 'blocked';
  };
  studio: {
    rulesCount: number;
    mappingsCount: number;
    conflictsCount: number;
    unmappedVariablesCount: number;
    staticTextPreserved: boolean;
  };
  engine: {
    previewStatus: 'not-run' | 'passed' | 'warning' | 'failed';
    releaseStatus: 'draft' | 'ready' | 'released' | 'blocked';
    blockers: string[];
    warnings: string[];
  };
};

export type DynamicTemplateRule = {
  id: string;
  templateId: string;
  managerId: string;
  scope: 'global-template' | 'round' | 'client-assignment' | 'section' | 'field';
  ruleType: 'preserve-static-text' | 'replace-variable' | 'canonical-field-map' | 'detect-entity' | 'table-layout' | 'conditional-section' | 'incrementing-sequence' | 'renderer-directive' | 'parser-directive';
  sourcePattern: string;
  canonicalField?: string;
  outputToken?: string;
  preserve: boolean;
  required: boolean;
  priority: number;
  validationState: 'valid' | 'warning' | 'blocked';
  reason: string;
};

export function decideTemplateTokenBehavior(input: {
  token: string;
  hasCanonicalField: boolean;
  hasClientValue: boolean;
  isStaticLegalText: boolean;
  isTableToken: boolean;
  isRequired: boolean;
}): PreserveDecision {
  if (input.isStaticLegalText) return 'preserve-static';
  if (input.hasCanonicalField && input.hasClientValue) return 'replace-with-canonical-field';
  if (input.hasCanonicalField && !input.hasClientValue && input.isRequired) return 'block-until-mapped';
  if (input.isTableToken) return 'generate-from-client-data';
  return 'generate-from-manager-rule';
}

export function computeTemplateReadiness(contract: Omit<TemplateWorkspaceContract, 'readiness'>): TemplateWorkspaceReadiness {
  if (!contract.activeTemplateId) return 'needs-template';
  if (contract.studio.unmappedVariablesCount > 0) return 'needs-mapping';
  if (contract.studio.conflictsCount > 0) return 'needs-rules';
  if (contract.engine.previewStatus === 'failed') return 'blocked';
  if (contract.engine.previewStatus !== 'passed') return 'needs-preview';
  if (contract.engine.blockers.length > 0) return 'blocked';
  if (contract.library.syncStatus === 'blocked') return 'blocked';
  return 'ready';
}

export function readinessLabel(readiness: TemplateWorkspaceReadiness) {
  const labels: Record<TemplateWorkspaceReadiness, string> = {
    ready: 'Ready',
    'needs-template': 'Needs template',
    'needs-rules': 'Needs rules',
    'needs-mapping': 'Needs mapping',
    'needs-client-data': 'Needs client data',
    'needs-preview': 'Needs preview',
    blocked: 'Blocked'
  };
  return labels[readiness];
}

export function buildTemplateWorkspaceContract(input: Omit<TemplateWorkspaceContract, 'readiness'>): TemplateWorkspaceContract {
  return { ...input, readiness: computeTemplateReadiness(input) };
}
