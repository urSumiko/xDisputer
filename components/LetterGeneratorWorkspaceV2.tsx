'use client';

import { useEffect, useMemo, useState } from 'react';
import CasePipelineStatus from './CasePipelineStatus';
import ClientCenterWorkspace from './ClientCenterWorkspace';
import DashboardOperationsWorkspace from './DashboardOperationsWorkspace';
import GuidedSourceDataFlow from './GuidedSourceDataFlow';
import GenerationPreflightChecklist from './GenerationPreflightChecklist';
import OutputReviewWorkspace, { type ReviewOutput } from './OutputReviewWorkspace';
import TemplateProgressiveWorkspace from './TemplateProgressiveWorkspace';
import UserErrorFlyout from './UserErrorFlyout';
import WorkspaceSettingsPanel from './WorkspaceSettingsPanel';
import WorkspacePortabilityPanel from './WorkspacePortabilityPanel';
import AccountMenu from './console/AccountMenu';
import { clearOperationsRecords, exportOperationsRecords, loadClientCases, loadFilings, markFilingSent, upsertClientCase, type ClientCaseRecord, type ClientCaseStatus, type FilingRecord } from '../lib/client-operations-store';
import { highlightTextInDocx } from '../lib/docx-review-marker';
import { resolveAffidavitJurisdiction } from '../lib/affidavit-jurisdiction';
import { bureaus, createNormalizedSourceCopy, detectRoutes, parseSource, type LetterType } from '../lib/letter-engine';
import { loadPacketAssets, type PacketAssets } from '../lib/packet-assets';
import { defaultReferences, loadReferenceMeta, removeReferenceFile, saveReferenceFile, saveReferenceMeta, recoverReferenceMetaFromFiles, type LetterReference, type Round } from '../lib/reference-store';
import { unresolvedCustomTemplateFields } from '../lib/template-contracts';
import { exhibitTitles, loadTemplateExhibits, type ExhibitKind, type TemplateExhibits } from '../lib/template-exhibits';
import { defaultWorkspacePreferences, loadWorkspacePreferences, saveWorkspacePreferences, type WorkspacePreferences } from '../lib/workspace-preferences';
import { packetOrderLabels, isFtcEnabled } from '../lib/workflow-framework';
import { activeWorkflowDiagnostics, assessRouteCoverage, requiredGenerationFailureMessage } from '../lib/workflow-execution';
import { evaluateGenerationPreflight, preflightFailureMessage } from '../lib/preflight-validation';
import { buildCasePipeline, nextCaseAction } from '../lib/case-pipeline';
import { resolveUxVisibility } from '../lib/ux-visibility-contract';
import { buildGenerationManifest, generationManifestText, normalizeGeneratedOutputForManifest, type GenerationManifest } from '../lib/generation-manifest';
import type { ManagerTemplateScopeUi } from '../lib/manager-template-ui';
import { explainWebsiteError, type UserFacingError } from '../lib/user-facing-error';
import { executeTemplateGeneration } from '../lib/template-execution/template-execution-orchestrator';

void highlightTextInDocx;

type Panel = 'Dashboard' | 'Templates' | 'Source Data' | 'Outputs' | 'Client Center' | 'Settings';
type SourceDraftSnapshot = { text: string; normalized: boolean; label: string; capturedAt: string };
type StatusTone = 'info' | 'success' | 'error';

type RegistryTemplateAsset = { id: string; round_label: Round; template_kind: 'LETTER' | 'EXHIBIT'; letter_type: LetterType | null; exhibit_kind: ExhibitKind | null; original_filename: string; mime_type: string; file_size: number | null; contract_json: unknown; validation_json?: Record<string, unknown> | null; content_hash?: string | null; version_number?: number | null; created_at?: string | null; updated_at?: string | null };

const panels: Panel[] = ['Dashboard', 'Templates', 'Source Data', 'Outputs', 'Client Center', 'Settings'];
const labels: Record<LetterType, string> = { DISPUTE: 'Dispute Letter', LATE_PAYMENT: 'Late Payment Letter' };
const requirements: ExhibitKind[] = isFtcEnabled() ? ['FCRA', 'AFFIDAVIT', 'ATTACHMENT', 'FTC'] : ['FCRA', 'AFFIDAVIT', 'ATTACHMENT'];
const emptyEvidence = (): PacketAssets => ({ supporting: [], legalPdf: null });
const emptyTemplates = (): TemplateExhibits => ({ FCRA: null, AFFIDAVIT: null, ATTACHMENT: null, FTC: null });
const dateNow = () => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(new Date());
const clean = (value: string) => (value || 'CLIENT').replace(/[\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const order = (type: LetterType) => packetOrderLabels(type);
const ARCHIVE_TIMEOUT_MS = 120_000;

function download(name: string, blob: Blob) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
async function withTimeout<T>(phase: string, operation: () => Promise<T>, timeoutMs = 90_000): Promise<T> { let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([operation(), new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`${phase} timed out after ${Math.round(timeoutMs / 1000)} seconds.`)), timeoutMs); })]); } finally { if (timer) clearTimeout(timer); } }
function errorMessage(error: unknown) { return error instanceof Error && error.message ? error.message : 'An unknown error occurred.'; }
function managerLetterReference(slot: LetterReference, asset: RegistryTemplateAsset): LetterReference { return { ...slot, file: asset.original_filename, size: asset.file_size || undefined, contract: asset.contract_json as any, assetId: asset.id, source: 'MANAGER_TEMPLATE_ASSET', versionNumber: asset.version_number || null, contentHash: asset.content_hash || null, validationJson: asset.validation_json || null }; }
function managerExhibitAsset(kind: ExhibitKind, asset: RegistryTemplateAsset) { return { id: asset.id, kind, mode: kind === 'FCRA' || kind === 'ATTACHMENT' ? 'STATIC_PDF' as const : 'GENERATED_DOCX' as const, name: asset.original_filename, type: asset.mime_type, size: asset.file_size || 0, contract: asset.contract_json as any, assetId: asset.id, source: 'MANAGER_TEMPLATE_ASSET', versionNumber: asset.version_number || null, contentHash: asset.content_hash || null, validationJson: asset.validation_json || null }; }

export default function LetterGeneratorWorkspaceV2({ accountEmail, accountRole = 'client' }: { accountEmail?: string | null; accountRole?: 'admin' | 'client' }) {
  const [panel, setPanel] = useState<Panel>('Dashboard');
  const [round, setRound] = useState<Round>('1st Round');
  const [preferences, setPreferences] = useState<WorkspacePreferences>(defaultWorkspacePreferences);
  const [references, setReferences] = useState<LetterReference[]>(() => loadReferenceMeta());
  const [source, setSource] = useState('');
  const [originalSource, setOriginalSource] = useState('');
  const [recoveryDraft, setRecoveryDraft] = useState<SourceDraftSnapshot | null>(null);
  const [normalized, setNormalized] = useState(false);
  const [caseId, setCaseId] = useState('');
  const [cases, setCases] = useState<ClientCaseRecord[]>([]);
  const [filings, setFilings] = useState<FilingRecord[]>([]);
  const [evidence, setEvidence] = useState<PacketAssets>(emptyEvidence);
  const [templates, setTemplates] = useState<TemplateExhibits>(emptyTemplates);
  const [registryAssets, setRegistryAssets] = useState<RegistryTemplateAsset[]>([]);
  const [managerTemplateScope, setManagerTemplateScope] = useState<ManagerTemplateScopeUi | null>(null);
  const [docs, setDocs] = useState<ReviewOutput[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [orderedZip, setOrderedZip] = useState<{ name: string; blob: Blob } | null>(null);
  const [docDate, setDocDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [generateAttempted, setGenerateAttempted] = useState(false);
  const [status, setStatus] = useState('Configure packet templates, then load a client source file.');
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
  const [activeError, setActiveError] = useState<UserFacingError | null>(null);

  useEffect(() => { const storedPreferences = loadWorkspacePreferences(); setPreferences(storedPreferences); setRound(storedPreferences.defaultRound); setCases(loadClientCases()); setFilings(loadFilings()); }, []);
  useEffect(() => saveReferenceMeta(references), [references]);
  useEffect(() => { let cancelled = false; void recoverReferenceMetaFromFiles().then((next) => { if (!cancelled) setReferences(next); }).catch(() => { if (!cancelled) setReferences(loadReferenceMeta()); }); return () => { cancelled = true }; }, []);
  useEffect(() => setTemplates(loadTemplateExhibits(round)), [round]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/template-assets?round=${encodeURIComponent(round)}&sync=${Date.now()}`, { cache: 'no-store', headers: { accept: 'application/json', 'cache-control': 'no-store' } })
      .then((response) => response.ok ? response.json() : { assets: [] })
      .then((payload) => { if (!cancelled) { setRegistryAssets(Array.isArray(payload.assets) ? payload.assets : []); setManagerTemplateScope(payload.managerTemplateScope || null); } })
      .catch(() => { if (!cancelled) { setRegistryAssets([]); setManagerTemplateScope(null); } });
    return () => { cancelled = true; };
  }, [round]);

  const refs = references.filter((item) => item.round === round);
  const effectiveRefs = useMemo(() => refs.map((slot) => {
    const registryAsset = registryAssets.find((asset) => asset.template_kind === 'LETTER' && asset.letter_type === slot.type);
    return registryAsset ? managerLetterReference(slot, registryAsset) : slot;
  }), [refs, registryAssets]);

  const effectiveTemplates = useMemo(() => {
    const next = { ...templates };
    (['FCRA', 'AFFIDAVIT', 'ATTACHMENT', 'FTC'] as ExhibitKind[]).forEach((kind) => {
      const registryAsset = registryAssets.find((asset) => asset.template_kind === 'EXHIBIT' && asset.exhibit_kind === kind);
      if (registryAsset) next[kind] = managerExhibitAsset(kind, registryAsset);
    });
    return next;
  }, [templates, registryAssets]);

  const parsed = useMemo(() => parseSource(source), [source]);
  const routes = useMemo(() => detectRoutes(parsed), [parsed]);
  const verified = normalized && Boolean(parsed.name);
  const evidenceKey = caseId ? `${round}::${caseId}` : '';
  const missingLetters = Array.from(new Set(routes.map((route) => route.type))).filter((type) => !effectiveRefs.find((item) => item.type === type)?.file);
  const dispute = routes.some((route) => route.type === 'DISPUTE');
  const disputed = bureaus.some((bureau) => parsed.dispute[bureau].length > 0);
  const affidavitRequired = dispute && disputed;
  const affidavitJurisdiction = useMemo(() => resolveAffidavitJurisdiction(parsed), [parsed]);
  const affidavitSource = useMemo(() => ({ ...parsed, address: parsed.address.length ? parsed.address : ['N/A'], affidavitState: affidavitJurisdiction.state, affidavitCounty: affidavitJurisdiction.county }), [parsed, affidavitJurisdiction]);
  const sourceWarnings = [...activeWorkflowDiagnostics(parsed.diagnostics.filter((item) => item.level === 'warning')), ...(affidavitRequired && affidavitJurisdiction.reviewRequired ? [{ message: affidavitJurisdiction.explanation }] : [])];
  const affidavitReady = !affidavitRequired || Boolean(affidavitSource.affidavitState.trim() && affidavitSource.affidavitCounty.trim());
  const activeTemplateContracts = [effectiveTemplates.FCRA, effectiveTemplates.AFFIDAVIT, effectiveTemplates.ATTACHMENT, effectiveTemplates.FTC].map((item) => item?.contract);
  const customFields = unresolvedCustomTemplateFields([...effectiveRefs.map((item) => item.contract), ...activeTemplateContracts]);
  const customReady = customFields.every((item) => !item.required || Boolean(parsed.templateFields[item.key]?.trim()));
  const missingNodes = dispute ? requirements.filter((kind) => !effectiveTemplates[kind]) : [];
  const canGenerate = verified && routes.length > 0;
  const preflight = useMemo(() => evaluateGenerationPreflight({ round, source, normalized, parsed: affidavitRequired ? affidavitSource : parsed, routes, references: effectiveRefs, templates: effectiveTemplates, evidence, affidavitReady, customReady, strictValidation: preferences.strictValidation, preferences }), [round, source, normalized, parsed, affidavitRequired, affidavitSource, routes, effectiveRefs, effectiveTemplates, evidence, affidavitReady, customReady, preferences]);
  const pipelineStages = useMemo(() => buildCasePipeline({ round, hasCase: Boolean(caseId || parsed.name), clientName: parsed.name, routes, references: effectiveRefs, templates: effectiveTemplates, evidence, preflight, outputCount: docs.length, orderedZipReady: Boolean(orderedZip), reviewedCount: docs.length ? docs.length : 0, downloaded: false, filedCount: filings.length }), [round, caseId, parsed.name, routes, effectiveRefs, effectiveTemplates, evidence, preflight, docs.length, orderedZip, filings.length]);
  const pipelineNextAction = useMemo(() => nextCaseAction(pipelineStages), [pipelineStages]);
  const uxRules = useMemo(() => resolveUxVisibility({ panel, statusTone, hasSource: Boolean(source.trim()), hasPreflightBlockers: preflight.blockers.length > 0, hasPreflightWarnings: preflight.warnings.length > 0, generateAttempted, busy, hasGeneratedOutput: docs.length > 0 }), [panel, statusTone, source, preflight.blockers.length, preflight.warnings.length, generateAttempted, busy, docs.length]);

  useEffect(() => setEvidence(evidenceKey ? loadPacketAssets(evidenceKey) : emptyEvidence()), [evidenceKey]);

  function report(message: string, tone: StatusTone = 'info') { setStatus(message); setStatusTone(tone); if (tone === 'error') setActiveError(explainWebsiteError(message, { operation: 'Workspace action', round, panel })); else if (tone === 'success') setActiveError(null); }
  function clearOutputs() { setDocs([]); setWarnings([]); setOrderedZip(null); setDocDate(''); setGenerateAttempted(false); }
  async function persistGenerationRun(manifest: GenerationManifest) { try { const response = await fetch('/api/generation-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientName: manifest.clientName, round: manifest.round, manifest, status: 'generated', perOutputPay: preferences.perOutputGenerationDefault }) }); const payload = await response.json().catch(() => null); if (payload?.entitlement) window.dispatchEvent(new CustomEvent('xdisputer:output-entitlement-updated', { detail: payload.entitlement })); if (!response.ok) console.warn('Generation run was not saved.', payload || await response.text()); } catch (error) { console.warn('Generation run persistence failed.', error); } }
  function captureDraft(label: string) { if (source.trim()) setRecoveryDraft({ text: source, normalized, label, capturedAt: new Date().toISOString() }); }
  function saveCase(statusValue: ClientCaseStatus, data: Partial<ClientCaseRecord> = {}) { const id = data.id || caseId; const name = data.clientName || parsed.name; if (!id || !name) return null; const previous = cases.find((item) => item.id === id); const record: ClientCaseRecord = { id, clientName: name, round, routeCount: routes.length, bureaus: Array.from(new Set(routes.map((route) => route.bureau))), evidenceCount: evidence.supporting.length, editableCount: docs.length, pdfCount: 0, status: statusValue, updatedAt: new Date().toISOString(), ...previous, ...data }; const next = upsertClientCase(record); setCases(next); return record; }
  function begin() { const id = crypto.randomUUID(); setCaseId(id); setSource(''); setOriginalSource(''); setNormalized(false); clearOutputs(); setPanel('Templates'); report('New case started. Choose or verify templates first.', 'success'); }
  async function uploadRef(slot: LetterReference, file: File) { const contract = await saveReferenceFile(slot, file); const next = loadReferenceMeta().map((item) => item.id === slot.id ? { ...item, file: file.name, size: file.size, contract, source: 'LOCAL_BROWSER' } : item); setReferences(next); clearOutputs(); report(labels[slot.type] + ' uploaded for ' + round + '.', 'success'); }
  async function removeRef(slot: LetterReference) { await removeReferenceFile(slot.id); const next = loadReferenceMeta().map((item) => item.id === slot.id ? { ...item, file: '', size: undefined, contract: undefined } : item); setReferences(next); clearOutputs(); report(labels[slot.type] + ' removed for ' + round + '.'); }
  function importSource(value: string, action: string) { captureDraft(action); setSource(value); setOriginalSource(value); setNormalized(false); clearOutputs(); setCaseId(crypto.randomUUID()); report(action + ' imported. Standardize it before generation.', 'success'); setPanel('Source Data'); }
  function standardizeDraft(value = source) { const next = createNormalizedSourceCopy(value); setSource(next.text); setNormalized(true); setRecoveryDraft(null); saveCase('SOURCE_LOCKED'); report('Source data standardized and locked for generation.', 'success'); }
  function startManualDraft(value: string) { setCaseId(crypto.randomUUID()); setSource(value); setOriginalSource(value); setNormalized(false); clearOutputs(); report('Manual draft started. Complete the source fields, then standardize.', 'success'); }
  function setLine(field: string, value: string) { const lines = source.split(/\r?\n/); const fixed: Record<string, string> = { name: 'Name', dob: 'DOB', ssn: 'SSN', address: 'Address', letterDate: 'Letter Date', affidavitState: 'Affidavit State', affidavitCounty: 'Affidavit County' }; const label = field.startsWith('TEMPLATE FIELD ') ? field : fixed[field] || field; const next = label + ': ' + value; const index = lines.findIndex((line) => line.toLowerCase().startsWith(label.toLowerCase() + ':')); if (index >= 0) lines[index] = next; else lines.unshift(next); setSource(lines.join('\n')); setNormalized(false); }
  function restoreOriginal() { setSource(originalSource || source); setNormalized(false); report('Original source copy restored. Standardize again before generation.'); }
  function recoverDraft() { if (!recoveryDraft) return; setSource(recoveryDraft.text); setNormalized(recoveryDraft.normalized); report(`${recoveryDraft.label} draft restored.`, 'success'); }

  async function makeZip(files: ReviewOutput[], notes: string[], date: string) { const [{ default: JSZip }, { addOrderedPacketFolders }] = await Promise.all([import('jszip'), import('../lib/ordered-packet-archive')]); const zip = new JSZip(); const manifestJson = generationManifestText(buildGenerationManifest({ round, parsed, routes, references: effectiveRefs, templates: effectiveTemplates, outputs: files.map((item, index) => normalizeGeneratedOutputForManifest({ id: item.id, path: item.path, type: item.type, role: item.role, bureau: item.bureau, sequence: item.sequence, count: item.count }, index)), warnings: notes })); await addOrderedPacketFolders(zip, files, round, evidenceKey, parsed.name || 'Client', routes.map((route) => ({ type: route.type, bureau: route.bureau }))); zip.file('generation-manifest.json', manifestJson); return await zip.generateAsync({ type: 'blob' }); }

  async function generate() { setGenerateAttempted(true); setActiveError(null); if (!preflight.ready) { report(preflightFailureMessage(preflight), 'error'); return; } setBusy(true); setWarnings([]); setOrderedZip(null); setDocDate(dateNow()); try { const date = dateNow(); const orchestrated = await executeTemplateGeneration({ round, source, normalized, parsed: affidavitRequired ? affidavitSource : parsed, routes, references: effectiveRefs, templates: effectiveTemplates, registryAssets, managerTemplateScope, documentDate: date, cleanName: clean, packetStepsForType: order, requestedRendererMode: process.env.NEXT_PUBLIC_DYNAMIC_TEMPLATE_RENDERER_MODE || null, onStatus: (message) => report(message) }); const letterCoverage = assessRouteCoverage(routes, orchestrated.outputs); if (!letterCoverage.complete) { setWarnings(orchestrated.warnings); report(requiredGenerationFailureMessage(letterCoverage, 'TemplateExecutionOrchestrator did not produce every required letter output.'), 'error'); return; } report('Preparing complete ordered component package…'); const zip = await withTimeout('Preparing ordered package ZIP', () => makeZip(orchestrated.outputs, orchestrated.warnings, date), ARCHIVE_TIMEOUT_MS); const persistedManifest = buildGenerationManifest({ round, parsed, routes, references: effectiveRefs, templates: effectiveTemplates, outputs: orchestrated.outputs.map((item, index) => normalizeGeneratedOutputForManifest({ id: item.id, path: item.path, type: item.type, role: item.role, bureau: item.bureau, sequence: item.sequence, count: item.count }, index)), warnings: orchestrated.warnings }); void persistGenerationRun({ ...persistedManifest, proof: { ...(persistedManifest as any).proof, templateExecution: orchestrated.executionManifest } } as GenerationManifest); const zipName = `${clean(parsed.name)}.zip`; setDocs(orchestrated.outputs); setWarnings(orchestrated.warnings); setOrderedZip({ name: zipName, blob: zip }); setDocDate(date); saveCase('REVIEW_READY', { editableCount: orchestrated.outputs.length, evidenceCount: evidence.supporting.length, pdfCount: 0 }); report('Complete ordered packet package is ready for review and download.', 'success'); setPanel('Outputs'); } catch (error) { const message = `Ordered package generation failed: ${errorMessage(error)}`; setWarnings([message]); setOrderedZip(null); report(message, 'error'); } finally { setBusy(false); } }

  async function saveEdited(output: ReviewOutput, file: File) { const next = docs.map((item) => item.path === output.path ? { ...item, blob: file } : item); try { const zip = await withTimeout('Rebuilding ordered component package', () => makeZip(next, warnings, docDate || dateNow()), ARCHIVE_TIMEOUT_MS); setDocs(next); setOrderedZip({ name: orderedZip?.name || 'ORDERED_PACKET_PACKAGE.zip', blob: zip }); report('Document edit saved and ordered package rebuilt.', 'success'); } catch (error) { report(`Package rebuild failed: ${errorMessage(error)}`, 'error'); } }
  async function updateOutputEvidence(value: PacketAssets) { setEvidence(value); if (!docs.length) return; try { const zip = await withTimeout('Rebuilding package with updated supporting documents', () => makeZip(docs, warnings, docDate || dateNow()), ARCHIVE_TIMEOUT_MS); setOrderedZip({ name: orderedZip?.name || 'ORDERED_PACKET_PACKAGE.zip', blob: zip }); report('Supporting Documents updated and ordered package rebuilt.', 'success'); } catch (error) { setOrderedZip(null); report(`Package rebuild failed: ${errorMessage(error)}`, 'error'); } }
  function applyWorkspaceImport(value: { round: Round; caseId: string; source: string; originalSource: string; normalized: boolean; references: LetterReference[]; templates: TemplateExhibits; evidence: PacketAssets; notices: string[] }) { const imported = parseSource(value.source); const detected = detectRoutes(imported); setRound(value.round); setCaseId(value.caseId || crypto.randomUUID()); setSource(value.source); setOriginalSource(value.originalSource); setNormalized(value.normalized); setReferences(value.references); setTemplates(value.templates); setEvidence(value.evidence); clearOutputs(); if (imported.name) { setCases(upsertClientCase({ id: value.caseId || crypto.randomUUID(), clientName: imported.name, round: value.round, routeCount: detected.length, bureaus: Array.from(new Set(detected.map((route) => route.bureau))), evidenceCount: value.evidence.supporting.length, editableCount: 0, pdfCount: 0, status: value.evidence.supporting.length ? 'EVIDENCE_READY' : 'SOURCE_LOCKED', updatedAt: new Date().toISOString() })); } setPanel('Source Data'); }
  function dashboard() { return <DashboardOperationsWorkspace cases={cases} filings={filings} activeCaseId={caseId} onNewCase={begin} onOpenTemplates={() => setPanel('Templates')} onOpenOutputs={() => setPanel(orderedZip ? 'Outputs' : 'Dashboard')} onOpenTracker={() => setPanel('Client Center')} onContinueCase={(item) => setPanel(item.id === caseId && item.status !== 'PDF_READY' ? (item.status === 'REVIEW_READY' ? 'Outputs' : 'Source Data') : 'Client Center')} />; }
  function sourceView() { return <><section className="client-per-output-intent-card" data-output-activity-client-intent="true"><div><strong>Per-output salary confirmation</strong><p>{preferences.perOutputGenerationDefault ? 'This generated packet will ask your manager to confirm it before it adds to salary.' : 'This generated packet will be logged as generated-only. Your manager can see it, but no confirmation is needed.'}</p></div><label><input type="checkbox" checked={preferences.perOutputGenerationDefault} onChange={(event) => setPreferences(saveWorkspacePreferences({ ...preferences, perOutputGenerationDefault: event.target.checked }))} /><span>Per-output</span></label></section>{uxRules.showPreflightPanel && <GenerationPreflightChecklist result={preflight} />}<GuidedSourceDataFlow source={source} originalSource={originalSource} recoveryDraft={recoveryDraft} normalized={normalized} verified={verified} parsed={affidavitRequired ? affidavitSource : parsed} routes={routes} sourceWarnings={sourceWarnings} evidenceKey={evidenceKey} evidence={evidence} canGenerate={preflight.ready && canGenerate} generationBlockers={preflight.blockers.map((item) => item.detail)} missingLetters={missingLetters.map((item) => labels[item])} missingInsertCount={missingNodes.length} affidavitRequired={affidavitRequired} ftcRequired={Boolean(parsed.ftcAccounts.length)} customFields={customFields} strict={preferences.strictValidation} busy={busy} onImportSource={importSource} onStandardizeDraft={standardizeDraft} onStartManualDraft={startManualDraft} onEditSource={(value) => { setSource(value); setNormalized(false); clearOutputs(); }} onSourceFieldChange={setLine} onFtcAccountChange={() => {}} onFtcAccountAdd={() => {}} onFtcAccountRemove={() => {}} onFtcAccountSeed={() => {}} onRestoreOriginal={restoreOriginal} onRecoverDraft={recoverDraft} onEvidenceChanged={(value) => { setEvidence(value); clearOutputs(); saveCase(value.supporting.length ? 'EVIDENCE_READY' : 'SOURCE_LOCKED', { evidenceCount: value.supporting.length, editableCount: 0 }); }} onMessage={(message) => report(message)} onGenerate={generate} /></>; }
  function settingsView() { return <><WorkspaceSettingsPanel preferences={preferences} caseCount={cases.length} filingCount={filings.length} accountEmail={accountEmail} accountRole={accountRole} onChange={(value) => setPreferences(saveWorkspacePreferences(value))} onExportRecords={() => download('XDISPUTER_LOCAL_WORKSPACE_RECORDS.json', new Blob([JSON.stringify(exportOperationsRecords(), null, 2)], { type: 'application/json' }))} onClearRecords={() => { const value = clearOperationsRecords(); setCases(value.cases); setFilings(value.filings); }} /><WorkspacePortabilityPanel round={round} caseId={caseId} clientName={parsed.name} source={source} originalSource={originalSource} normalized={normalized} preferences={preferences} disabled={busy} onImported={applyWorkspaceImport} onMessage={(message, tone) => report(message, tone)} /></>; }
  return <><main className="app-shell" data-client-console-shell="true"><aside className="sidebar"><div className="brand"><span /><div><strong>xDisputer</strong><small>Client workspace</small></div></div><nav>{panels.map((item) => <button key={item} className={panel === item ? 'active' : ''} disabled={item === 'Outputs' && !orderedZip} onClick={() => setPanel(item)}><strong>{item}</strong></button>)}</nav></aside><section className="main-area admin-monitor-main client-console-main" data-console-main="true" data-console-header-grid="true" data-console-role="client" data-console-mode="workspace"><AccountMenu role="client" mode="workspace" email={accountEmail} accountLabel="Client account" switchTarget="/workspace" switchTargetLabel="Client workspace" /><header className="header native-command-hero" data-console-header-primary="true"><div><p className="eyebrow">{panel === 'Dashboard' ? 'Client operations' : panel === 'Client Center' ? 'Client workspace' : `${round} workflow`}</p><h1>{panel}</h1>{uxRules.showStatusText && <p className={`workspace-operation-status ${statusTone}`} role={statusTone === 'error' ? 'alert' : 'status'} aria-live="polite">{status}</p>}</div><div className="workspace-header-actions">{uxRules.showHeaderNextAction && <CasePipelineStatus stages={pipelineStages} nextAction={pipelineNextAction} status={status} statusTone={statusTone} />}</div></header>{panel === 'Dashboard' && dashboard()}{panel === 'Templates' && <TemplateProgressiveWorkspace round={round} slots={effectiveRefs} supportingReady={evidence.supporting.length > 0} managerTemplateScope={managerTemplateScope} managedExhibits={effectiveTemplates} onSelectRound={(value) => { setRound(value); clearOutputs(); report(`${value} selected. Templates and generation will use this round.`, 'success'); }} onUploadLetter={uploadRef} onRemoveLetter={removeRef} onExhibitsChange={(value) => { setTemplates(value); clearOutputs(); }} onMessage={(message) => report(message)} onUseRoundForSourceData={() => { clearOutputs(); report(`${round} is active. Source Data generation will use this round's templates.`, 'success'); setPanel('Source Data'); }} />}{panel === 'Source Data' && sourceView()}{panel === 'Outputs' && <OutputReviewWorkspace round={round} outputs={docs} expectedRoutes={routes} zipName={orderedZip?.name} warnings={uxRules.showOutputWarnings ? warnings : []} evidenceKey={evidenceKey} evidence={evidence} onEvidenceChanged={(value) => void updateOutputEvidence(value)} onMessage={(message) => report(message)} onZip={() => orderedZip && download(orderedZip.name, orderedZip.blob)} onReplace={saveEdited} />}{panel === 'Client Center' && <ClientCenterWorkspace cases={cases} filings={filings} activeCaseId={caseId} outputsAvailable={Boolean(orderedZip)} onOpenTemplates={() => setPanel('Templates')} onOpenSource={() => setPanel('Source Data')} onOpenOutputs={() => setPanel('Outputs')} onStartCase={begin} onMarkSent={(id) => setFilings(markFilingSent(id))} />}{panel === 'Settings' && settingsView()}</section></main><UserErrorFlyout issue={activeError} onClose={() => setActiveError(null)} onNavigate={(target) => { setPanel(target); setActiveError(null); }} /></>;
}
