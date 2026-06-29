import type { LetterRoute, LetterType, ParsedSource } from '../letter-engine';
import type { LetterReference, Round } from '../reference-store';
import { readReferenceFile } from '../reference-store';
import type { ExhibitKind, TemplateExhibits } from '../template-exhibits';
import { readTemplateExhibit } from '../template-exhibits';
import type { ManagerTemplateScopeUi } from '../manager-template-ui';
import {
  canUseLocalTemplateFallback,
  findManagerTemplateFileAsset,
  resolveManagerTemplateFile,
  type ManagerTemplateFileAsset
} from '../manager-template-file-resolver';
import { latestTemplateAssetsBySlot, templateAssetSlotKey } from '../supabase/template-registry';

export type RegistryTemplateAsset = ManagerTemplateFileAsset & {
  mime_type?: string | null;
  file_size?: number | null;
  contract_json?: unknown;
  validation_json?: Record<string, unknown> | null;
  content_hash?: string | null;
  version_number?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type TemplateSlotSummary = {
  slotKey: string;
  source: 'MANAGER_TEMPLATE_ASSET' | 'LOCAL_BROWSER' | 'MISSING';
  label: string;
  validationStatus: string | null;
  assetId?: string | null;
  versionNumber?: number | null;
  contentHash?: string | null;
};

export class ManagerTemplateResolver {
  constructor(
    private readonly input: {
      round: Round;
      routes: LetterRoute[];
      parsed: ParsedSource;
      references: LetterReference[];
      templates: TemplateExhibits;
      registryAssets: RegistryTemplateAsset[];
      managerTemplateScope?: Pick<ManagerTemplateScopeUi, 'canManageTemplates'> | null;
    }
  ) {}

  private localFallbackAllowed() {
    return canUseLocalTemplateFallback(this.input.managerTemplateScope);
  }

  activeAssets() {
    return latestTemplateAssetsBySlot(this.input.registryAssets).filter((asset) => asset.round_label === this.input.round);
  }

  letterAsset(type: LetterType) {
    return findManagerTemplateFileAsset({ assets: this.activeAssets(), letterType: type }) as RegistryTemplateAsset | null;
  }

  exhibitAsset(kind: ExhibitKind) {
    return findManagerTemplateFileAsset({ assets: this.activeAssets(), exhibitKind: kind }) as RegistryTemplateAsset | null;
  }

  requiredLetterTypes() {
    return Array.from(new Set(this.input.routes.map((route) => route.type)));
  }

  requiredAppendices() {
    const needsDisputePacket = this.input.routes.some((route) => route.type === 'DISPUTE');
    if (!needsDisputePacket) return [] as ExhibitKind[];
    const kinds: ExhibitKind[] = ['FCRA', 'AFFIDAVIT', 'ATTACHMENT'];
    if ((this.input.parsed.ftcAccounts || []).length > 0) kinds.push('FTC');
    return kinds;
  }

  duplicateActiveSlots() {
    const counts = new Map<string, number>();
    for (const asset of this.input.registryAssets.filter((item) => item.round_label === this.input.round)) {
      const key = templateAssetSlotKey(asset);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([slotKey, count]) => ({ slotKey, count }));
  }

  templateSummary(): TemplateSlotSummary[] {
    const summaries: TemplateSlotSummary[] = [];

    for (const type of this.requiredLetterTypes()) {
      const asset = this.letterAsset(type);
      const local = this.input.references.find((item) => item.round === this.input.round && item.type === type && item.file);
      summaries.push({
        slotKey: `${this.input.round}::LETTER::${type}`,
        source: asset ? 'MANAGER_TEMPLATE_ASSET' : local ? 'LOCAL_BROWSER' : 'MISSING',
        label: `${type === 'DISPUTE' ? 'Dispute' : 'Late Payment'} Letter`,
        validationStatus: String(asset?.validation_json?.status || local?.validationJson?.status || '') || null,
        assetId: asset?.id || local?.assetId || null,
        versionNumber: asset?.version_number || local?.versionNumber || null,
        contentHash: asset?.content_hash || local?.contentHash || null
      });
    }

    for (const kind of this.requiredAppendices()) {
      const asset = this.exhibitAsset(kind);
      const local = this.input.templates[kind];
      summaries.push({
        slotKey: `${this.input.round}::EXHIBIT::${kind}`,
        source: asset ? 'MANAGER_TEMPLATE_ASSET' : local ? 'LOCAL_BROWSER' : 'MISSING',
        label: `${kind} Exhibit`,
        validationStatus: String(asset?.validation_json?.status || local?.validationJson?.status || '') || null,
        assetId: asset?.id || local?.assetId || null,
        versionNumber: asset?.version_number || local?.versionNumber || null,
        contentHash: asset?.content_hash || local?.contentHash || null
      });
    }

    return summaries;
  }

  async resolveLetterBlob(type: LetterType) {
    const asset = this.letterAsset(type);
    const localSlot = this.input.references.find((item) => item.round === this.input.round && item.type === type);
    const localBlob = this.localFallbackAllowed() && localSlot?.id ? await readReferenceFile(localSlot.id).catch(() => null) : null;

    return resolveManagerTemplateFile({
      round: this.input.round,
      assets: asset ? [asset] : [],
      letterType: type,
      localBlob,
      allowLocalFallback: this.localFallbackAllowed()
    });
  }

  async resolveExhibitBlob(kind: ExhibitKind) {
    const asset = this.exhibitAsset(kind);
    const localBlob = this.localFallbackAllowed() ? await readTemplateExhibit(this.input.round, kind).catch(() => null) : null;

    return resolveManagerTemplateFile({
      round: this.input.round,
      assets: asset ? [asset] : [],
      exhibitKind: kind,
      localBlob,
      allowLocalFallback: this.localFallbackAllowed()
    });
  }
}
