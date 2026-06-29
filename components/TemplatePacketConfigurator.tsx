'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { exhibitAccept, exhibitModes, exhibitTitles, recoverTemplateExhibitsFromFiles, removeTemplateExhibit, saveTemplateExhibit, type ExhibitAsset, type ExhibitKind, type TemplateExhibits } from '../lib/template-exhibits';
import { exhibitKindsForPacket, packetOrderText } from '../lib/workflow-framework';
import type { LetterReference, Round } from '../lib/reference-store';
import type { LetterType } from '../lib/letter-engine';
import type { ManagerTemplateScopeUi } from '../lib/manager-template-ui';
import { resolveTemplateAuthority, summarizeTemplateProvenance, summarizeTemplateQuality } from '../lib/manager-template-authority';

type PacketFocus = LetterType;
type StatusTone = 'ready' | 'required' | 'neutral';
type TemplateActionKind = 'upload-letter' | 'remove-letter' | 'upload-exhibit' | 'remove-exhibit';

type Props = {
  round: Round;
  slots: LetterReference[];
  supportingReady: boolean;
  focusedPacket?: PacketFocus;
  embedded?: boolean;
  canManageTemplates?: boolean;
  managerTemplateScope?: ManagerTemplateScopeUi | null;
  managedExhibits?: TemplateExhibits;
  onUploadLetter: (slot: LetterReference, file: File) => Promise<void>;
  onRemoveLetter: (slot: LetterReference) => Promise<void>;
  onExhibitsChange: (value: TemplateExhibits) => void | Promise<void>;
  onTemplateMutation?: () => void | Promise<void>;
  onMessage: (message: string) => void;
};

const activeExhibits = exhibitKindsForPacket('DISPUTE');
const emptyExhibits = (): TemplateExhibits => ({ FCRA: null, AFFIDAVIT: null, ATTACHMENT: null, FTC: null });

function Badge({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) { return <span className={`packet-status ${tone}`}>{children}</span>; }
function Tag({ children }: { children: ReactNode }) { return <span className="template-info-tag">{children}</span>; }
function hasManagedExhibits(values?: TemplateExhibits) { return Boolean(values && Object.values(values).some(Boolean)); }
function managerTemplateLockMessage(scope: ManagerTemplateScopeUi | null | undefined) { const authority = resolveTemplateAuthority(scope); return authority.mode === 'CLIENT_READONLY' ? authority.description : 'Template controls are locked until manager template authority is verified.'; }
function mappingMeta(asset?: ExhibitAsset | null) { if (!asset?.contract) return asset && exhibitModes[asset.kind] === 'GENERATED_DOCX' ? 'Generated from Source Data for final PDF delivery' : 'Inserted unchanged into final PDF delivery'; if (asset.contract.mode === 'LEGACY_HIGHLIGHTED') return 'Source-mapped generated document · required for final PDF delivery'; if (asset.contract.mode === 'PLACEHOLDERS') { const extra = asset.contract.customFields.length ? ` · ${asset.contract.customFields.length} custom field${asset.contract.customFields.length === 1 ? '' : 's'}` : ''; return `Source-mapped document · ${asset.contract.tags.length} tag${asset.contract.tags.length === 1 ? '' : 's'}${extra}`; } return 'Inserted unchanged into final PDF delivery'; }
function letterMeta(slot?: LetterReference) { if (!slot?.file) return slot?.type === 'DISPUTE' ? 'Manager must upload the required dispute letter template.' : 'Manager uploads this when a late-payment route is needed.'; if (slot.assetId) return `${summarizeTemplateProvenance(slot)} · Consistent for assigned clients`; if (slot.contract?.mode === 'PLACEHOLDERS') return `${slot.file} · Placeholder mapping · Local manager preview`; return `${slot.file} · Reference layout mapping · Local manager preview`; }
function exhibitMeta(kind: ExhibitKind, asset?: ExhibitAsset | null) { if (!asset) return exhibitModes[kind] === 'GENERATED_DOCX' ? 'Manager must upload the required DOCX source-mapped document for final delivery.' : 'Manager must upload the required PDF insert for final delivery.'; return `${asset.assetId ? summarizeTemplateProvenance({ name: asset.name, assetId: asset.assetId, versionNumber: asset.versionNumber, contentHash: asset.contentHash, validationJson: asset.validationJson }) : `${asset.name} · Local manager preview`} · ${mappingMeta(asset)}`; }
function format(kind: ExhibitKind) { return exhibitModes[kind] === 'GENERATED_DOCX' ? 'Editable DOCX' : 'Static PDF'; }
function apiErrorMessage(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback; }
function actionKey(kind: TemplateActionKind, slot: string) { return `${kind}:${slot}`; }

export default function TemplatePacketConfigurator({ round, slots, supportingReady, focusedPacket = 'DISPUTE', embedded = false, canManageTemplates = false, managerTemplateScope = null, managedExhibits, onUploadLetter, onRemoveLetter, onExhibitsChange, onTemplateMutation, onMessage }: Props) {
  const [exhibits, setExhibits] = useState<TemplateExhibits>(emptyExhibits);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const dispute = slots.find((slot) => slot.type === 'DISPUTE');
  const late = slots.find((slot) => slot.type === 'LATE_PAYMENT');
  const readOnlyReason = managerTemplateLockMessage(managerTemplateScope);
  const authority = useMemo(() => resolveTemplateAuthority(managerTemplateScope), [managerTemplateScope]);
  const mayManageTemplates = canManageTemplates && authority.canUpload;
  const actionInFlight = Boolean(pendingActionKey);

  useEffect(() => {
    let cancelled = false;
    if (hasManagedExhibits(managedExhibits)) { setExhibits(managedExhibits!); return () => { cancelled = true; }; }
    if (!mayManageTemplates) { setExhibits(emptyExhibits()); return () => { cancelled = true; }; }
    void recoverTemplateExhibitsFromFiles(round).then((saved) => { if (!cancelled) { setExhibits(saved); void onExhibitsChange(saved); } }).catch(() => { if (!cancelled) onMessage('Template recovery could not be completed. Reopen Templates or upload the missing file again.'); });
    return () => { cancelled = true; };
  }, [round, mayManageTemplates, managedExhibits]);

  async function withTemplateAction(key: string, task: () => Promise<void>) { if (pendingActionKey) return; setPendingActionKey(key); try { await task(); } finally { setPendingActionKey(null); } }
  async function syncLetterToSupabase(slot: LetterReference, file: File) { const formData = new FormData(); formData.set('round', round); formData.set('templateKind', 'LETTER'); formData.set('letterType', slot.type); formData.set('file', file); const response = await fetch('/api/template-assets', { method: 'POST', headers: { accept: 'application/json', 'x-template-upload': 'workspace' }, body: formData }); const payload = await response.json().catch(() => null); if (!response.ok || payload?.status === 'error') throw new Error(payload?.message || `${slot.name} could not be saved to Supabase.`); return payload?.message || `${slot.name} saved to Supabase.`; }
  async function deleteLetterFromSupabase(slot: LetterReference) { const response = await fetch('/api/template-assets', { method: 'DELETE', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-template-upload': 'workspace' }, body: JSON.stringify({ round, templateKind: 'LETTER', letterType: slot.type }) }); const payload = await response.json().catch(() => null); if (!response.ok || payload?.status === 'error') throw new Error(payload?.message || `${slot.name} could not be removed from Supabase.`); return payload?.message || `${slot.name} removed from Supabase.`; }
  async function syncExhibitToSupabase(kind: ExhibitKind, file: File) { const formData = new FormData(); formData.set('round', round); formData.set('templateKind', 'EXHIBIT'); formData.set('exhibitKind', kind); formData.set('file', file); const response = await fetch('/api/template-assets', { method: 'POST', headers: { accept: 'application/json', 'x-template-upload': 'workspace' }, body: formData }); const payload = await response.json().catch(() => null); if (!response.ok || payload?.status === 'error') throw new Error(payload?.message || 'Template could not be saved to Supabase.'); return payload?.message || `${exhibitTitles[kind]} saved to Supabase.`; }
  async function deleteExhibitFromSupabase(kind: ExhibitKind) { const response = await fetch('/api/template-assets', { method: 'DELETE', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-template-upload': 'workspace' }, body: JSON.stringify({ round, templateKind: 'EXHIBIT', exhibitKind: kind }) }); const payload = await response.json().catch(() => null); if (!response.ok || payload?.status === 'error') throw new Error(payload?.message || 'Template could not be removed from Supabase.'); return payload?.message || `${exhibitTitles[kind]} removed from Supabase.`; }
  async function refreshActiveTemplateState() { await onTemplateMutation?.(); }
  async function saveLocalExhibitPreview(kind: ExhibitKind, file: File) { try { const next = await saveTemplateExhibit(round, kind, file); setExhibits(next); await onExhibitsChange(next); } catch { /* Supabase is authoritative; local browser preview is best-effort only. */ } }
  async function removeLocalExhibitPreview(kind: ExhibitKind) { try { const next = await removeTemplateExhibit(round, kind); setExhibits(next); await onExhibitsChange(next); } catch { /* Supabase is authoritative; local browser preview is best-effort only. */ } }
  async function uploadLetter(slot: LetterReference, file: File) { if (!mayManageTemplates) { onMessage(readOnlyReason); return; } await withTemplateAction(actionKey('upload-letter', slot.type), async () => { try { onMessage(`Uploading ${slot.name} to Supabase…`); const syncMessage = await syncLetterToSupabase(slot, file); await onUploadLetter(slot, file); await refreshActiveTemplateState(); onMessage(`${syncMessage} Verified as active Supabase manager default.`); } catch (error) { onMessage(apiErrorMessage(error, `${slot.name} could not be saved.`)); } }); }
  async function removeLetter(slot: LetterReference) { if (!mayManageTemplates) { onMessage(readOnlyReason); return; } await withTemplateAction(actionKey('remove-letter', slot.type), async () => { try { onMessage(`Removing ${slot.name} from Supabase…`); const syncMessage = await deleteLetterFromSupabase(slot); await onRemoveLetter(slot); await refreshActiveTemplateState(); onMessage(`${syncMessage} Slot is no longer active for assigned clients.`); } catch (error) { onMessage(apiErrorMessage(error, `${slot.name} could not be removed.`)); } }); }
  async function uploadExhibit(kind: ExhibitKind, file: File) { if (!mayManageTemplates) { onMessage(readOnlyReason); return; } await withTemplateAction(actionKey('upload-exhibit', kind), async () => { try { onMessage(`Uploading ${exhibitTitles[kind]} to Supabase…`); const syncMessage = await syncExhibitToSupabase(kind, file); await refreshActiveTemplateState(); await saveLocalExhibitPreview(kind, file); onMessage(`${syncMessage} Verified as active Supabase manager default.`); } catch (error) { onMessage(apiErrorMessage(error, 'File could not be saved.')); } }); }
  async function removeExhibit(kind: ExhibitKind) { if (!mayManageTemplates) { onMessage(readOnlyReason); return; } await withTemplateAction(actionKey('remove-exhibit', kind), async () => { try { onMessage(`Removing ${exhibitTitles[kind]} from Supabase…`); const syncMessage = await deleteExhibitFromSupabase(kind); await refreshActiveTemplateState(); await removeLocalExhibitPreview(kind); onMessage(`${syncMessage} Slot is no longer active for assigned clients.`); } catch (error) { onMessage(apiErrorMessage(error, 'File could not be removed.')); } }); }

  function LockedActions() { return <div className="contextual-actions studio-actions readonly-template-actions"><span className="packet-status neutral">Manager controlled</span></div>; }
  function PendingActions({ label }: { label: string }) { return <div className="contextual-actions studio-actions readonly-template-actions"><span className="packet-status neutral">{label}</span></div>; }
  function LetterActions({ slot }: { slot: LetterReference }) {
    if (!mayManageTemplates) return <LockedActions />;
    const uploadKey = actionKey('upload-letter', slot.type);
    const removeKey = actionKey('remove-letter', slot.type);
    if (pendingActionKey === uploadKey) return <PendingActions label="Uploading…" />;
    if (pendingActionKey === removeKey) return <PendingActions label="Removing…" />;
    return <div className="contextual-actions studio-actions manager-template-direct-actions"><label className="manager-upload-action"><span>{slot.file ? 'Replace DOCX' : 'Upload DOCX'}</span><input className="manager-upload-input" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={actionInFlight} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLetter(slot, file); event.target.value = ''; }} /></label>{slot.file && <button type="button" className="remove-node" disabled={actionInFlight} onClick={() => void removeLetter(slot)}>Remove</button>}</div>;
  }
  function ExhibitActions({ kind }: { kind: ExhibitKind }) {
    if (!mayManageTemplates) return <LockedActions />;
    const uploadKey = actionKey('upload-exhibit', kind);
    const removeKey = actionKey('remove-exhibit', kind);
    if (pendingActionKey === uploadKey) return <PendingActions label="Uploading…" />;
    if (pendingActionKey === removeKey) return <PendingActions label="Removing…" />;
    const fileFormat = exhibitModes[kind] === 'GENERATED_DOCX' ? 'DOCX' : 'PDF';
    return <div className="contextual-actions studio-actions manager-template-direct-actions"><label className="manager-upload-action"><span>{exhibits[kind] ? `Replace ${fileFormat}` : `Upload ${fileFormat}`}</span><input className="manager-upload-input" type="file" accept={exhibitAccept[kind]} disabled={actionInFlight} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadExhibit(kind, file); event.target.value = ''; }} /></label>{exhibits[kind] && <button type="button" className="remove-node" disabled={actionInFlight} onClick={() => void removeExhibit(kind)}>Remove</button>}</div>;
  }
  function Card({ number, title, meta, tone, status, fileFormat, quality, children, className = '' }: { number: string; title: string; meta: string; tone?: StatusTone; status: string; fileFormat: string; quality?: ReturnType<typeof summarizeTemplateQuality>; children?: ReactNode; className?: string }) { return <article className={`studio-component-card ${tone === 'ready' ? 'is-ready' : ''} ${className}`} data-template-quality={quality?.tone || tone || 'neutral'}><span className="studio-sequence">{number}</span><div className="studio-component-copy"><div className="studio-component-title"><h4>{title}</h4><span className="studio-format">{fileFormat}</span></div><p>{meta}</p>{quality && <p className={`template-quality-summary ${quality.tone}`}>{quality.label}: {quality.detail}</p>}</div><Badge tone={tone}>{status}</Badge>{children}</article>; }
  if (focusedPacket === 'DISPUTE' && !dispute) return <section className="panel template-config-empty">No Dispute Letter reference slot is available for {round}.</section>;
  if (focusedPacket === 'LATE_PAYMENT' && !late) return <section className="panel template-config-empty">No Late Payment Letter reference slot is available for {round}.</section>;

  return <section className={`template-studio template-studio-operational progressive-surface focused-template-configurator ${embedded ? 'embedded-template-configurator' : ''}`} data-template-authority-mode={authority.mode}>{focusedPacket === 'DISPUTE' && dispute && <div className="template-focused-workflow">{!embedded && <header className="template-section-heading template-operational-heading"><div className="template-title-block"><p className="eyebrow">Final PDF contract</p><h3>Dispute Packet</h3><span>{packetOrderText('DISPUTE')}</span></div><div className="template-info-tags"><Tag>Required positions</Tag><Tag>Order locked</Tag></div></header>}<div className="studio-component-grid primary-visible-grid"><Card number="01" title="Dispute Letter" meta={letterMeta(dispute)} quality={summarizeTemplateQuality(dispute)} tone={dispute.file ? 'ready' : 'required'} status={dispute.file ? 'Ready' : 'Required'} fileFormat="Editable DOCX"><LetterActions slot={dispute} /></Card><Card number="02" title="Supporting Documents" meta="Client evidence is uploaded in Source Data and merged into every final packet." tone={supportingReady ? 'ready' : 'required'} status={supportingReady ? 'Ready' : 'Required per client'} fileFormat="Evidence PDF" />{activeExhibits.map((kind, index) => <Card key={kind} number={String(index + 3).padStart(2, '0')} title={exhibitTitles[kind]} meta={exhibitMeta(kind, exhibits[kind])} quality={summarizeTemplateQuality(exhibits[kind] || {})} tone={exhibits[kind] ? 'ready' : 'required'} status={exhibits[kind] ? 'Ready' : 'Required for final PDF'} fileFormat={format(kind)}><ExhibitActions kind={kind} /></Card>)}</div></div>}{focusedPacket === 'LATE_PAYMENT' && late && <div className="template-focused-workflow late-payment-focused"><div className="studio-component-grid primary-visible-grid compact-template-grid"><Card number="01" title="Late Payment Letter" meta={letterMeta(late)} quality={summarizeTemplateQuality(late)} tone={late.file ? 'ready' : 'required'} status={late.file ? 'Ready' : 'Required when route exists'} fileFormat="Editable DOCX"><LetterActions slot={late} /></Card></div></div>}</section>;
}
