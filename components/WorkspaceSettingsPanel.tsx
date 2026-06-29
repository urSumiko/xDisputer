'use client';

import { useState } from 'react';
import { rounds, type Round } from '../lib/reference-store';
import type { GuidanceMode, WorkspacePreferences } from '../lib/workspace-preferences';

type SettingsStep = 'account' | 'workflow' | 'records';

type Props = {
  preferences: WorkspacePreferences;
  caseCount: number;
  filingCount: number;
  accountEmail?: string | null;
  accountRole?: 'admin' | 'client';
  onChange: (next: WorkspacePreferences) => void;
  onExportRecords: () => void;
  onClearRecords: () => void;
};

const steps: Array<{ id: SettingsStep; label: string; detail: string }> = [
  { id: 'account', label: 'Account', detail: 'Identity and access context' },
  { id: 'workflow', label: 'Workflow', detail: 'Round, pay intent, and validation' },
  { id: 'records', label: 'Records', detail: 'Local history controls' }
];

function Toggle({ checked, onChange, title, description }: { checked: boolean; onChange: (checked: boolean) => void; title: string; description: string }) {
  return <label className="settings-toggle">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="settings-switch" aria-hidden="true" />
    <span className="settings-toggle-copy"><strong>{title}</strong><small>{description}</small></span>
  </label>;
}

function SettingStepButton({ step, active, onClick }: { step: typeof steps[number]; active: boolean; onClick: () => void }) {
  return <button type="button" className={`settings-step-card ${active ? 'active' : ''}`} onClick={onClick}>
    <strong>{step.label}</strong>
    <small>{step.detail}</small>
  </button>;
}

function GuidanceChoice({ value, active, title, detail, onSelect }: { value: GuidanceMode; active: boolean; title: string; detail: string; onSelect: (value: GuidanceMode) => void }) {
  return <button type="button" className={`settings-choice-card ${active ? 'active' : ''}`} onClick={() => onSelect(value)}>
    <strong>{title}</strong>
    <small>{detail}</small>
  </button>;
}

export default function WorkspaceSettingsPanel({ preferences, caseCount, filingCount, accountEmail, accountRole = 'client', onChange, onExportRecords, onClearRecords }: Props) {
  const [activeStep, setActiveStep] = useState<SettingsStep>('workflow');
  const [confirmClear, setConfirmClear] = useState(false);
  function update(values: Partial<WorkspacePreferences>) { onChange({ ...preferences, ...values }); }

  return <section className="settings-workspace operations-workspace client-preferences-workspace progressive-settings-workspace">
    <section className="panel settings-group settings-progressive-shell">
      <header>
        <div>
          <p className="eyebrow">Account Settings</p>
          <h2>Choose what to adjust</h2>
          <p>Client-safe settings only. These controls do not change backend roles, managers, billing, or permissions.</p>
        </div>
      </header>
      <div className="settings-step-grid" role="tablist" aria-label="Settings sections">
        {steps.map((step) => <SettingStepButton key={step.id} step={step} active={activeStep === step.id} onClick={() => setActiveStep(step.id)} />)}
      </div>
    </section>

    {activeStep === 'account' && <section className="panel settings-group client-account-settings">
      <header>
        <div>
          <p className="eyebrow">Account</p>
          <h2>Client account context</h2>
          <p>Simple identity and workspace context for the signed-in client user.</p>
        </div>
      </header>
      <div className="client-account-summary-grid">
        <article><span>Email</span><strong>{accountEmail || 'Signed in account'}</strong></article>
        <article><span>Workspace access</span><strong>{accountRole === 'admin' ? 'Manager view' : 'Client view'}</strong></article>
        <article><span>Local records</span><strong>{caseCount} cases · {filingCount} handoff items</strong></article>
      </div>
    </section>}

    {activeStep === 'workflow' && <section className="panel settings-group client-workflow-settings">
      <header>
        <div>
          <p className="eyebrow">Workflow</p>
          <h2>Package preparation preferences</h2>
          <p>Pick the default round, pay intent, and how much guidance the client workspace should show.</p>
        </div>
      </header>

      <div className="settings-grid compact-settings-grid">
        <label className="settings-select client-round-setting">
          <span><strong>Default round for new client packets</strong><small>This only affects new cases. Existing cases keep their selected round.</small></span>
          <select value={preferences.defaultRound} onChange={(event) => update({ defaultRound: event.target.value as Round })}>
            {rounds.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <div className="settings-required-rule client-template-rule">
          <strong>Template layout authority</strong>
          <p>The latest uploaded template controls the document layout. The app fills client data into detected template sections.</p>
          <span>Automatic</span>
        </div>
      </div>

      <div className="settings-choice-grid" aria-label="Guidance mode">
        <GuidanceChoice value="guided" active={preferences.guidanceMode !== 'focused'} title="Guided mode" detail="Best for client users who need more context while preparing a packet." onSelect={(value) => update({ guidanceMode: value })} />
        <GuidanceChoice value="focused" active={preferences.guidanceMode === 'focused'} title="Focused mode" detail="Cleaner view for returning users who want fewer helper messages." onSelect={(value) => update({ guidanceMode: value })} />
      </div>

      <div className="settings-grid compact-settings-grid">
        <Toggle checked={preferences.perOutputGenerationDefault} onChange={(checked) => update({ perOutputGenerationDefault: checked })} title="Mark generated letters as per-output by default" description="When enabled, the next generated packet asks the manager to confirm the output before it can add to salary. Leave off for generated-only records." />
        <Toggle checked={preferences.strictValidation} onChange={(checked) => update({ strictValidation: checked })} title="Require complete checklist before generation" description="Blocks package generation until the client profile, templates, evidence, and required fields are ready." />
        <Toggle checked={preferences.openTrackerAfterFinalization} onChange={(checked) => update({ openTrackerAfterFinalization: checked })} title="Open Client Center after package completion" description="Move to the client handoff center after the final package is prepared." />
      </div>
    </section>}

    {activeStep === 'records' && <section className="panel settings-group client-records-settings">
      <header><div><p className="eyebrow">Records</p><h3>Workspace history</h3><p>Export or clear local case and handoff history. Uploaded templates stay untouched.</p></div></header>
      <div className="settings-summary slim-settings-summary">
        <span><strong>{caseCount}</strong><small>Cases</small></span>
        <span><strong>{filingCount}</strong><small>Handoff items</small></span>
      </div>
      <div className="settings-record-actions-row">
        <button type="button" className="settings-record-action" onClick={onExportRecords}>
          <div><strong>Export local records</strong><small>Download case and handoff metadata only.</small></div><span>Export</span>
        </button>
        {!confirmClear ? <button type="button" className="settings-record-action danger" onClick={() => setConfirmClear(true)}>
          <div><strong>Clear local history</strong><small>Remove local case and handoff records only.</small></div><span>Clear</span>
        </button> : <div className="settings-clear-confirm compact-clear-confirm">
          <strong>Clear local case and handoff records?</strong>
          <p>Templates, source data, evidence files, account role, and backend access are not removed.</p>
          <div><button type="button" className="secondary-button" onClick={() => setConfirmClear(false)}>Cancel</button><button type="button" className="danger-button" onClick={() => { onClearRecords(); setConfirmClear(false); }}>Clear Records</button></div>
        </div>}
      </div>
    </section>}
  </section>;
}
