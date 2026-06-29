import type { LetterType } from './letter-engine';
import type { Round } from './reference-store';
import type { ExhibitKind } from './template-exhibits';

export type ManagerTemplateFileAsset = {
  id: string;
  round_label: Round;
  template_kind: 'LETTER' | 'EXHIBIT';
  letter_type: LetterType | null;
  exhibit_kind: ExhibitKind | null;
  original_filename: string;
};

export function managerTemplateFileUrl(input: { round: Round; templateKind: 'LETTER' | 'EXHIBIT'; letterType?: LetterType | null; exhibitKind?: ExhibitKind | null }) {
  const params = new URLSearchParams();
  params.set('round', input.round);
  params.set('templateKind', input.templateKind);
  if (input.templateKind === 'LETTER' && input.letterType) params.set('letterType', input.letterType);
  if (input.templateKind === 'EXHIBIT' && input.exhibitKind) params.set('exhibitKind', input.exhibitKind);
  return `/api/template-assets/file?${params.toString()}`;
}

export function findManagerTemplateFileAsset(input: { assets: ManagerTemplateFileAsset[]; letterType?: LetterType; exhibitKind?: ExhibitKind }) {
  if (input.letterType) return input.assets.find((asset) => asset.template_kind === 'LETTER' && asset.letter_type === input.letterType) || null;
  if (input.exhibitKind) return input.assets.find((asset) => asset.template_kind === 'EXHIBIT' && asset.exhibit_kind === input.exhibitKind) || null;
  return null;
}

export async function fetchManagerTemplateFile(input: { round: Round; asset: ManagerTemplateFileAsset }) {
  const response = await fetch(managerTemplateFileUrl({ round: input.round, templateKind: input.asset.template_kind, letterType: input.asset.letter_type, exhibitKind: input.asset.exhibit_kind }));
  if (!response.ok) throw new Error(`Manager template file could not be loaded: ${await response.text().catch(() => response.statusText)}`);
  return response.blob();
}

export async function resolveManagerTemplateFile(input: { round: Round; assets: ManagerTemplateFileAsset[]; letterType?: LetterType; exhibitKind?: ExhibitKind; localBlob?: Blob | null; allowLocalFallback: boolean }) {
  const asset = findManagerTemplateFileAsset({ assets: input.assets, letterType: input.letterType, exhibitKind: input.exhibitKind });
  if (asset) return fetchManagerTemplateFile({ round: input.round, asset });
  if (input.allowLocalFallback && input.localBlob) return input.localBlob;
  return null;
}

export function canUseLocalTemplateFallback(input?: { canManageTemplates?: boolean | null } | null) {
  return Boolean(input?.canManageTemplates);
}
