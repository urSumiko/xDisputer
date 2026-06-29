'use client';

import { useMemo, useState } from 'react';
import type { ExhibitKind } from '../lib/template-exhibits';
import type { LetterReference, Round } from '../lib/reference-store';

type TemplateAsset = {
  id: string;
  round_label: Round;
  template_kind: 'LETTER' | 'EXHIBIT';
  letter_type: LetterReference['type'] | null;
  exhibit_kind: ExhibitKind | null;
  original_filename: string;
  validation_json?: Record<string, unknown> | null;
};

type ManagerRuleAction = 'PRESERVE' | 'REMOVE' | 'MAKE_OPTIONAL' | 'MAKE_DYNAMIC' | 'REPEAT_FOR_ENTITY' | 'USE_AS_STYLE_SEED';

type SavedRule = {
  assetId: string;
  target: 'static-block' | 'field-binding' | 'entity-block' | 'affidavit-domain';
  action: ManagerRuleAction;
  label: string;
  status: 'saving' | 'saved' | 'error';
  message?: string;
};

const ACTIONS: Array<{ action: ManagerRuleAction; label: string; target: SavedRule['target']; description: string }> = [
  { action: 'PRESERVE', label: 'Preserve', target: 'static-block', description: 'Keep selected manager text/style in future outputs.' },
  { action: 'REMOVE', label: 'Remove', target: 'static-block', description: 'Mark the selected block as intentionally removed.' },
  { action: 'MAKE_DYNAMIC', label: 'Make dynamic', target: 'field-binding', description: 'Turn selected text into a mapped field binding.' },
  { action: 'REPEAT_FOR_ENTITY', label: 'Repeat for entity', target: 'entity-block', description: 'Use selected block as account/inquiry/supporting-document prototype.' },
  { action: 'USE_AS_STYLE_SEED', label: 'Use style seed', target: 'entity-block', description: 'Preserve this paragraph style for generated repeated rows.' }
];

function assetLabel(asset: TemplateAsset) {
  return asset.template_kind === 'LETTER' ? `${asset.round_label} · ${asset.letter_type || 'LETTER'}` : `${asset.round_label} · ${asset.exhibit_kind || 'EXHIBIT'}`;
}

function validationValue(asset: TemplateAsset, key: string) {
  const direct = asset.validation_json?.[key];
  if (typeof direct === 'string') return direct;
  const managerOwned = asset.validation_json?.managerOwnedDocx;
  if (managerOwned && typeof managerOwned === 'object' && key in managerOwned) {
    const value = (managerOwned as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return null;
}

function arrayCount(asset: TemplateAsset, key: string) {
  const direct = asset.validation_json?.[key];
  if (Array.isArray(direct)) return direct.length;
  const managerOwned = asset.validation_json?.managerOwnedDocx;
  if (managerOwned && typeof managerOwned === 'object') {
    const value = (managerOwned as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value.length;
  }
  return 0;
}

function contractStatus(asset: TemplateAsset) {
  return validationValue(asset, 'status') || String(asset.validation_json?.status || 'uploaded');
}

function templateDomain(asset: TemplateAsset) {
  if (asset.template_kind === 'EXHIBIT' && asset.exhibit_kind === 'AFFIDAVIT') return 'AFFIDAVIT';
  if (asset.template_kind === 'EXHIBIT' && asset.exhibit_kind === 'FTC') return 'FTC_REPORT';
  if (asset.template_kind === 'LETTER' && asset.letter_type === 'LATE_PAYMENT') return 'LATE_PAYMENT_LETTER';
  if (asset.template_kind === 'LETTER') return 'DISPUTE_LETTER';
  return 'CUSTOM';
}

function hasAffidavitGap(asset: TemplateAsset) {
  return asset.exhibit_kind === 'AFFIDAVIT' || /affidavit/i.test(asset.original_filename) || templateDomain(asset) === 'AFFIDAVIT';
}

export default function ManagerOwnedDocxStudioPanel({ assets, round, canManageTemplates, onMessage }: { assets: TemplateAsset[]; round: Round; canManageTemplates: boolean; onMessage: (message: string) => void }) {
  const [rules, setRules] = useState<SavedRule[]>([]);
  const docxAssets = useMemo(() => assets.filter((asset) => /docx|word/i.test(String(asset.validation_json?.mimeType || asset.original_filename)) || asset.original_filename.toLowerCase().endsWith('.docx')), [assets]);
  const selected = docxAssets[0] || assets[0] || null;
  const summary = useMemo(() => ({
    assets: docxAssets.length,
    warnings: docxAssets.reduce((total, asset) => total + arrayCount(asset, 'warnings'), 0),
    missing: docxAssets.reduce((total, asset) => total + arrayCount(asset, 'missingFields'), 0),
    affidavit: docxAssets.some(hasAffidavitGap)
  }), [docxAssets]);

  async function saveRule(asset: TemplateAsset, action: ManagerRuleAction, target: SavedRule['target'], label: string) {
    const optimistic: SavedRule = { assetId: asset.id, target, action, label, status: 'saving' };
    setRules((current) => [optimistic, ...current].slice(0, 8));
    try {
      const response = await fetch('/api/template-contract-rules', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ templateAssetId: asset.id, templateDomain: templateDomain(asset), target, action, label, sampleText: asset.original_filename })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || 'Could not save manager DOCX rule.');
      setRules((current) => current.map((rule) => rule === optimistic ? { ...rule, status: 'saved', message: payload?.message || 'Saved' } : rule));
      onMessage(`${label} saved for ${asset.original_filename}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save manager DOCX rule.';
      setRules((current) => current.map((rule) => rule === optimistic ? { ...rule, status: 'error', message } : rule));
      onMessage(message);
    }
  }

  return <section className="admin-monitor-card manager-owned-docx-studio-panel" data-manager-owned-docx-studio="true" aria-label="Manager-owned DOCX preservation and affidavit mapping">
    <header className="manager-owned-docx-studio-header">
      <div>
        <p className="eyebrow">Template Studio · Manager-owned DOCX</p>
        <h2>Preservation + affidavit mapping</h2>
        <p>Use this panel to sync manager intent into the DOCX runtime: preserve custom text, remove intentional blocks, create dynamic fields, repeat entity blocks, and verify affidavit readiness.</p>
      </div>
      <div className="manager-owned-docx-status-grid" aria-label="Manager-owned DOCX status">
        <span><strong>{summary.assets}</strong><small>DOCX assets</small></span>
        <span><strong>{summary.warnings}</strong><small>warnings</small></span>
        <span><strong>{summary.missing}</strong><small>missing fields</small></span>
        <span><strong>{summary.affidavit ? 'mapped' : 'review'}</strong><small>affidavit</small></span>
      </div>
    </header>

    <div className="manager-owned-docx-grid">
      <div className="manager-owned-docx-assets">
        <h3>Active {round} files</h3>
        {docxAssets.length ? docxAssets.map((asset) => <article key={asset.id} className="manager-owned-docx-asset-card" data-template-asset-id={asset.id}>
          <div><strong>{asset.original_filename}</strong><small>{assetLabel(asset)} · {templateDomain(asset)}</small></div>
          <p>Status: <b>{contractStatus(asset)}</b></p>
          <p>Warnings: {arrayCount(asset, 'warnings')} · Missing fields: {arrayCount(asset, 'missingFields')}</p>
        </article>) : <p className="manager-owned-docx-empty">No editable DOCX asset is active for this round yet. Upload a DOCX letter or affidavit first.</p>}
      </div>

      <div className="manager-owned-docx-actions">
        <h3>Manager intent actions</h3>
        {selected ? <>
          <p className="manager-owned-docx-selected">Selected: <strong>{selected.original_filename}</strong></p>
          <div className="manager-owned-docx-action-list">
            {ACTIONS.map((item) => <button key={item.action} type="button" disabled={!canManageTemplates} onClick={() => saveRule(selected, item.action, item.target, item.label)} data-manager-owned-docx-action={item.action}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>)}
          </div>
          <button type="button" className="manager-owned-affidavit-button" disabled={!canManageTemplates} onClick={() => saveRule(selected, 'MAKE_DYNAMIC', 'affidavit-domain', 'Review affidavit mapping')} data-affidavit-mapping-action="review">
            Review affidavit mapping
          </button>
        </> : <p>Select or upload a DOCX asset to create manager-owned rules.</p>}
      </div>

      <div className="manager-owned-docx-rules">
        <h3>Recent saved rules</h3>
        {rules.length ? rules.map((rule, index) => <div key={`${rule.assetId}-${rule.action}-${index}`} className={`manager-owned-rule manager-owned-rule-${rule.status}`}>
          <strong>{rule.label}</strong>
          <span>{rule.target} · {rule.action} · {rule.status}</span>
          {rule.message ? <small>{rule.message}</small> : null}
        </div>) : <p>No rule changes in this browser session yet.</p>}
      </div>
    </div>
  </section>;
}
