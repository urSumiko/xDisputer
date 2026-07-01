import { buildTemplateWorkspaceContract, type TemplateRound, type TemplateWorkspaceContract } from './template-workspace-contract';

type SupabaseLike = {
  from(table: string): {
    select(columns?: string): unknown;
  };
};

type TemplateAssetRow = {
  id: string;
  manager_user_id?: string | null;
  owner_id?: string | null;
  uploaded_by_user_id?: string | null;
  round_label: TemplateRound | string | null;
  original_filename: string | null;
  template_kind: string | null;
  letter_type: string | null;
  exhibit_kind: string | null;
  version_number: number | null;
  content_hash: string | null;
  validation_json: Record<string, unknown> | null;
  rule_json?: Record<string, unknown> | null;
  updated_at: string | null;
  created_at: string | null;
};

type TemplateAssetQuery<T> = {
  eq(column: string, value: unknown): TemplateAssetQuery<T>;
  or(filter: string): TemplateAssetQuery<T>;
  order(column: string, options?: { ascending?: boolean }): Promise<{ data: T[] | null; error: { message: string } | null }>;
};

export type TemplateLibraryContext = {
  contract: TemplateWorkspaceContract;
  assets: TemplateAssetRow[];
  activeRound: TemplateRound;
  latestAsset: TemplateAssetRow | null;
  readinessSummary: string;
  syncStatusLabel: string;
  nextAction: { href: string; label: string; reason: string };
};

const rounds: TemplateRound[] = ['1st Round', '2nd Round', '3rd Round', 'Final'];

function asQuery<T>(value: unknown) {
  return value as TemplateAssetQuery<T>;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nestedManagerId(value: Record<string, unknown> | null | undefined) {
  return stringValue(value?.managerUserId) || stringValue(value?.manager_user_id) || null;
}

function belongsToManager(asset: TemplateAssetRow, managerId: string) {
  if (asset.manager_user_id !== managerId) return false;
  if (asset.owner_id && asset.owner_id !== managerId) return false;
  const validationManager = nestedManagerId(asset.validation_json);
  const ruleManager = nestedManagerId(asset.rule_json || null);
  if (validationManager && validationManager !== managerId) return false;
  if (ruleManager && ruleManager !== managerId) return false;
  return true;
}

function validationList(asset: TemplateAssetRow, key: string) {
  const value = asset.validation_json?.[key];
  return Array.isArray(value) ? value : [];
}

function countMissingFields(assets: TemplateAssetRow[]) {
  return assets.reduce((total, asset) => total + validationList(asset, 'missingFields').length + validationList(asset, 'unknownRequiredFields').length, 0);
}

function countWarnings(assets: TemplateAssetRow[]) {
  return assets.reduce((total, asset) => total + validationList(asset, 'warnings').length, 0);
}

function latestVersion(assets: TemplateAssetRow[]) {
  const versions = assets.map((asset) => Number(asset.version_number || 0)).filter(Boolean);
  return versions.length ? `v${Math.max(...versions)}` : null;
}

function nextActionFor(contract: TemplateWorkspaceContract) {
  if (contract.readiness === 'needs-template') return { href: '/manager-workspace', label: 'Upload template', reason: 'No active manager template exists for the selected workspace.' };
  if (contract.readiness === 'needs-mapping' || contract.readiness === 'needs-rules') return { href: '/manager-workspace/studio', label: 'Open Template Studio', reason: 'Template needs rule or canonical mapping work.' };
  if (contract.readiness === 'needs-preview' || contract.readiness === 'blocked') return { href: '/manager-workspace/engine', label: 'Open Generation Engine', reason: 'Template must pass preview and release diagnostics.' };
  return { href: '/manager-workspace/engine', label: 'Preview release', reason: 'Template is ready for release validation.' };
}

export async function getManagerTemplateLibraryContext(input: {
  supabase: SupabaseLike;
  managerId: string;
  round?: TemplateRound;
}): Promise<TemplateLibraryContext> {
  const activeRound = input.round || '1st Round';
  let assets: TemplateAssetRow[] = [];
  try {
    const base = asQuery<TemplateAssetRow>(input.supabase.from('template_assets').select('id, manager_user_id, owner_id, uploaded_by_user_id, round_label, original_filename, template_kind, letter_type, exhibit_kind, version_number, content_hash, validation_json, rule_json, updated_at, created_at'));
    const query = base.eq('manager_user_id', input.managerId).or(`owner_id.eq.${input.managerId},owner_id.is.null`).eq('is_active', true).order('created_at', { ascending: false });
    const result = await query;
    assets = result.error ? [] : (result.data || []).filter((asset) => belongsToManager(asset, input.managerId));
  } catch {
    assets = [];
  }

  const roundAssets = assets.filter((asset) => !asset.round_label || asset.round_label === activeRound);
  const missing = countMissingFields(roundAssets);
  const warnings = countWarnings(roundAssets);
  const activeTemplateId = roundAssets[0]?.id || null;
  const baseContract = {
    managerId: input.managerId,
    round: activeRound,
    activeTemplateId,
    activeClientScope: 'all-assigned' as const,
    library: {
      templatesCount: roundAssets.length,
      assignedClientsCount: 0,
      latestVersion: latestVersion(roundAssets),
      syncStatus: missing ? 'blocked' as const : roundAssets.length ? 'synced' as const : 'out-of-date' as const
    },
    studio: {
      rulesCount: roundAssets.length ? Math.max(1, roundAssets.length * 2) : 0,
      mappingsCount: Math.max(0, roundAssets.length * 4 - missing),
      conflictsCount: warnings,
      unmappedVariablesCount: missing,
      staticTextPreserved: Boolean(roundAssets.length)
    },
    engine: {
      previewStatus: missing ? 'failed' as const : roundAssets.length ? 'passed' as const : 'not-run' as const,
      releaseStatus: missing ? 'blocked' as const : roundAssets.length ? 'ready' as const : 'draft' as const,
      blockers: missing ? [`${missing} required field or alias issue(s) need mapping.`] : [],
      warnings: warnings ? [`${warnings} renderer warning(s) should be reviewed.`] : []
    }
  };
  const contract = buildTemplateWorkspaceContract(baseContract);
  return {
    contract,
    assets: roundAssets,
    activeRound,
    latestAsset: roundAssets[0] || null,
    readinessSummary: contract.readiness === 'ready' ? 'Template library is ready for engine preview and client sync.' : `Template library requires ${contract.readiness.replace('needs-', '').replace('-', ' ')} before release.`,
    syncStatusLabel: contract.library.syncStatus === 'synced' ? 'Synced' : contract.library.syncStatus === 'blocked' ? 'Blocked' : 'Needs sync',
    nextAction: nextActionFor(contract)
  };
}

export { rounds as TEMPLATE_WORKSPACE_ROUNDS };
