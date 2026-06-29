export type ManagerTemplateLibraryAsset = {
  id: string;
  round_label: string;
  template_kind: string;
  letter_type: string | null;
  exhibit_kind: string | null;
  original_filename: string;
  version_number: number | null;
  is_active: boolean | null;
  content_hash: string | null;
  validation_json?: Record<string, unknown> | null;
};

export type ManagerTemplateLibrarySummary = {
  managerUserId: string;
  affectedClientCount: number;
  totalAssetCount: number;
  activeAssetCount: number;
  activeSlotCount: number;
  historicalAssetCount: number;
};

export function managerTemplateSlotKey(asset: Pick<ManagerTemplateLibraryAsset, 'round_label' | 'template_kind' | 'letter_type' | 'exhibit_kind'>) {
  return [asset.round_label, asset.template_kind, asset.letter_type || asset.exhibit_kind || 'UNKNOWN'].join('::');
}

export function managerTemplateQuality(asset: Pick<ManagerTemplateLibraryAsset, 'validation_json'>) {
  const validation = asset.validation_json || {};
  const status = typeof validation.status === 'string' ? validation.status : 'UNKNOWN';
  const confidence = typeof validation.confidence === 'number' ? validation.confidence : null;
  return {
    tier: status === 'READY' ? 'A' : status === 'WARNING' ? 'B' : status === 'BLOCKED' ? 'F' : 'C',
    status,
    confidence
  };
}

export function buildManagerTemplateLibrarySummary(input: {
  managerUserId: string;
  affectedClientCount: number;
  assets: ManagerTemplateLibraryAsset[];
}): ManagerTemplateLibrarySummary {
  const activeAssets = input.assets.filter((asset) => asset.is_active);
  return {
    managerUserId: input.managerUserId,
    affectedClientCount: input.affectedClientCount,
    totalAssetCount: input.assets.length,
    activeAssetCount: activeAssets.length,
    activeSlotCount: new Set(activeAssets.map(managerTemplateSlotKey)).size,
    historicalAssetCount: input.assets.length - activeAssets.length
  };
}
