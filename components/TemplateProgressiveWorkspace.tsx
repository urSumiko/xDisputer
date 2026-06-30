'use client';

import { useMemo, useState } from 'react';
import TemplatePacketConfigurator from './TemplatePacketConfigurator';
import TemplateIntelligencePanel from './z_test_file';
import { rounds, type LetterReference, type Round } from '../lib/reference-store';
import type { TemplateExhibits } from '../lib/template-exhibits';
import { bureaus, type LetterType, type ParsedSource } from '../lib/letter-engine';
import type { ManagerTemplateScopeUi } from '../lib/manager-template-ui';
import { resolveTemplateAuthority } from '../lib/manager-template-authority';
import { packetOrderText, packetPositionCount } from '../lib/workflow-framework';
import type { CanonicalTemplateField, TemplateContract } from '../lib/template-contracts';

type Stage = 'ROUND' | 'PACKET' | 'EDITOR';
type WireState = 'ready' | 'system' | 'missing' | 'unknown';

type Props = {
  round: Round;
  slots: LetterReference[];
  supportingReady: boolean;
  managerTemplateScope?: ManagerTemplateScopeUi | null;
  managedExhibits?: TemplateExhibits;
  parsedSource?: ParsedSource | null;
  onSelectRound: (round: Round) => void;
  onUploadLetter: (slot: LetterReference, file: File) => Promise<void>;
  onRemoveLetter: (slot: LetterReference) => Promise<void>;
  onExhibitsChange: (next: TemplateExhibits) => void | Promise<void>;
  onTemplateMutation?: () => void | Promise<void>;
  onMessage: (message: string) => void;
  onUseRoundForSourceData?: () => void;
};

const fieldLabels: Record<CanonicalTemplateField, string> = {
  'client.name': 'Full name',
  'client.address': 'Address',
  'client.dob': 'DOB',
  'client.ssnMasked': 'SSN',
  'client.email': 'Email',
  'client.phone': 'Phone',
  'letter.date': 'Letter date',
  'bureau.name': 'Bureau name',
  'bureau.address': 'Bureau address',
  'accounts.lines': 'Accounts / creditors',
  'inquiries.lines': 'Hard inquiries',
  'affidavit.state': 'Affidavit state',
  'affidavit.county': 'Affidavit county',
  'ftc.reportNumber': 'Inactive',
  'ftc.reportDate': 'Inactive',
  'ftc.statement': 'Inactive'
};

function positionCount(packet: LetterType) {
  return `${packetPositionCount(packet)} positions`;
}

function packetTitle(packet: LetterType) {
  return packet === 'DISPUTE' ? 'Dispute Packet' : 'Late Payment Packet';
}

function packetType(packet: LetterType) {
  return packet === 'DISPUTE' ? 'Standard filing order' : 'Optional route';
}

function sourceHasAccounts(source?: ParsedSource | null) {
  if (!source) return false;
  return bureaus.some((bureau) => source.dispute[bureau].length > 0 || source.late[bureau].length > 0);
}

function sourceHasInquiries(source?: ParsedSource | null) {
  return Boolean(source && bureaus.some((bureau) => source.inquiry[bureau].length > 0));
}

function wireState(key: CanonicalTemplateField, source?: ParsedSource | null): WireState {
  if (key.startsWith('ftc.')) return 'system';
  if (key === 'letter.date' || key === 'bureau.name' || key === 'bureau.address') return 'system';
  if (!source) return 'unknown';

  if (key === 'client.name') return source.name ? 'ready' : 'missing';
  if (key === 'client.address') return source.address.length ? 'ready' : 'missing';
  if (key === 'client.dob') return source.dob ? 'ready' : 'missing';
  if (key === 'client.ssnMasked') return source.ssn ? 'ready' : 'missing';
  if (key === 'client.email') return source.email ? 'ready' : 'missing';
  if (key === 'client.phone') return source.phone ? 'ready' : 'missing';
  if (key === 'accounts.lines') return sourceHasAccounts(source) ? 'ready' : 'missing';
  if (key === 'inquiries.lines') return sourceHasInquiries(source) ? 'ready' : 'missing';
  if (key === 'affidavit.state') return source.affidavitState ? 'ready' : 'missing';
  if (key === 'affidavit.county') return source.affidavitCounty ? 'ready' : 'missing';
  return 'unknown';
}

function stateLabel(state: WireState) {
  if (state === 'ready') return 'wired';
  if (state === 'system') return 'auto';
  if (state === 'missing') return 'needs source';
  return 'load source';
}

function contractFields(contract?: TemplateContract | null) {
  if (!contract) return [] as CanonicalTemplateField[];
  const fields = [
    ...contract.requiredCanonicalFields,
    ...contract.optionalCanonicalFields,
    ...contract.fields.map((field) => field.canonicalKey).filter(Boolean) as CanonicalTemplateField[]
  ].filter((field) => !field.startsWith('ftc.'));
  return Array.from(new Set(fields));
}

function TemplateSourceWiringPanel({ slots, managedExhibits, parsedSource }: { slots: LetterReference[]; managedExhibits?: TemplateExhibits; parsedSource?: ParsedSource | null }) {
  const rows = [
    { name: 'Dispute Letter', contract: slots.find((slot) => slot.type === 'DISPUTE')?.contract as TemplateContract | undefined },
    { name: 'Late Payment Letter', contract: slots.find((slot) => slot.type === 'LATE_PAYMENT')?.contract as TemplateContract | undefined },
    { name: 'Affidavit', contract: managedExhibits?.AFFIDAVIT?.contract as TemplateContract | undefined },
    { name: 'FCRA Legal Exhibit', contract: managedExhibits?.FCRA?.contract as TemplateContract | undefined },
    { name: 'Attachment', contract: managedExhibits?.ATTACHMENT?.contract as TemplateContract | undefined }
  ];

  const readyCount = rows.flatMap((row) => contractFields(row.contract)).filter((field) => wireState(field, parsedSource) === 'ready' || wireState(field, parsedSource) === 'system').length;
  const totalCount = rows.flatMap((row) => contractFields(row.contract)).length;

  return (
    <aside className="panel template-source-wire-panel" aria-label="Template source wiring map">
      <div className="template-stage-heading">
        <p className="eyebrow">Template Wire Map</p>
        <h2>Source ↔ Template</h2>
        <p>One minimal wiring view: template placeholders are matched to Source Data fields before generation.</p>
      </div>
      <div className="template-wire-score"><strong>{totalCount ? `${readyCount}/${totalCount}` : 'No mapped fields yet'}</strong><span>{parsedSource?.name ? parsedSource.name : 'Load Source Data to preview real values'}</span></div>
      <div className="template-wire-list">
        {rows.map((row) => {
          const fields = contractFields(row.contract);
          return (
            <section key={row.name} className="template-wire-card">
              <header><strong>{row.name}</strong><small>{row.contract ? row.contract.mode : 'No active contract'}</small></header>
              {fields.length ? (
                <div className="template-wire-fields">
                  {fields.map((field) => {
                    const state = wireState(field, parsedSource);
                    return <span key={`${row.name}-${field}`} className={`template-wire-pill ${state}`}>{fieldLabels[field]} · {stateLabel(state)}</span>;
                  })}
                </div>
              ) : <p>No dynamic fields detected. Static PDF or template not uploaded.</p>}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

export default function TemplateProgressiveWorkspace({
  round,
  slots,
  supportingReady,
  managerTemplateScope = null,
  managedExhibits,
  parsedSource = null,
  onSelectRound,
  onUploadLetter,
  onRemoveLetter,
  onExhibitsChange,
  onTemplateMutation,
  onMessage,
  onUseRoundForSourceData
}: Props) {
  const [stage, setStage] = useState<Stage>('ROUND');
  const [packet, setPacket] = useState<LetterType | null>(null);
  const authority = useMemo(() => resolveTemplateAuthority(managerTemplateScope), [managerTemplateScope]);

  function chooseRound(next: Round) {
    onSelectRound(next);
    setPacket(null);
    setStage('PACKET');
  }

  function choosePacket(next: LetterType) {
    setPacket(next);
    setStage('EDITOR');
  }

  function chooseDifferentRound() {
    setPacket(null);
    setStage('ROUND');
  }

  function useSelectedTemplateForSourceData() {
    if (!onUseRoundForSourceData) return;
    onUseRoundForSourceData();
  }

  return (
    <div className={`templates-progressive-workspace authority-${authority.mode.toLowerCase()}`} data-template-authority-mode={authority.mode} data-client-template-handoff="enabled">
      <TemplateSourceWiringPanel slots={slots} managedExhibits={managedExhibits} parsedSource={parsedSource} />

      {stage === 'ROUND' ? (
        <section className="panel template-selection-stage template-round-stage" aria-label="Select packet round">
          <header className="template-stage-heading">
            <p className="eyebrow">Manager-approved reusable templates</p>
            <h2>Select a round</h2>
            <p>Choose the filing round. Every assigned client uses the active manager default template for that round and slot.</p>
          </header>
          <div className="template-round-selection-grid">
            {rounds.map((item, index) => (
              <button type="button" key={item} className={`template-round-choice ${item === round ? 'current' : ''}`} onClick={() => chooseRound(item)}>
                <span className="template-choice-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="template-choice-copy"><strong>{item}</strong><small>{item === round ? 'Current round' : 'Select round'}</small></span>
                <span className="template-choice-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {stage === 'PACKET' ? (
        <section className="panel template-selection-stage template-packet-stage" aria-label="Select packet template">
          <header className="template-stage-command">
            <div className="template-stage-heading">
              <p className="eyebrow">{round}</p>
              <h2>Choose a packet template</h2>
              <p>{authority.canUpload ? 'Upload or replace manager defaults from the editor.' : 'Review the manager defaults. Upload controls are locked until manager template authority is verified.'}</p>
            </div>
            <div className="template-selected-actions">
              <button type="button" className="secondary-button" onClick={chooseDifferentRound}>Change round</button>
              {onUseRoundForSourceData ? (
                <button type="button" className="primary-action-button client-template-source-handoff" data-client-template-source-handoff="round" onClick={useSelectedTemplateForSourceData}>
                  Use this round for Source Data
                </button>
              ) : null}
            </div>
          </header>
          <TemplateIntelligencePanel />
          <div className="template-packet-selection-grid">
            <button type="button" className="template-packet-choice primary" onClick={() => choosePacket('DISPUTE')}>
              <span className="template-selection-tag">Standard packet</span>
              <h3>Dispute Packet</h3>
              <p>{packetOrderText('DISPUTE')}</p>
              <div className="template-choice-footer"><strong>{positionCount('DISPUTE')}</strong><span>Configure →</span></div>
            </button>
            <button type="button" className="template-packet-choice" onClick={() => choosePacket('LATE_PAYMENT')}>
              <span className="template-selection-tag optional">Optional route</span>
              <h3>Late Payment Packet</h3>
              <p>{packetOrderText('LATE_PAYMENT')}</p>
              <div className="template-choice-footer"><strong>{positionCount('LATE_PAYMENT')}</strong><span>Configure →</span></div>
            </button>
          </div>
        </section>
      ) : null}

      {stage === 'EDITOR' && packet ? (
        <section className="template-selected-editor" aria-label={`${packetTitle(packet)} configuration`} data-client-template-selected-packet={packet}>
          <header className="panel template-selected-command template-merged-command">
            <div className="template-selected-identity">
              <p className="eyebrow">{round} · {packetType(packet)}</p>
              <h2>{packetTitle(packet)}</h2>
              <p className="template-selected-order">{packetOrderText(packet)}</p>
              <div className="template-selected-badges"><span>{positionCount(packet)}</span><span>{authority.statusBadge}</span>{packet === 'DISPUTE' ? <span>Order locked</span> : null}</div>
            </div>
            <div className="template-selected-actions">
              <button type="button" className="secondary-button" onClick={() => setStage('PACKET')}>Change packet</button>
              <button type="button" className="secondary-button" onClick={chooseDifferentRound}>Change round</button>
              {onUseRoundForSourceData ? (
                <button type="button" className="primary-action-button client-template-source-handoff" data-client-template-source-handoff="selected-template" onClick={useSelectedTemplateForSourceData}>
                  Use selected template for Source Data
                </button>
              ) : null}
            </div>
          </header>
          <TemplateIntelligencePanel />
          <TemplatePacketConfigurator round={round} slots={slots} supportingReady={supportingReady} focusedPacket={packet} embedded canManageTemplates={authority.canUpload} managerTemplateScope={managerTemplateScope} managedExhibits={managedExhibits} onUploadLetter={onUploadLetter} onRemoveLetter={onRemoveLetter} onExhibitsChange={onExhibitsChange} onTemplateMutation={onTemplateMutation} onMessage={onMessage} />
        </section>
      ) : null}
    </div>
  );
}
