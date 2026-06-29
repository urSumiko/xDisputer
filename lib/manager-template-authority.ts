import type { ManagerTemplateScopeUi } from './manager-template-ui';

export type ManagerTemplateAuthorityMode = 'MANAGER_EDIT' | 'CLIENT_READONLY' | 'POLICY_LOADING';
export type TemplateQualityTone = 'ready' | 'warning' | 'missing';

export type TemplateAuthorityState = {
  mode: ManagerTemplateAuthorityMode;
  canUpload: boolean;
  canReplace: boolean;
  canRemove: boolean;
  isReadOnly: boolean;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  statusBadge: string;
};

export type TemplateQualitySummary = {
  tone: TemplateQualityTone;
  label: string;
  detail: string;
};

export type TemplateProvenanceInput = {
  file?: string | null;
  name?: string | null;
  assetId?: string | null;
  versionNumber?: number | null;
  contentHash?: string | null;
  validationJson?: Record<string, unknown> | null;
};

export function resolveTemplateAuthority(scope: ManagerTemplateScopeUi | null | undefined): TemplateAuthorityState {
  if (!scope) {
    return {
      mode: 'POLICY_LOADING',
      canUpload: false,
      canReplace: false,
      canRemove: false,
      isReadOnly: true,
      eyebrow: 'Loading manager template policy',
      title: 'Checking template authority',
      description: 'The workspace is resolving whether this user can manage templates or only consume assigned-manager defaults.',
      actionLabel: 'Template controls will unlock only for authorized managers.',
      statusBadge: 'Loading policy'
    };
  }

  if (scope.canManageTemplates) {
    return {
      mode: 'MANAGER_EDIT',
      canUpload: true,
      canReplace: true,
      canRemove: true,
      isReadOnly: false,
      eyebrow: 'Manager template authority',
      title: 'Manager controls default templates',
      description: 'Uploads here become the active manager defaults used by assigned clients during generation.',
      actionLabel: 'Upload, replace, or remove manager defaults from the template cards.',
      statusBadge: 'Manager editable'
    };
  }

  return {
    mode: 'CLIENT_READONLY',
    canUpload: false,
    canReplace: false,
    canRemove: false,
    isReadOnly: true,
    eyebrow: 'Managed by assigned manager',
    title: 'Client uses assigned-manager templates',
    description: 'Template upload is locked for clients. Generation uses the active templates uploaded by the assigned manager.',
    actionLabel: 'Review readiness, then continue to Source Data when manager defaults are ready.',
    statusBadge: 'Read-only client view'
  };
}

export function templateVersionLabel(versionNumber?: number | null) {
  return typeof versionNumber === 'number' && Number.isFinite(versionNumber) ? `v${versionNumber}` : 'active';
}

export function shortContentHash(hash?: string | null) {
  return hash ? hash.slice(0, 10) : null;
}

export function summarizeTemplateQuality(input: TemplateProvenanceInput): TemplateQualitySummary {
  if (!input.file && !input.name) {
    return { tone: 'missing', label: 'Required', detail: 'No active manager template is available for this slot.' };
  }

  const validation = input.validationJson || {};
  const status = String(validation.status || validation.quality || validation.grade || '').toLowerCase();
  const missingFields = Array.isArray(validation.missingFields) ? validation.missingFields.length : Array.isArray(validation.missing_fields) ? validation.missing_fields.length : 0;
  const warningCount = Array.isArray(validation.warnings) ? validation.warnings.length : 0;

  if (missingFields > 0) {
    return { tone: 'warning', label: 'Needs review', detail: `${missingFields} mapping field${missingFields === 1 ? '' : 's'} need review before final generation.` };
  }

  if (warningCount > 0) {
    return { tone: 'warning', label: 'Ready with warnings', detail: `${warningCount} validation warning${warningCount === 1 ? '' : 's'} found.` };
  }

  if (status.includes('fail') || status.includes('invalid')) {
    return { tone: 'warning', label: 'Needs review', detail: 'Validation did not mark this template as fully ready.' };
  }

  return { tone: 'ready', label: 'Ready', detail: 'Manager default is active and available for assigned-client generation.' };
}

export function summarizeTemplateProvenance(input: TemplateProvenanceInput) {
  const name = input.file || input.name || 'No active file';
  const version = templateVersionLabel(input.versionNumber);
  const hash = shortContentHash(input.contentHash);
  return hash ? `${name} · Manager default ${version} · hash ${hash}` : `${name} · Manager default ${version}`;
}
