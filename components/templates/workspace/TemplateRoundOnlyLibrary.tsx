'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import TemplateProgressiveWorkspace from '../../TemplateProgressiveWorkspace';
import ManagerTemplateWorkspaceChrome from '../../ManagerTemplateWorkspaceChrome';
import { defaultReferences, type LetterReference, type Round } from '../../../lib/reference-store';
import { exhibitModes, exhibitTitles, type ExhibitAsset, type ExhibitKind, type TemplateExhibits } from '../../../lib/template-exhibits';
import type { ManagerTemplateScopeUi } from '../../../lib/manager-template-ui';

type TemplateAsset = {
  id: string;
  round_label?: Round | string | null;
  template_kind?: 'LETTER' | 'EXHIBIT' | string | null;
  letter_type?: LetterReference['type'] | string | null;
  exhibit_kind?: ExhibitKind | string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  content_hash?: string | null;
  version_number?: number | null;
  validation_json?: Record<string, unknown> | null;
};

type TemplateApiPayload = {
  assets?: TemplateAsset[];
  managerTemplateScope?: ManagerTemplateScopeUi | null;
  data?: {
    assets?: TemplateAsset[];
    managerTemplateScope?: ManagerTemplateScopeUi | null;
  };
  error?: string | { message?: string };
  message?: string;
};

const emptyExhibits: TemplateExhibits = { FCRA: null, AFFIDAVIT: null, ATTACHMENT: null, FTC: null };

function payloadData(payload: TemplateApiPayload | null) {
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload;
}

function payloadMessage(payload: TemplateApiPayload | null, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === 'string') return payload.error;
  if (payload.error && typeof payload.error === 'object' && payload.error.message) return payload.error.message;
  return payload.message || fallback;
}

function validExhibitKind(value: unknown): value is ExhibitKind {
  return value === 'FCRA' || value === 'AFFIDAVIT' || value === 'ATTACHMENT' || value === 'FTC';
}

function assetToLetter(slot: LetterReference, asset?: TemplateAsset): LetterReference {
  if (!asset) return slot;
  return {
    ...slot,
    file: asset.original_filename || '',
    size: asset.file_size || undefined,
    assetId: asset.id,
    source: 'MANAGER_TEMPLATE_ASSET',
    versionNumber: asset.version_number || null,
    contentHash: asset.content_hash || null,
    validationJson: asset.validation_json || null
  };
}

function assetToExhibit(asset: TemplateAsset): ExhibitAsset | null {
  if (!validExhibitKind(asset.exhibit_kind)) return null;
  const kind = asset.exhibit_kind;
  return {
    id: asset.id,
    kind,
    mode: exhibitModes[kind],
    name: asset.original_filename || exhibitTitles[kind],
    type: asset.mime_type || 'application/octet-stream',
    size: asset.file_size || 0,
    assetId: asset.id,
    source: 'MANAGER_TEMPLATE_ASSET',
    versionNumber: asset.version_number || null,
    contentHash: asset.content_hash || null,
    validationJson: asset.validation_json || null
  };
}

function assetsToExhibits(assets: TemplateAsset[]): TemplateExhibits {
  const next: TemplateExhibits = { ...emptyExhibits };
  assets.filter((asset) => asset.template_kind === 'EXHIBIT').forEach((asset) => {
    const exhibit = assetToExhibit(asset);
    if (exhibit) next[exhibit.kind] = exhibit;
  });
  return next;
}

function roundAssetsFor(assets: TemplateAsset[], round: Round) {
  return assets.filter((asset) => !asset.round_label || asset.round_label === round);
}

export default function TemplateRoundOnlyLibrary() {
  const [round, setRound] = useState<Round>('1st Round');
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [managerTemplateScope, setManagerTemplateScope] = useState<ManagerTemplateScopeUi | null>(null);
  const [message, setMessage] = useState('Loading manager template authority. Upload controls stay locked until verified.');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAssets = useCallback(async (selectedRound: Round) => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/template-assets?round=${encodeURIComponent(selectedRound)}&t=${Date.now()}`, { cache: 'no-store', headers: { accept: 'application/json', 'cache-control': 'no-store' } });
      const payload = await response.json().catch(() => null) as TemplateApiPayload | null;
      const data = payloadData(payload);
      if (!response.ok) throw new Error(payloadMessage(payload, 'Could not load manager templates.'));
      setAssets(Array.isArray(data?.assets) ? data.assets : []);
      setManagerTemplateScope(data?.managerTemplateScope || null);
      setMessage(data?.managerTemplateScope?.canManageTemplates ? `${selectedRound} manager template authority verified. Upload controls are enabled.` : 'Manager template authority is read-only or unavailable. Upload controls are locked.');
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'Could not load manager templates.';
      setLoadError(nextMessage);
      setMessage(nextMessage);
      setAssets([]);
      setManagerTemplateScope(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAssets(round); }, [round, loadAssets]);

  const activeAssets = useMemo(() => roundAssetsFor(assets, round), [assets, round]);
  const slots = useMemo(() => defaultReferences().filter((slot) => slot.round === round).map((slot) => assetToLetter(slot, activeAssets.find((asset) => asset.template_kind === 'LETTER' && asset.letter_type === slot.type))), [round, activeAssets]);
  const exhibits = useMemo(() => assetsToExhibits(activeAssets), [activeAssets]);

  async function handleUploadLetter(slot: LetterReference, file: File) {
    setAssets((current) => current.map((asset) => asset.template_kind === 'LETTER' && asset.letter_type === slot.type && (!asset.round_label || asset.round_label === round) ? { ...asset, original_filename: file.name, file_size: file.size } : asset));
  }

  async function handleRemoveLetter() {
    // TemplatePacketConfigurator owns the API delete and refreshes through onTemplateMutation.
  }

  async function handleExhibitsHydrated() {
    // Manager template assets are Supabase-authoritative; local exhibit hydration is best-effort only.
  }

  async function handleTemplateMutation() {
    await loadAssets(round);
  }

  return <section className="manager-template-client-flow manager-workspace-body-shell template-library-native-progressive-hub" data-template-library-minimal="progressive-upload" data-manager-template-progressive="uses-active-disputer-template-ui" data-manager-template-scope-state={managerTemplateScope?.canManageTemplates ? 'verified-upload' : loading ? 'loading' : 'locked'}>
    <ManagerTemplateWorkspaceChrome />
    {message ? <section className={`admin-monitor-card manager-template-workflow-status compact-workspace-command merged-template-command ${loadError ? 'error' : ''}`} aria-label="Manager template workspace status">
      <div className="merged-template-command-copy">
        <p className="eyebrow">Template Library</p>
        <strong>{loading ? 'Checking authority' : loadError ? 'Needs attention' : managerTemplateScope?.canManageTemplates ? 'Ready to upload' : 'Read only'}</strong>
        <span>{message}</span>
      </div>
    </section> : null}
    <TemplateProgressiveWorkspace
      round={round}
      slots={slots}
      supportingReady={false}
      managerTemplateScope={managerTemplateScope}
      managedExhibits={exhibits}
      onSelectRound={(next) => { setRound(next); setMessage(`${next} selected for manager default template setup.`); }}
      onUploadLetter={handleUploadLetter}
      onRemoveLetter={handleRemoveLetter}
      onExhibitsChange={handleExhibitsHydrated}
      onTemplateMutation={handleTemplateMutation}
      onMessage={setMessage}
    />
  </section>;
}
