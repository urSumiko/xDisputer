import type { SupabaseClient } from '@supabase/supabase-js';
import type { LetterType } from '../letter-engine';
import type { ExhibitKind } from '../template-exhibits';
import type { Round } from '../reference-store';

export type TemplateKind = 'LETTER' | 'EXHIBIT';

export type TemplateAssetRecord = {
  id: string;
  owner_id: string;
  manager_user_id?: string | null;
  uploaded_by_user_id?: string | null;
  template_scope?: 'MANAGER' | null;
  round_label: Round;
  template_kind: TemplateKind;
  letter_type: LetterType | null;
  exhibit_kind: ExhibitKind | null;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number | null;
  content_hash?: string | null;
  contract_json: Record<string, unknown>;
  validation_json?: Record<string, unknown>;
  rule_json: Record<string, unknown>;
  version_number: number;
  is_active: boolean;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type TemplateAssetSlotLike = {
  round_label: string;
  template_kind: string;
  letter_type: string | null;
  exhibit_kind: string | null;
  version_number?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export function templateStoragePath(input: {
  userId?: string;
  managerUserId?: string;
  round: Round;
  kind: TemplateKind;
  type: LetterType | ExhibitKind;
  filename: string;
}) {
  const owner = input.managerUserId || input.userId;
  if (!owner) throw new Error('Template storage path requires a manager user id.');

  const safeRound = input.round.replace(/\s+/g, '-').toLowerCase();
  const safeFile = input.filename.replace(/[^a-z0-9._-]+/gi, '-');
  const safeType = String(input.type).replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  return `manager/${owner}/${safeRound}/${input.kind.toLowerCase()}/${safeType}/${Date.now()}-${safeFile}`;
}

export function templateAssetSlotKey(asset: TemplateAssetSlotLike) {
  return [
    asset.round_label,
    asset.template_kind,
    asset.letter_type || asset.exhibit_kind || 'UNKNOWN'
  ].join('::');
}

function dateRank(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortTemplateAssetsByFreshness<T extends TemplateAssetSlotLike>(assets: T[]) {
  return [...assets].sort((left, right) => {
    const leftSlot = templateAssetSlotKey(left);
    const rightSlot = templateAssetSlotKey(right);
    if (leftSlot !== rightSlot) return leftSlot.localeCompare(rightSlot);

    const versionDelta = Number(right.version_number || 0) - Number(left.version_number || 0);
    if (versionDelta !== 0) return versionDelta;

    const updatedDelta = dateRank(right.updated_at) - dateRank(left.updated_at);
    if (updatedDelta !== 0) return updatedDelta;

    return dateRank(right.created_at) - dateRank(left.created_at);
  });
}

export function latestTemplateAssetsBySlot<T extends TemplateAssetSlotLike>(assets: T[]) {
  const selected = new Map<string, T>();

  sortTemplateAssetsByFreshness(assets).forEach((asset) => {
    const key = templateAssetSlotKey(asset);
    if (!selected.has(key)) selected.set(key, asset);
  });

  return Array.from(selected.values());
}

export function templateAssetSlotMap<T extends TemplateAssetSlotLike>(assets: T[]) {
  return latestTemplateAssetsBySlot(assets).reduce<Record<string, T>>((accumulator, asset) => {
    accumulator[templateAssetSlotKey(asset)] = asset;
    return accumulator;
  }, {});
}

export async function listActiveTemplateAssets(
  supabase: SupabaseClient,
  round: Round,
  managerUserId?: string | null
) {
  let query = supabase
    .from('template_assets')
    .select('*')
    .eq('round_label', round)
    .eq('is_active', true)
    .order('version_number', { ascending: false })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (managerUserId) query = query.eq('manager_user_id', managerUserId);

  return query;
}
