# Auto Commit Recovery Report

- Created: 2026-06-20T07:42:11.994Z
- Base commit before auto-report: 056ed0f1f225703ed58da33c9fa2025dd7b71b76
- Intent: User reported output activity v2 TypeScript build error
- Summary: Allowed legacy payroll nav argument by normalizing managerOperationsNavItems input to canonical output_activity panel
- Problem / wrong behavior: Output Activity v2 page still passed payroll to managerOperationsNavItems after canonical panel type changed

## Changed files

```text
M	components/LetterGeneratorWorkspaceV2.tsx
M	components/OutputLimitResetChip.tsx
M	scripts/performance-boost-guard.mjs
M	src/features/performance/performance-contract.ts
```

## Diff stat

```text
components/LetterGeneratorWorkspaceV2.tsx        |  7 ++-----
 components/OutputLimitResetChip.tsx              | 26 +++++++++++++++++-------
 scripts/performance-boost-guard.mjs              |  6 ++++++
 src/features/performance/performance-contract.ts |  4 ++++
 4 files changed, 31 insertions(+), 12 deletions(-)
```

## Recovery

To inspect this change later:

```bash
git show --stat HEAD
git show --name-status HEAD
```

To revert this auto-commit after it is created:

```bash
git revert HEAD
```

## File-by-file old/latest preview

### omponents/ClientOutputLimitBoundary.tsx

- Status: M

#### Old version preview

```text
[new file or old version unavailable]
```

#### Latest version preview

```text
[deleted file or latest version unavailable]
```

### components/LetterGeneratorWorkspaceV2.tsx

- Status: M

#### Old version preview

```text
'use client';

import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import CasePipelineStatus from './CasePipelineStatus';
import ClientCenterWorkspace from './ClientCenterWorkspace';
import DashboardOperationsWorkspace from './DashboardOperationsWorkspace';
import OutputLimitResetChip from './OutputLimitResetChip';
import GuidedSourceDataFlow from './GuidedSourceDataFlow';
import GenerationPreflightChecklist from './GenerationPreflightChecklist';
import OutputReviewWorkspace, { type ReviewOutput } from './OutputReviewWorkspace';
import TemplateProgressiveWorkspace from './TemplateProgressiveWorkspace';
import UserErrorFlyout from './UserErrorFlyout';
import WorkspaceSettingsPanel from './WorkspaceSettingsPanel';
import WorkspacePortabilityPanel from './WorkspacePortabilityPanel';
import AccountMenu from './console/AccountMenu';
import { clearOperationsRecords, exportOperationsRecords, loadClientCases, loadFilings, markFilingSent, upsertClientCase, type ClientCaseRecord, type ClientCaseStatus, type FilingRecord } from '../lib/client-operations-store';
import { addOrderedPacketFolders } from '../lib/ordered-packet-archive';
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
  useEffect(() => { let cancelled = false; void recoverReferenceMetaFromFiles().then((next) => { if (!cancelled) setReferences(next); }).catch(() => { if (!cancelled) setReferences(loadReferenceMeta()); }); return () => { cancelled = true; }; }, []);
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
... clipped 62 line(s) ...
```

#### Latest version preview

```text
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
  useEffect(() => { let cancelled = false; void recoverReferenceMetaFromFiles().then((next) => { if (!cancelled) setReferences(next); }).catch(() => { if (!cancelled) setReferences(loadReferenceMeta()); }); return () => { cancelled = true; }; }, []);
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
... clipped 59 line(s) ...
```

### components/OutputLimitResetChip.tsx

- Status: M

#### Old version preview

```text
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type EntitlementPayload = {
  outputLimit: number | null;
  outputUsedToday: number;
  outputRemainingToday: number | null;
  resetAt: string | null;
  resetSeconds: number | null;
  allowed: boolean;
  message: string | null;
};

function formatDuration(seconds: number | null, refreshing = false) {
  if (refreshing) return 'Refreshing';
  if (seconds === null) return 'Calculating';
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secondsPart = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secondsPart}s`;
  if (minutes > 0) return `${minutes}m ${secondsPart}s`;
  return `${secondsPart}s`;
}

function formatResetAt(value: string | null) {
  if (!value) return '12:00 AM US ET';
  try {
    return `${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date(value))} US ET`;
  } catch {
    return '12:00 AM US ET';
  }
}

function isEntitlementPayload(value: unknown): value is EntitlementPayload {
  return Boolean(value && typeof value === 'object' && 'outputUsedToday' in value);
}

export default function OutputLimitResetChip() {
  const [entitlement, setEntitlement] = useState<EntitlementPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const resetRefreshStartedRef = useRef(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/client/output-entitlement', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const next = payload.entitlement as EntitlementPayload | undefined;
      if (next) {
        setEntitlement(next);
        setSecondsLeft(typeof next.resetSeconds === 'number' ? next.resetSeconds : null);
        resetRefreshStartedRef.current = false;
      }
    } catch {
      setEntitlement(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    function handleUpdate(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (isEntitlementPayload(detail)) {
        setEntitlement(detail);
        setSecondsLeft(typeof detail.resetSeconds === 'number' ? detail.resetSeconds : null);
        resetRefreshStartedRef.current = false;
      } else {
        void load();
      }
    }

    void load();
    window.addEventListener('xdisputer:output-entitlement-updated', handleUpdate);
    window.addEventListener('xdisputer:output-entitlement-refresh', handleUpdate);
    const refresh = window.setInterval(load, 30_000);
    return () => {
      window.clearInterval(refresh);
      window.removeEventListener('xdisputer:output-entitlement-updated', handleUpdate);
      window.removeEventListener('xdisputer:output-entitlement-refresh', handleUpdate);
    };
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => typeof value === 'number' ? Math.max(0, value - 1) : value);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft !== 0 || resetRefreshStartedRef.current) return;
    resetRefreshStartedRef.current = true;
    window.dispatchEvent(new CustomEvent('xdisputer:output-entitlement-refresh'));
    void load();
  }, [secondsLeft, load]);

  const limitLabel = useMemo(() => {
    if (!entitlement) return 'Loading';
    if (entitlement.outputLimit === null) return `${entitlement.outputUsedToday} Daily Outputs`;
    return `${entitlement.outputUsedToday}/${entitlement.outputLimit} Daily Output${entitlement.outputLimit === 1 ? '' : 's'}`;
  }, [entitlement]);

  const remainingLabel = useMemo(() => {
    if (!entitlement) return 'Checking entitlement';
    if (entitlement.outputLimit === null) return 'No daily output limit configured';
    const remaining = Math.max(0, entitlement.outputRemainingToday ?? 0);
    return `${remaining} output${remaining === 1 ? '' : 's'} remaining today`;
  }, [entitlement]);

  const remaining = entitlement?.outputRemainingToday;
  const blocked = entitlement?.outputLimit !== null && (entitlement?.allowed === false || remaining === 0);
  const resetAt = formatResetAt(entitlement?.resetAt || null);

  return <aside className={`output-limit-reset-chip ${blocked ? 'blocked' : ''}`} aria-label="Daily output limit reset">
    <div className="output-limit-chip-main">
... clipped 12 line(s) ...
```

#### Latest version preview

```text
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type EntitlementPayload = {
  outputLimit: number | null;
  outputUsedToday: number;
  outputRemainingToday: number | null;
  resetAt: string | null;
  resetSeconds: number | null;
  allowed: boolean;
  message: string | null;
};

function formatDuration(seconds: number | null, refreshing = false) {
  if (refreshing) return 'Refreshing';
  if (seconds === null) return 'Calculating';
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secondsPart = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secondsPart}s`;
  if (minutes > 0) return `${minutes}m ${secondsPart}s`;
  return `${secondsPart}s`;
}

function formatResetAt(value: string | null) {
  if (!value) return '12:00 AM US ET';
  try {
    return `${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date(value))} US ET`;
  } catch {
    return '12:00 AM US ET';
  }
}

function isEntitlementPayload(value: unknown): value is EntitlementPayload {
  return Boolean(value && typeof value === 'object' && 'outputUsedToday' in value);
}

function countdownStep(secondsLeft: number | null) {
  if (secondsLeft === null || secondsLeft > 3600) return { delay: 60_000, decrement: 60 };
  if (secondsLeft > 300) return { delay: 10_000, decrement: 10 };
  return { delay: 1000, decrement: 1 };
}

export default function OutputLimitResetChip() {
  const [entitlement, setEntitlement] = useState<EntitlementPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const resetRefreshStartedRef = useRef(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/client/output-entitlement', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const next = payload.entitlement as EntitlementPayload | undefined;
      if (next) {
        setEntitlement(next);
        setSecondsLeft(typeof next.resetSeconds === 'number' ? next.resetSeconds : null);
        resetRefreshStartedRef.current = false;
      }
    } catch {
      setEntitlement(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    function handleUpdate(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (isEntitlementPayload(detail)) {
        setEntitlement(detail);
        setSecondsLeft(typeof detail.resetSeconds === 'number' ? detail.resetSeconds : null);
        resetRefreshStartedRef.current = false;
      } else {
        void load();
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') void load();
    }

    void load();
    window.addEventListener('xdisputer:output-entitlement-updated', handleUpdate);
    window.addEventListener('xdisputer:output-entitlement-refresh', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('xdisputer:output-entitlement-updated', handleUpdate);
      window.removeEventListener('xdisputer:output-entitlement-refresh', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [load]);

  useEffect(() => {
    if (typeof secondsLeft !== 'number') return;
    const step = countdownStep(secondsLeft);
    const timer = window.setTimeout(() => {
      setSecondsLeft((value) => typeof value === 'number' ? Math.max(0, value - step.decrement) : value);
    }, step.delay);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (secondsLeft !== 0 || resetRefreshStartedRef.current) return;
    resetRefreshStartedRef.current = true;
    window.dispatchEvent(new CustomEvent('xdisputer:output-entitlement-refresh'));
    void load();
  }, [secondsLeft, load]);

  const limitLabel = useMemo(() => {
    if (!entitlement) return 'Loading';
    if (entitlement.outputLimit === null) return `${entitlement.outputUsedToday} Daily Outputs`;
    return `${entitlement.outputUsedToday}/${entitlement.outputLimit} Daily Output${entitlement.outputLimit === 1 ? '' : 's'}`;
  }, [entitlement]);

  const remainingLabel = useMemo(() => {
... clipped 24 line(s) ...
```

### scripts/performance-boost-guard.mjs

- Status: M

#### Old version preview

```text
#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };
const mustNot = (source, marker, label) => { if (source.includes(marker)) failures.push(label); };

const debuggerMount = read('components/console/RenderDebuggerMount.tsx');
const accountMenu = read('components/console/AccountMenu.tsx');
const shell = read('components/console/ConsoleShell.tsx');
const notifications = read('lib/notifications/notification-service.ts');
const notificationDock = read('components/notifications/NotificationDock.tsx');
const dashboard = read('components/DashboardOperationsWorkspace.tsx');
const outputRoute = read('app/api/generation-runs/route.ts');
const perfContract = read('src/features/performance/performance-contract.ts');
const canvas = read('docs/performance-boost-canvas.md');
const repoAudit = read('scripts/repo-precision-audit.mjs');

must(debuggerMount, "dynamic(() => import('./RenderDebugger')", 'debugger must stay dynamically imported');
must(debuggerMount, 'NEXT_PUBLIC_XDISPUTER_DEBUG_PANEL', 'debugger must require explicit env flag');
mustNot(debuggerMount, "process.env.NODE_ENV !== 'production') return true", 'debugger must not auto-enable in development');
must(accountMenu, '<NotificationDock />', 'account rail must own notification dock');
mustNot(shell, '<NotificationDock', 'console shell must not mount notification dock directly');
must(notifications, ".select('id,title,body", 'notification queries must select explicit columns');
must(notifications, '.limit(', 'notification queries must limit rows');
must(notificationDock, '120_000', 'notification polling should be throttled');
must(dashboard, 'StaticEntitlementChip', 'dashboard entitlement surface should be static');
mustNot(dashboard, "import OutputLimitResetChip", 'dashboard must not import polling entitlement chip');
must(outputRoute, 'outputActivityContract.defaultRateAmount', 'generation route must use output activity contract');
must(perfContract, 'heavy-client-bundle-risk', 'performance contract must track heavy client bundle risk');
must(canvas, 'Performance Boost Canvas', 'performance canvas missing');
must(repoAudit, 'Supabase query appears to filter before select', 'repo audit must detect Supabase query order risk');

if (failures.length) {
  console.error(`performance-boost-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('performance-boost-guard: ok');

```

#### Latest version preview

```text
#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };
const mustNot = (source, marker, label) => { if (source.includes(marker)) failures.push(label); };

const debuggerMount = read('components/console/RenderDebuggerMount.tsx');
const accountMenu = read('components/console/AccountMenu.tsx');
const shell = read('components/console/ConsoleShell.tsx');
const notifications = read('lib/notifications/notification-service.ts');
const notificationDock = read('components/notifications/NotificationDock.tsx');
const dashboard = read('components/DashboardOperationsWorkspace.tsx');
const boundary = read('components/ClientOutputLimitBoundary.tsx');
const workspace = read('components/LetterGeneratorWorkspaceV2.tsx');
const outputRoute = read('app/api/generation-runs/route.ts');
const perfContract = read('src/features/performance/performance-contract.ts');
const canvas = read('docs/performance-boost-canvas.md');
const repoAudit = read('scripts/repo-precision-audit.mjs');

must(debuggerMount, "dynamic(() => import('./RenderDebugger')", 'debugger must stay dynamically imported');
must(debuggerMount, 'NEXT_PUBLIC_XDISPUTER_DEBUG_PANEL', 'debugger must require explicit env flag');
mustNot(debuggerMount, "process.env.NODE_ENV !== 'production') return true", 'debugger must not auto-enable in development');
must(accountMenu, '<NotificationDock />', 'account rail must own notification dock');
mustNot(shell, '<NotificationDock', 'console shell must not mount notification dock directly');
must(notifications, ".select('id,title,body", 'notification queries must select explicit columns');
must(notifications, '.limit(', 'notification queries must limit rows');
must(notificationDock, '120_000', 'notification polling should be throttled');
must(dashboard, 'StaticEntitlementChip', 'dashboard entitlement surface should be static');
mustNot(dashboard, "import OutputLimitResetChip", 'dashboard must not import polling entitlement chip');
mustNot(boundary, 'window.setInterval', 'output limit boundary must not run interval polling');
must(workspace, "import('jszip')", 'workspace archive builder must lazy-load JSZip');
mustNot(workspace, "import JSZip from 'jszip'", 'workspace must not statically import JSZip');
mustNot(workspace, "import OutputLimitResetChip", 'workspace header must not import polling entitlement chip');
must(outputRoute, 'outputActivityContract.defaultRateAmount', 'generation route must use output activity contract');
must(perfContract, 'heavy-client-bundle-risk', 'performance contract must track heavy client bundle risk');
must(canvas, 'Performance Boost Canvas', 'performance canvas missing');
must(repoAudit, 'Supabase query appears to filter before select', 'repo audit must detect Supabase query order risk');

if (failures.length) {
  console.error(`performance-boost-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('performance-boost-guard: ok');

```

### src/features/performance/performance-contract.ts

- Status: M

#### Old version preview

```text
export const performanceContract = {
  owner: 'src/features/performance',
  canvas: 'docs/performance-boost-canvas.md',
  guard: 'scripts/performance-boost-guard.mjs',
  debugMount: 'components/console/RenderDebuggerMount.tsx',
  notificationOwner: 'components/console/AccountMenu.tsx',
  dashboardOwner: 'components/DashboardOperationsWorkspace.tsx',
  rules: {
    debugPanelDefault: 'off',
    notificationOwner: 'account-rail-only',
    notificationPollingMs: 120000,
    dashboardEntitlementSurface: 'static-no-polling-chip',
    supabaseQueryOrder: 'from-select-filter-order-limit',
    heavyClientLibraries: 'lazy-or-server-only',
    cssOwnership: 'feature-owned-or-contract-marked'
  }
} as const;

export const performanceCriticalGaps = [
  'debug-overlay-default-on',
  'browser-timer-frequency',
  'heavy-client-bundle-risk',
  'global-css-cascade-risk',
  'supabase-overfetch-or-query-order'
] as const;

```

#### Latest version preview

```text
export const performanceContract = {
  owner: 'src/features/performance',
  canvas: 'docs/performance-boost-canvas.md',
  guard: 'scripts/performance-boost-guard.mjs',
  debugMount: 'components/console/RenderDebuggerMount.tsx',
  notificationOwner: 'components/console/AccountMenu.tsx',
  dashboardOwner: 'components/DashboardOperationsWorkspace.tsx',
  outputBoundaryOwner: 'components/ClientOutputLimitBoundary.tsx',
  workspaceOwner: 'components/LetterGeneratorWorkspaceV2.tsx',
  rules: {
    debugPanelDefault: 'off',
    notificationOwner: 'account-rail-only',
    notificationPollingMs: 120000,
    dashboardEntitlementSurface: 'static-no-polling-chip',
    outputBoundaryRefresh: 'event-driven-no-interval',
    archiveBuilder: 'lazy-jszip-after-user-generation-action',
    supabaseQueryOrder: 'from-select-filter-order-limit',
    heavyClientLibraries: 'lazy-or-server-only',
    cssOwnership: 'feature-owned-or-contract-marked'
  }
} as const;

export const performanceCriticalGaps = [
  'debug-overlay-default-on',
  'browser-timer-frequency',
  'heavy-client-bundle-risk',
  'global-css-cascade-risk',
  'supabase-overfetch-or-query-order'
] as const;

```

