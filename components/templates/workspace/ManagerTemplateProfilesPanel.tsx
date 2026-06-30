'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LetterReference, Round } from '../../../lib/reference-store';
import type { ExhibitKind, TemplateExhibits } from '../../../lib/template-exhibits';

type ProfileOutputMode = 'STANDALONE_DOCX' | 'PACKET_ATTACHMENT';
type ProfileDuplicateRule = 'preserve' | 'account_name' | 'account_number';
type ProfileStatus = 'draft' | 'tested' | 'published_locked';

type TemplateAssetSummary = {
  id: string;
  round_label?: Round | string | null;
  template_kind?: 'LETTER' | 'EXHIBIT' | string | null;
  letter_type?: LetterReference['type'] | string | null;
  exhibit_kind?: ExhibitKind | string | null;
  original_filename?: string | null;
  version_number?: number | null;
};

type ManagerTemplateProfileDraft = {
  id: string;
  name: string;
  outputMode: ProfileOutputMode;
  duplicateRule: ProfileDuplicateRule;
  dateFormat: string;
  sourceFields: string[];
  createdAt: string;
  updatedAt: string;
  status: ProfileStatus;
};

type Props = {
  round: Round;
  slots: LetterReference[];
  exhibits: TemplateExhibits;
  assets: TemplateAssetSummary[];
  canManageTemplates: boolean;
  onMessage?: (message: string) => void;
};

const STORAGE_KEY = 'xdisputer.manager.templateProfiles.v1';
const DEFAULT_FIELDS = ['client.name', 'client.address', 'client.ssnMasked', 'custom.reason'];

function profileId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadDrafts(): ManagerTemplateProfileDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.name === 'string') : [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: ManagerTemplateProfileDraft[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

function compactList(values: string[]) {
  return values.filter(Boolean).slice(0, 4).join(', ') || 'No fields yet';
}

function outputModeLabel(mode: ProfileOutputMode) {
  return mode === 'PACKET_ATTACHMENT' ? 'Packet attachment' : 'Standalone DOCX';
}

function duplicateRuleLabel(rule: ProfileDuplicateRule) {
  if (rule === 'account_name') return 'Dedupe by account name';
  if (rule === 'account_number') return 'Dedupe by account number';
  return 'Preserve duplicates';
}

function activeSystemProfiles(slots: LetterReference[], exhibits: TemplateExhibits) {
  return [
    ...slots.map((slot) => ({
      key: `letter-${slot.type}`,
      title: slot.type === 'DISPUTE' ? 'Dispute Letter' : 'Late Payment Letter',
      file: slot.file || 'Not uploaded',
      mode: 'System profile',
      status: slot.file ? 'Active' : 'Missing'
    })),
    ...(['FCRA', 'AFFIDAVIT', 'ATTACHMENT'] as ExhibitKind[]).map((kind) => {
      const exhibit = exhibits[kind];
      return {
        key: `exhibit-${kind}`,
        title: kind === 'FCRA' ? 'FCRA Legal Exhibit' : kind === 'AFFIDAVIT' ? 'Affidavit' : 'Attachment',
        file: exhibit?.name || 'Not uploaded',
        mode: kind === 'AFFIDAVIT' ? 'System profile with affidavit repair' : 'System profile',
        status: exhibit ? 'Active' : 'Missing'
      };
    })
  ];
}

export default function ManagerTemplateProfilesPanel({ round, slots, exhibits, assets, canManageTemplates, onMessage }: Props) {
  const [drafts, setDrafts] = useState<ManagerTemplateProfileDraft[]>([]);
  const [name, setName] = useState('ChexSystems Dispute');
  const [outputMode, setOutputMode] = useState<ProfileOutputMode>('STANDALONE_DOCX');
  const [duplicateRule, setDuplicateRule] = useState<ProfileDuplicateRule>('preserve');
  const [dateFormat, setDateFormat] = useState('M/D/YYYY');
  const [sourceFields, setSourceFields] = useState(DEFAULT_FIELDS.join('\n'));

  useEffect(() => setDrafts(loadDrafts()), []);

  const systemProfiles = useMemo(() => activeSystemProfiles(slots, exhibits), [slots, exhibits]);
  const activeManagerFiles = useMemo(() => assets.filter((asset) => asset.original_filename).length, [assets]);

  function updateDrafts(next: ManagerTemplateProfileDraft[], message: string) {
    setDrafts(next);
    saveDrafts(next);
    onMessage?.(message);
  }

  function createDraft() {
    if (!canManageTemplates) {
      onMessage?.('Template Profile drafts are locked until manager template authority is verified.');
      return;
    }

    const cleanName = name.replace(/\s+/g, ' ').trim();
    if (!cleanName) {
      onMessage?.('Add a profile name before creating the draft.');
      return;
    }

    const fields = sourceFields.split(/\r?\n|,/).map((field) => field.trim()).filter(Boolean);
    const now = new Date().toISOString();
    const draft: ManagerTemplateProfileDraft = {
      id: profileId(),
      name: cleanName,
      outputMode,
      duplicateRule,
      dateFormat: dateFormat.trim() || 'M/D/YYYY',
      sourceFields: fields.length ? fields : DEFAULT_FIELDS,
      createdAt: now,
      updatedAt: now,
      status: 'draft'
    };

    updateDrafts([draft, ...drafts], `${cleanName} profile draft created. It is safe and not connected to generation yet.`);
  }

  function removeDraft(id: string) {
    updateDrafts(drafts.filter((draft) => draft.id !== id), 'Template Profile draft removed.');
  }

  function markTested(id: string) {
    updateDrafts(drafts.map((draft) => draft.id === id ? { ...draft, status: 'tested', updatedAt: new Date().toISOString() } : draft), 'Profile draft marked as tested. Publishing remains locked until profile-engine execution is enabled.');
  }

  return <section className="panel manager-template-profile-panel" data-manager-template-profiles="safe-draft-layer" aria-label="Manager Template Profiles">
    <header className="template-stage-command">
      <div className="template-stage-heading">
        <p className="eyebrow">Manager-only extension layer</p>
        <h2>Template Profiles</h2>
        <p>Register custom template intent, mappings, and generation rules without changing the existing packet renderers.</p>
      </div>
      <div className="template-selected-badges"><span>{round}</span><span>{activeManagerFiles} active file(s)</span><span>Safe draft mode</span></div>
    </header>

    <div className="template-packet-selection-grid">
      <article className="template-packet-choice primary" data-template-profile-mode="system">
        <span className="template-selection-tag">Protected</span>
        <h3>System packet profiles</h3>
        <p>Dispute, Late Payment, Affidavit, FCRA, and Attachment keep the current stable backend logic.</p>
        <div className="template-wire-list">
          {systemProfiles.map((profile) => <div key={profile.key} className="template-wire-card"><header><strong>{profile.title}</strong><small>{profile.status}</small></header><p>{profile.file}</p><small>{profile.mode}</small></div>)}
        </div>
      </article>

      <article className="template-packet-choice" data-template-profile-mode="custom-draft">
        <span className="template-selection-tag optional">Custom</span>
        <h3>New custom profile</h3>
        <p>Create a safe draft for a future custom template like ChexSystems, a bank letter, or a custom creditor document.</p>
        <label className="workspace-form-field"><span>Profile name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="ChexSystems Dispute" /></label>
        <label className="workspace-form-field"><span>Output mode</span><select value={outputMode} onChange={(event) => setOutputMode(event.target.value as ProfileOutputMode)}><option value="STANDALONE_DOCX">Standalone DOCX</option><option value="PACKET_ATTACHMENT">Packet attachment</option></select></label>
        <label className="workspace-form-field"><span>Duplicate rule</span><select value={duplicateRule} onChange={(event) => setDuplicateRule(event.target.value as ProfileDuplicateRule)}><option value="preserve">Preserve duplicates</option><option value="account_name">Remove duplicate account names</option><option value="account_number">Remove duplicate account numbers</option></select></label>
        <label className="workspace-form-field"><span>Date format</span><input value={dateFormat} onChange={(event) => setDateFormat(event.target.value)} placeholder="M/D/YYYY" /></label>
        <label className="workspace-form-field"><span>Required source fields</span><textarea rows={4} value={sourceFields} onChange={(event) => setSourceFields(event.target.value)} /></label>
        <button type="button" className="primary-action-button" onClick={createDraft}>Create profile draft</button>
      </article>
    </div>

    <section className="admin-monitor-card native-operation-card manager-template-profile-drafts" aria-label="Custom Template Profile drafts">
      <header className="manager-console-card-header"><div><p>Profile drafts</p><h2>Register → Map → Test → Publish</h2></div><strong>{drafts.length}</strong></header>
      {drafts.length ? <div className="manager-console-stack account-record-compact-stack">
        {drafts.map((draft) => <article key={draft.id} className="manager-console-user-card">
          <header className="manager-console-user-header-v2"><div><strong>{draft.name}</strong><span>{outputModeLabel(draft.outputMode)} • {duplicateRuleLabel(draft.duplicateRule)} • {draft.dateFormat}</span></div><span className={`admin-status-badge ${draft.status}`}>{draft.status === 'tested' ? 'Tested draft' : 'Draft'}</span></header>
          <div className="manager-console-user-metrics"><span>{draft.sourceFields.length} field(s)</span><span>{compactList(draft.sourceFields)}</span><span>Generation inactive until profile engine publish support is enabled</span></div>
          <div className="manager-console-actions-row manager-console-top-actions"><button type="button" className="admin-action-button" onClick={() => markTested(draft.id)}>Mark tested</button><button type="button" className="admin-action-button" disabled>Publish locked</button><button type="button" className="admin-action-button" onClick={() => removeDraft(draft.id)}>Remove</button></div>
        </article>)}
      </div> : <div className="admin-monitor-empty">No custom profile drafts yet. Existing packet generation remains unchanged.</div>}
    </section>
  </section>;
}
