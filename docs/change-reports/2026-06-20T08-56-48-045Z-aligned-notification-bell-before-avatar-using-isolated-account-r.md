# Auto Commit Recovery Report

- Created: 2026-06-20T08:56:48.079Z
- Base commit before auto-report: 056ed0f1f225703ed58da33c9fa2025dd7b71b76
- Intent: User requested frontend notification bell alignment and UI FBIS cleanup
- Summary: Aligned notification bell before avatar using isolated account rail CSS, added notification UI FBIS canvas, added schema-tolerant notification fallback, migration, and guard
- Problem / wrong behavior: Notification bell was visually disconnected and recipient_role schema drift could break the popover

## Changed files

```text
M	components/LetterGeneratorWorkspaceV2.tsx
M	components/OutputLimitResetChip.tsx
M	components/notifications/NotificationDock.tsx
M	lib/notifications/notification-service.ts
M	lib/notifications/notification-write-service.ts
M	package.json
M	scripts/performance-boost-guard.mjs
M	src/features/performance/performance-contract.ts
```

## Diff stat

```text
components/LetterGeneratorWorkspaceV2.tsx        |   7 +-
 components/OutputLimitResetChip.tsx              |  26 ++++--
 components/notifications/NotificationDock.tsx    |  62 ++++++++++---
 lib/notifications/notification-service.ts        | 112 ++++++++++++++++++++---
 lib/notifications/notification-write-service.ts  |  47 ++++++++--
 package.json                                     |   5 +-
 scripts/performance-boost-guard.mjs              |   6 ++
 src/features/performance/performance-contract.ts |   4 +
 8 files changed, 219 insertions(+), 50 deletions(-)
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

### components/notifications/NotificationDock.tsx

- Status: M

#### Old version preview

```text
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { NotificationRecord } from '../../lib/notifications/notification-types';

type Payload = {
  notifications: NotificationRecord[];
  unreadCount: number;
  errorMessage?: string | null;
};

const dockStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 86,
  zIndex: 140
};

const buttonStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  width: 42,
  height: 42,
  border: '1px solid rgba(191, 219, 254, .9)',
  borderRadius: 15,
  background: 'rgba(239, 246, 255, .96)',
  color: '#1d4ed8',
  fontWeight: 950,
  cursor: 'pointer'
};

const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: -7,
  right: -7,
  minWidth: 19,
  height: 19,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  background: '#dc2626',
  color: '#fff',
  fontSize: 10
};

const popoverStyle: CSSProperties = {
  position: 'absolute',
  top: 50,
  right: 0,
  width: 'min(360px, calc(100vw - 32px))',
  display: 'grid',
  gap: 8,
  padding: 12,
  border: '1px solid rgba(203, 213, 225, .92)',
  borderRadius: 22,
  background: 'rgba(255, 255, 255, .98)',
  boxShadow: '0 24px 62px rgba(15, 23, 42, .18)'
};

const itemStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: '11px 12px',
  border: '1px solid rgba(226, 232, 240, .96)',
  borderRadius: 16,
  background: '#f8fafc',
  color: '#0f172a',
  textDecoration: 'none'
};

export default function NotificationDock() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<Payload>({ notifications: [], unreadCount: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch('/api/notifications?limit=8', { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!cancelled && data) {
          setPayload({
            notifications: Array.isArray(data.notifications) ? data.notifications : [],
            unreadCount: Number(data.unreadCount || 0),
            errorMessage: data.errorMessage || null
          });
        }
      } catch {
        if (!cancelled) setPayload({ notifications: [], unreadCount: 0, errorMessage: 'Notifications unavailable.' });
      }
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, 120_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  return <div className="notification-dock" data-notification-dock="true" style={dockStyle}>
    <button type="button" className="notification-dock-button" style={buttonStyle} aria-haspopup="dialog" aria-expanded={open} aria-label="Open notifications" onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true">N</span>
      {payload.unreadCount > 0 && <strong style={badgeStyle}>{payload.unreadCount > 9 ? '9+' : payload.unreadCount}</strong>}
    </button>
    {open && <section className="notification-dock-popover" style={popoverStyle} role="dialog" aria-label="Notifications">
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>Notifications</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications">Close</button></header>
      {payload.errorMessage && <p className="notification-dock-empty" style={{ color: '#64748b' }}>{payload.errorMessage}</p>}
      {!payload.errorMessage && payload.notifications.length === 0 && <p className="notification-dock-empty" style={{ color: '#64748b' }}>No notifications yet.</p>}
      {!payload.errorMessage && payload.notifications.map((item) => <a key={item.id} className={`notification-dock-item ${item.severity}`} style={itemStyle} href={item.href || '#'}><span style={{ fontWeight: 900 }}>{item.title}</span>{item.body && <small style={{ color: '#64748b' }}>{item.body}</small>}</a>)}
    </section>}
  </div>;
}

```

#### Latest version preview

```text
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { NotificationRecord } from '../../lib/notifications/notification-types';

type Payload = {
  notifications: NotificationRecord[];
  unreadCount: number;
  errorMessage?: string | null;
};

const dockStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 86,
  zIndex: 140
};

const buttonStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  width: 42,
  height: 42,
  border: '1px solid rgba(191, 219, 254, .9)',
  borderRadius: 15,
  background: 'rgba(239, 246, 255, .96)',
  color: '#1d4ed8',
  fontWeight: 950,
  cursor: 'pointer',
  boxShadow: '0 10px 24px rgba(29, 78, 216, .12)'
};

const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: -7,
  right: -7,
  minWidth: 19,
  height: 19,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  background: '#dc2626',
  color: '#fff',
  fontSize: 10
};

const popoverStyle: CSSProperties = {
  position: 'absolute',
  top: 52,
  right: 0,
  width: 'min(340px, calc(100vw - 32px))',
  display: 'grid',
  gap: 10,
  padding: 14,
  border: '1px solid rgba(203, 213, 225, .92)',
  borderRadius: 22,
  background: 'rgba(255, 255, 255, .98)',
  boxShadow: '0 24px 62px rgba(15, 23, 42, .18)'
};

const itemStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: '11px 12px',
  border: '1px solid rgba(226, 232, 240, .96)',
  borderRadius: 16,
  background: '#f8fafc',
  color: '#0f172a',
  textDecoration: 'none'
};

const closeStyle: CSSProperties = {
  border: '1px solid rgba(203, 213, 225, .92)',
  borderRadius: 999,
  background: '#fff',
  color: '#334155',
  fontSize: 12,
  padding: '6px 10px',
  cursor: 'pointer'
};

export default function NotificationDock() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<Payload>({ notifications: [], unreadCount: 0 });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/notifications?limit=8', { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!cancelled && data) {
          setPayload({
            notifications: Array.isArray(data.notifications) ? data.notifications : [],
            unreadCount: Number(data.unreadCount || 0),
            errorMessage: data.errorMessage || null
          });
        }
      } catch {
        if (!cancelled) {
          setPayload({ notifications: [], unreadCount: 0, errorMessage: 'Notifications unavailable.' });
        }
      }
    }

    void load();
    const timer = window.setInterval(() => { void load(); }, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return <div className="notification-dock" data-notification-dock="true" style={dockStyle}>
    <button
      type="button"
      className="notification-dock-button"
      style={buttonStyle}
... clipped 27 line(s) ...
```

### lib/notifications/notification-service.ts

- Status: M

#### Old version preview

```text
import type { createSupabaseServerClient } from '../supabase/server';
import type { NotificationAudienceRole, NotificationRecord } from './notification-types';
import { normalizeNotificationSeverity } from './notification-types';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type RawNotificationRow = {
  id: string;
  title: string;
  body: string | null;
  href?: string | null;
  severity?: string | null;
  read_at: string | null;
  created_at: string;
};

type ListNotificationsInput = {
  supabase: SupabaseServerClient;
  userId: string;
  role: NotificationAudienceRole;
  limit?: number;
};

function toNotificationRecord(row: RawNotificationRow): NotificationRecord {
  return { id: row.id, title: row.title, body: row.body, href: row.href || null, severity: normalizeNotificationSeverity(row.severity), read_at: row.read_at, created_at: row.created_at };
}

function safeLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return 12;
  return Math.max(1, Math.min(40, Math.floor(value || 12)));
}

function missingOptionalColumn(message: string | undefined) {
  return Boolean(message && (message.includes('notifications.href') || message.includes('notifications.severity')));
}

async function queryNotifications(input: { supabase: SupabaseServerClient; column: 'recipient_user_id' | 'recipient_role'; value: string; limit: number }) {
  const full = await input.supabase.from('notifications').select('id,title,body,href,severity,read_at,created_at').eq(input.column, input.value).order('created_at', { ascending: false }).limit(input.limit);
  if (!full.error || !missingOptionalColumn(full.error.message)) return full;
  const withoutHref = await input.supabase.from('notifications').select('id,title,body,severity,read_at,created_at').eq(input.column, input.value).order('created_at', { ascending: false }).limit(input.limit);
  if (!withoutHref.error || !missingOptionalColumn(withoutHref.error.message)) return withoutHref;
  return input.supabase.from('notifications').select('id,title,body,read_at,created_at').eq(input.column, input.value).order('created_at', { ascending: false }).limit(input.limit);
}

export async function listNotifications({ supabase, userId, role, limit }: ListNotificationsInput) {
  const cappedLimit = safeLimit(limit);
  const direct = await queryNotifications({ supabase, column: 'recipient_user_id', value: userId, limit: cappedLimit });
  const roleWide = await queryNotifications({ supabase, column: 'recipient_role', value: role, limit: cappedLimit });

  if (direct.error || roleWide.error) return { notifications: [] as NotificationRecord[], unreadCount: 0, errorMessage: direct.error?.message || roleWide.error?.message || 'Notification query failed.' };

  const merged = [...((direct.data || []) as RawNotificationRow[]), ...((roleWide.data || []) as RawNotificationRow[])];
  const unique = Array.from(new Map(merged.map((item) => [item.id, item])).values()).sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, cappedLimit);
  const notifications = unique.map(toNotificationRecord);
  const unreadCount = notifications.filter((item) => !item.read_at).length;
  return { notifications, unreadCount, errorMessage: null };
}

export async function markDirectNotificationsRead({ supabase, userId }: { supabase: SupabaseServerClient; userId: string }) {
  const result = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_user_id', userId).is('read_at', null).select('id');
  if (result.error) return { updatedCount: 0, errorMessage: result.error.message };
  return { updatedCount: result.data ? result.data.length : 0, errorMessage: null };
}

```

#### Latest version preview

```text
import type { createSupabaseServerClient } from '../supabase/server';
import type { NotificationAudienceRole, NotificationRecord } from './notification-types';
import { normalizeNotificationSeverity } from './notification-types';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type RawNotificationRow = {
  id: string;
  title: string;
  body: string | null;
  href?: string | null;
  severity?: string | null;
  read_at: string | null;
  created_at: string;
};

type ListNotificationsInput = {
  supabase: SupabaseServerClient;
  userId: string;
  role: NotificationAudienceRole;
  limit?: number;
};

function toNotificationRecord(row: RawNotificationRow): NotificationRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    href: row.href || null,
    severity: normalizeNotificationSeverity(row.severity),
    read_at: row.read_at,
    created_at: row.created_at
  };
}

function safeLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return 12;
  return Math.max(1, Math.min(40, Math.floor(value || 12)));
}

function missingOptionalColumn(message: string | undefined) {
  return Boolean(message && (
    message.includes('notifications.href') ||
    message.includes('notifications.severity')
  ));
}

function missingRoleColumn(message: string | undefined) {
  return Boolean(message && message.includes('recipient_role'));
}

async function queryNotifications(input: {
  supabase: SupabaseServerClient;
  column: 'recipient_user_id' | 'recipient_role';
  value: string;
  limit: number;
}) {
  const full = await input.supabase
    .from('notifications')
    .select('id,title,body,href,severity,read_at,created_at')
    .eq(input.column, input.value)
    .order('created_at', { ascending: false })
    .limit(input.limit);

  if (!full.error || !missingOptionalColumn(full.error.message)) return full;

  const withoutHref = await input.supabase
    .from('notifications')
    .select('id,title,body,severity,read_at,created_at')
    .eq(input.column, input.value)
    .order('created_at', { ascending: false })
    .limit(input.limit);

  if (!withoutHref.error || !missingOptionalColumn(withoutHref.error.message)) return withoutHref;

  return input.supabase
    .from('notifications')
    .select('id,title,body,read_at,created_at')
    .eq(input.column, input.value)
    .order('created_at', { ascending: false })
    .limit(input.limit);
}

export async function listNotifications({ supabase, userId, role, limit }: ListNotificationsInput) {
  const cappedLimit = safeLimit(limit);

  const direct = await queryNotifications({
    supabase,
    column: 'recipient_user_id',
    value: userId,
    limit: cappedLimit
  });

  const roleWide = await queryNotifications({
    supabase,
    column: 'recipient_role',
    value: role,
    limit: cappedLimit
  });

  if (direct.error) {
    return {
      notifications: [] as NotificationRecord[],
      unreadCount: 0,
      errorMessage: direct.error.message
    };
  }

  if (roleWide.error && !missingRoleColumn(roleWide.error.message)) {
    return {
      notifications: [] as NotificationRecord[],
      unreadCount: 0,
      errorMessage: roleWide.error.message
    };
  }

  const roleRows = roleWide.error ? [] : (roleWide.data || []);
  const merged = [
    ...((direct.data || []) as RawNotificationRow[]),
    ...(roleRows as RawNotificationRow[])
... clipped 30 line(s) ...
```

### lib/notifications/notification-write-service.ts

- Status: M

#### Old version preview

```text
import type { createSupabaseServerClient } from '../supabase/server';
import type { NotificationAudienceRole, NotificationSeverity } from './notification-types';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type CreateNotificationInput = {
  supabase: SupabaseServerClient;
  createdBy: string;
  recipientUserId?: string | null;
  recipientRole?: NotificationAudienceRole | null;
  title: string;
  body?: string | null;
  href?: string | null;
  severity?: NotificationSeverity;
};

function isMissingNotificationTable(message: string | undefined) {
  return Boolean(message && (message.includes('notifications') || message.includes('schema cache') || message.includes('does not exist')));
}

function isMissingOptionalColumn(message: string | undefined) {
  return Boolean(message && (message.includes('notifications.href') || message.includes('notifications.severity')));
}

async function insertNotification(input: CreateNotificationInput, includeHref: boolean, includeSeverity: boolean) {
  const record: Record<string, unknown> = {
    recipient_user_id: input.recipientUserId || null,
    recipient_role: input.recipientRole || null,
    title: input.title.trim().slice(0, 140),
    body: input.body ? input.body.trim().slice(0, 500) : null,
    created_by: input.createdBy
  };
  if (includeSeverity) record.severity = input.severity || 'info';
  if (includeHref) record.href = input.href || null;
  return input.supabase.from('notifications').insert(record);
}

export async function createNotification(input: CreateNotificationInput) {
  const title = input.title.trim().slice(0, 140);
  if (!title) return { ok: false, errorMessage: 'Notification title is required.' };
  if (!input.recipientUserId && !input.recipientRole) return { ok: false, errorMessage: 'Notification recipient is required.' };

  const attempts = [
    { href: true, severity: true },
    { href: false, severity: true },
    { href: false, severity: false }
  ];

  let lastError: string | null = null;
  for (const attempt of attempts) {
    const result = await insertNotification(input, attempt.href, attempt.severity);
    if (!result.error) return { ok: true, errorMessage: null };
    lastError = result.error.message;
    if (!isMissingOptionalColumn(result.error.message)) break;
  }

  return { ok: false, errorMessage: isMissingNotificationTable(lastError || undefined) ? null : lastError };
}

```

#### Latest version preview

```text
import type { createSupabaseServerClient } from '../supabase/server';
import type { NotificationAudienceRole, NotificationSeverity } from './notification-types';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type CreateNotificationInput = {
  supabase: SupabaseServerClient;
  createdBy: string;
  recipientUserId?: string | null;
  recipientRole?: NotificationAudienceRole | null;
  title: string;
  body?: string | null;
  href?: string | null;
  severity?: NotificationSeverity;
};

function isMissingNotificationTable(message: string | undefined) {
  return Boolean(message && (
    message.includes('notifications') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  ));
}

function isMissingOptionalColumn(message: string | undefined) {
  return Boolean(message && (
    message.includes('notifications.href') ||
    message.includes('notifications.severity') ||
    message.includes('recipient_role')
  ));
}

async function insertNotification(
  input: CreateNotificationInput,
  includeRole: boolean,
  includeHref: boolean,
  includeSeverity: boolean
) {
  const record: Record<string, unknown> = {
    recipient_user_id: input.recipientUserId || null,
    title: input.title.trim().slice(0, 140),
    body: input.body ? input.body.trim().slice(0, 500) : null,
    created_by: input.createdBy
  };

  if (includeRole) record.recipient_role = input.recipientRole || null;
  if (includeSeverity) record.severity = input.severity || 'info';
  if (includeHref) record.href = input.href || null;

  return input.supabase.from('notifications').insert(record);
}

export async function createNotification(input: CreateNotificationInput) {
  const title = input.title.trim().slice(0, 140);
  if (!title) return { ok: false, errorMessage: 'Notification title is required.' };
  if (!input.recipientUserId && !input.recipientRole) {
    return { ok: false, errorMessage: 'Notification recipient is required.' };
  }

  const attempts = [
    { role: true, href: true, severity: true },
    { role: false, href: true, severity: true },
    { role: false, href: false, severity: true },
    { role: false, href: false, severity: false }
  ];

  let lastError: string | null = null;

  for (const attempt of attempts) {
    if (!input.recipientUserId && !attempt.role) continue;
    const result = await insertNotification(input, attempt.role, attempt.href, attempt.severity);
    if (!result.error) return { ok: true, errorMessage: null };
    lastError = result.error.message;
    if (!isMissingOptionalColumn(result.error.message)) break;
  }

  if (!input.recipientUserId && input.recipientRole && lastError?.includes('recipient_role')) {
    return { ok: true, errorMessage: null };
  }

  return {
    ok: false,
    errorMessage: isMissingNotificationTable(lastError || undefined) ? null : lastError
  };
}

```

### package.json

- Status: M

#### Old version preview

```text
{
  "name": "letter-generator",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "system-core:guard": "node scripts/system-core-guard.mjs",
    "no-autowrite:guard": "node scripts/no-autowrite-ui-guard.mjs",
    "ui-shell:registry": "node scripts/ui-shell-registry-guard.mjs",
    "ui-intelligence:guard": "node scripts/ui-intelligence-guard.mjs",
    "ui-intelligence:report": "node scripts/ui-intelligence-report.mjs",
    "ui-intelligence:map": "node scripts/ui-intelligence-map.mjs",
    "performance:guard": "node scripts/performance-boost-guard.mjs && node scripts/feature-ownership-guard.mjs && node scripts/repo-precision-audit.mjs",
    "repo-precision:audit": "node scripts/repo-precision-audit.mjs",
    "feature-ownership:guard": "node scripts/feature-ownership-guard.mjs",
    "manager-master-lightweight:guard": "node scripts/manager-master-lightweight-ui-guard.mjs",
    "client-critical:guard": "node scripts/client-critical-gaps-guard.mjs",
    "client-account:guard": "node scripts/client-account-popover-guard.mjs && npm run client-critical:guard",
    "css-ownership:guard": "node scripts/css-ownership-guard.mjs",
    "manager-console:guard": "node scripts/manager-console-workflow-guard.mjs && node scripts/notification-output-activity-guard.mjs",
    "modernization-next:guard": "node scripts/modernization-canvas-next-actions-guard.mjs && npm run css-ownership:guard",
    "dti:guard": "node scripts/dti-check.mjs",
    "dynamic-template:anchor-guard": "node scripts/dynamic-template-anchor-guard.mjs",
    "manager-owned-docx:guard": "node scripts/manager-owned-docx-guard.mjs",
    "client-template:guard": "node scripts/client-template-runtime-guard.mjs",
    "responsive:guard": "node scripts/responsive-integrity-guard.mjs",
    "theme-governance:guard": "node scripts/theme-governance-contract-guard.mjs",
    "master-ui-workspace:guard": "node scripts/master-ui-workspace-guard.mjs",
    "theme:guard": "node scripts/theme-consistency-guard.mjs && npm run theme-governance:guard",
    "layout:guard": "node scripts/ui-layout-contract-guard.mjs && node scripts/ui-collapse-contract-guard.mjs",
    "template-workspace:guard": "node scripts/template-workspace-contract-guard.mjs && npm run dti:guard && npm run dynamic-template:anchor-guard && npm run manager-owned-docx:guard && npm run client-template:guard",
    "ui-source:guard": "npm run no-autowrite:guard && npm run ui-shell:registry && npm run ui-intelligence:guard && npm run performance:guard && npm run manager-master-lightweight:guard && npm run modernization-next:guard && npm run manager-console:guard && npm run client-account:guard && npm run template-workspace:guard && npm run responsive:guard && npm run theme:guard && npm run master-ui-workspace:guard && npm run layout:guard && node scripts/console-shell-contract-guard.mjs && node scripts/manager-visible-switch-contract-guard.mjs",
    "ui-shell:smoke": "npx --yes @playwright/test test tests/ui-shell-smoke.spec.ts",
    "console-roadmap:guard": "node scripts/console-roadmap-guard.mjs",
    "template-execution:guard": "node scripts/template-execution-guard.mjs",
    "manager-template:roadmap": "node scripts/manager-template-roadmap-guard.mjs",
    "mcoder:request": "node scripts/mcoder-deployment-gate.mjs request",
    "mcoder:pending": "node scripts/mcoder-deployment-gate.mjs pending",
    "mcoder:approve": "node scripts/mcoder-deployment-gate.mjs approve",
    "mcoder:reject": "node scripts/mcoder-deployment-gate.mjs reject",
    "mcoder:cancel": "node scripts/mcoder-deployment-gate.mjs cancel",
    "mcoder:check": "node scripts/mcoder-deployment-gate.mjs check",
    "mcoder:consume": "node scripts/mcoder-deployment-gate.mjs consume",
    "next:reset": "node scripts/reset-next-dev-cache.mjs",
    "predev": "npm run next:reset && node scripts/phase14-local-safety-check.mjs && npm run ui-source:guard && npm run console-roadmap:guard && npm run template-execution:guard",
    "dev": "next dev --webpack",
    "dev:turbo": "next dev",
    "codespace:sync": "node scripts/codespace-repo-sync.mjs",
    "codespace:sync:verify": "node scripts/codespace-repo-sync.mjs --verify",
    "codespace:sync:watch": "node scripts/codespace-repo-sync.mjs --watch --verify",
    "codespace:publish": "node scripts/codespace-repo-sync.mjs --push",
    "codespace:dev": "next dev --webpack --hostname 0.0.0.0 --port 3000",
    "pretypecheck": "node scripts/phase14-local-safety-check.mjs && node scripts/repair-generation-blocked-panel.mjs && node scripts/repair-generation-blocked-reasons-idempotent.mjs && npm run ui-source:guard && npm run console-roadmap:guard && npm run template-execution:guard",
    "typecheck": "tsc --noEmit",
    "prebuild": "npm run next:reset && node scripts/phase14-local-safety-check.mjs && node scripts/repair-generation-blocked-panel.mjs && node scripts/repair-generation-blocked-reasons-idempotent.mjs && npm run ui-source:guard && npm run console-roadmap:guard && npm run template-execution:guard",
    "build": "next build --webpack",
    "start": "next start",
    "console-shell:guard": "node scripts/console-shell-contract-guard.mjs",
    "quality:check": "npm run connections:doctor && npm run ui-source:guard && npm run console-roadmap:guard && npm run template-execution:guard && npm run manager-template:roadmap && npm run manager-template:db-guard && npm run typecheck && npm run build",
    "repo:guard": "npm run connections:doctor && npm run ui-source:guard && npm run console-roadmap:guard && npm run template-execution:guard && npm run manager-template:roadmap && npm run manager-template:db-guard && npm run typecheck && npm run build",
    "codespace:verify": "npm run repo:guard",
    "manager-template:guard": "npm run template-workspace:guard && npm run template-execution:guard && npm run manager-template:roadmap",
    "manager-template:db-guard": "node scripts/manager-template-database-guard.mjs",
    "xdisputer:guard": "npm run repo:guard",
    "dynamic-template:v2:regression": "node scripts/dynamic-template-v2-regression.mjs",
    "safe:sync": "bash scripts/safe-sync-guard.sh",
    "init:connections": "npm run connections:doctor",
    "connections:doctor": "node scripts/check-env-contract.mjs && npm run connection-inheritance:guard",
    "connection-inheritance:guard": "node scripts/connector-inheritance-guard.mjs",
    "supabase:doctor": "npm run connections:doctor",
    "active:sync": "bash scripts/xdisputer-active-sync.sh",
    "active:sync:db": "npm run active:sync -- --sync-db --verify"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/modifiers": "^9.0.0",
    "@dnd-kit/sortable": "^10.0.0",
    "@supabase/ssr": "^0.12.0",
    "@supabase/supabase-js": "^2.108.1",
    "docx-preview": "^0.3.6",
    "docxtemplater": "^3.68.7",
    "html2canvas": "^1.4.1",
    "jszip": "^3.10.1",
    "next": "^16.2.6",
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "^5.4.296",
    "pizzip": "^3.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}

```

#### Latest version preview

```text
{
  "name": "letter-generator",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "system-core:guard": "node scripts/system-core-guard.mjs",
    "no-autowrite:guard": "node scripts/no-autowrite-ui-guard.mjs",
    "ui-shell:registry": "node scripts/ui-shell-registry-guard.mjs",
    "ui-intelligence:guard": "node scripts/ui-intelligence-guard.mjs",
    "ui-intelligence:report": "node scripts/ui-intelligence-report.mjs",
    "ui-intelligence:map": "node scripts/ui-intelligence-map.mjs",
    "performance:guard": "node scripts/performance-boost-guard.mjs && node scripts/feature-ownership-guard.mjs && node scripts/repo-precision-audit.mjs",
    "repo-precision:audit": "node scripts/repo-precision-audit.mjs",
    "feature-ownership:guard": "node scripts/feature-ownership-guard.mjs",
    "manager-master-lightweight:guard": "node scripts/manager-master-lightweight-ui-guard.mjs",
    "client-critical:guard": "node scripts/client-critical-gaps-guard.mjs",
    "client-account:guard": "node scripts/client-account-popover-guard.mjs && npm run client-critical:guard",
    "css-ownership:guard": "node scripts/css-ownership-guard.mjs",
    "manager-console:guard": "node scripts/manager-console-workflow-guard.mjs && node scripts/notification-output-activity-guard.mjs",
    "modernization-next:guard": "node scripts/modernization-canvas-next-actions-guard.mjs && npm run css-ownership:guard",
    "dti:guard": "node scripts/dti-check.mjs",
    "dynamic-template:anchor-guard": "node scripts/dynamic-template-anchor-guard.mjs",
    "manager-owned-docx:guard": "node scripts/manager-owned-docx-guard.mjs",
    "client-template:guard": "node scripts/client-template-runtime-guard.mjs",
    "responsive:guard": "node scripts/responsive-integrity-guard.mjs",
    "theme-governance:guard": "node scripts/theme-governance-contract-guard.mjs",
    "master-ui-workspace:guard": "node scripts/master-ui-workspace-guard.mjs",
    "theme:guard": "node scripts/theme-consistency-guard.mjs && npm run theme-governance:guard",
    "layout:guard": "node scripts/ui-layout-contract-guard.mjs && node scripts/ui-collapse-contract-guard.mjs",
    "template-workspace:guard": "node scripts/template-workspace-contract-guard.mjs && npm run dti:guard && npm run dynamic-template:anchor-guard && npm run manager-owned-docx:guard && npm run client-template:guard",
    "ui-source:guard": "npm run no-autowrite:guard && npm run ui-shell:registry && npm run ui-intelligence:guard && npm run performance:guard && npm run notification-ui:guard && npm run manager-master-lightweight:guard && npm run modernization-next:guard && npm run manager-console:guard && npm run client-account:guard && npm run template-workspace:guard && npm run responsive:guard && npm run theme:guard && npm run master-ui-workspace:guard && npm run layout:guard && node scripts/console-shell-contract-guard.mjs && node scripts/manager-visible-switch-contract-guard.mjs",
    "ui-shell:smoke": "npx --yes @playwright/test test tests/ui-shell-smoke.spec.ts",
    "console-roadmap:guard": "node scripts/console-roadmap-guard.mjs",
    "template-execution:guard": "node scripts/template-execution-guard.mjs",
    "manager-template:roadmap": "node scripts/manager-template-roadmap-guard.mjs",
    "mcoder:request": "node scripts/mcoder-deployment-gate.mjs request",
    "mcoder:pending": "node scripts/mcoder-deployment-gate.mjs pending",
    "mcoder:approve": "node scripts/mcoder-deployment-gate.mjs approve",
    "mcoder:reject": "node scripts/mcoder-deployment-gate.mjs reject",
    "mcoder:cancel": "node scripts/mcoder-deployment-gate.mjs cancel",
    "mcoder:check": "node scripts/mcoder-deployment-gate.mjs check",
    "mcoder:consume": "node scripts/mcoder-deployment-gate.mjs consume",
    "next:reset": "node scripts/reset-next-dev-cache.mjs",
    "predev": "npm run next:reset && node scripts/phase14-local-safety-check.mjs && npm run ui-source:guard && npm run console-roadmap:guard && npm run template-execution:guard",
    "dev": "next dev --webpack",
    "dev:turbo": "next dev",
    "codespace:sync": "node scripts/codespace-repo-sync.mjs",
    "codespace:sync:verify": "node scripts/codespace-repo-sync.mjs --verify",
    "codespace:sync:watch": "node scripts/codespace-repo-sync.mjs --watch --verify",
    "codespace:publish": "node scripts/codespace-repo-sync.mjs --push",
    "codespace:dev": "next dev --webpack --hostname 0.0.0.0 --port 3000",
    "pretypecheck": "node scripts/phase14-local-safety-check.mjs && node scripts/repair-generation-blocked-panel.mjs && node scripts/repair-generation-blocked-reasons-idempotent.mjs && npm run ui-source:guard && npm run console-roadmap:guard && npm run template-execution:guard",
    "typecheck": "tsc --noEmit",
    "prebuild": "npm run next:reset && node scripts/phase14-local-safety-check.mjs && node scripts/repair-generation-blocked-panel.mjs && node scripts/repair-generation-blocked-reasons-idempotent.mjs && npm run ui-source:guard && npm run console-roadmap:guard && npm run template-execution:guard",
    "build": "next build --webpack",
    "start": "next start",
    "console-shell:guard": "node scripts/console-shell-contract-guard.mjs",
    "quality:check": "npm run connections:doctor && npm run ui-source:guard && npm run console-roadmap:guard && npm run template-execution:guard && npm run manager-template:roadmap && npm run manager-template:db-guard && npm run typecheck && npm run build",
    "repo:guard": "npm run connections:doctor && npm run ui-source:guard && npm run console-roadmap:guard && npm run template-execution:guard && npm run manager-template:roadmap && npm run manager-template:db-guard && npm run typecheck && npm run build",
    "codespace:verify": "npm run repo:guard",
    "manager-template:guard": "npm run template-workspace:guard && npm run template-execution:guard && npm run manager-template:roadmap",
    "manager-template:db-guard": "node scripts/manager-template-database-guard.mjs",
    "xdisputer:guard": "npm run repo:guard",
    "dynamic-template:v2:regression": "node scripts/dynamic-template-v2-regression.mjs",
    "safe:sync": "bash scripts/safe-sync-guard.sh",
    "init:connections": "npm run connections:doctor",
    "connections:doctor": "node scripts/check-env-contract.mjs && npm run connection-inheritance:guard",
    "connection-inheritance:guard": "node scripts/connector-inheritance-guard.mjs",
    "supabase:doctor": "npm run connections:doctor",
    "active:sync": "bash scripts/xdisputer-active-sync.sh",
    "active:sync:db": "npm run active:sync -- --sync-db --verify",
    "notification-ui:guard": "node scripts/notification-ui-frontend-guard.mjs"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/modifiers": "^9.0.0",
    "@dnd-kit/sortable": "^10.0.0",
    "@supabase/ssr": "^0.12.0",
    "@supabase/supabase-js": "^2.108.1",
    "docx-preview": "^0.3.6",
    "docxtemplater": "^3.68.7",
    "html2canvas": "^1.4.1",
    "jszip": "^3.10.1",
    "next": "^16.2.6",
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "^5.4.296",
    "pizzip": "^3.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}

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

### docs/change-reports/

- Status: ??

#### Old version preview

```text
[new file or old version unavailable]
```

#### Latest version preview

```text
[binary or unreadable current file]
```

### docs/notification-ui-fbis-canvas.md

- Status: ??

#### Old version preview

```text
[new file or old version unavailable]
```

#### Latest version preview

```text
# Notification UI FBIS Canvas

## Main problem

The notification bell UI was hard to modify because layout, schema assumptions, and error handling were not fully isolated.

## Current visible error

```text
column notifications.recipient_role does not exist
```

## Root cause

The code queried role-wide notifications through `recipient_role`, but some live databases may still have an older `notifications` table without that column.

## Architecture method

### 1. Traceability Canvas

Every notification change must trace to this file, the notification service, the notification UI contract, and the guard.

### 2. Behavior Control ECS

Notification behavior must be predictable:

- Direct user notifications always work through `recipient_user_id`.
- Role-wide notifications are optional.
- If `recipient_role` does not exist, the app must continue with direct notifications.
- Missing optional columns must never break the client workspace.

### 3. Impact Prediction CIG

Changing notification schema can affect:

- Client workspace account rail.
- Manager console account rail.
- Master console account rail.
- Output Activity notifications.
- Generation success notifications.

### 4. Structure Isolation FBIS

Notification UI belongs only to:

```text
components/console/AccountMenu.tsx
components/notifications/NotificationDock.tsx
lib/notifications/*
src/features/notifications/*
scripts/notification-ui-schema-guard.mjs
```

ConsoleShell must not mount NotificationDock directly.

## UI rule

The bell must be compact, docked inside the account rail, and open a bounded popover that does not push page content or break the header layout.

## Verification

```bash
npm run notification-ui:guard
npm run manager-master-lightweight:guard
npm run performance:guard
npm run ui-source:guard
npm run typecheck
npm run build
```

```

### scripts/notification-ui-frontend-guard.mjs

- Status: ??

#### Old version preview

```text
[new file or old version unavailable]
```

#### Latest version preview

```text
#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };

const canvas = read('docs/notification-ui-fbis-canvas.md');
const css = read('app/notification-account-rail.css');
const layout = read('app/layout.tsx');
const accountMenu = read('components/console/AccountMenu.tsx');
const dock = read('components/notifications/NotificationDock.tsx');
const shell = read('components/console/ConsoleShell.tsx');
const service = read('lib/notifications/notification-service.ts');

must(canvas, 'Structure Isolation FBIS', 'notification canvas must document FBIS');
must(layout, "import './notification-account-rail.css';", 'layout must load notification account rail CSS');
must(css, 'order: 1', 'notification bell must be ordered before avatar');
must(css, 'order: 2', 'avatar must be ordered after bell');
must(accountMenu, '<NotificationDock />', 'AccountMenu must own NotificationDock');
must(dock, 'data-notification-dock="true"', 'NotificationDock must keep marker');
must(service, 'missingRoleColumn', 'notification service must tolerate missing recipient_role');
if (shell.includes('<NotificationDock')) failures.push('ConsoleShell must not mount NotificationDock directly');

if (failures.length) {
  console.error(`notification-ui-frontend-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('notification-ui-frontend-guard: ok');

```

### scripts/notification-ui-schema-guard.mjs

- Status: ??

#### Old version preview

```text
[new file or old version unavailable]
```

#### Latest version preview

```text
#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };
const mustNot = (source, marker, label) => { if (source.includes(marker)) failures.push(label); };

const canvas = read('docs/notification-ui-fbis-canvas.md');
const contract = read('src/features/notifications/notification-ui-contract.ts');
const service = read('lib/notifications/notification-service.ts');
const writer = read('lib/notifications/notification-write-service.ts');
const dock = read('components/notifications/NotificationDock.tsx');
const shell = read('components/console/ConsoleShell.tsx');
const accountMenu = read('components/console/AccountMenu.tsx');
const migration = read('supabase/migrations/20260620123000_notifications_recipient_role_safe_schema.sql');

must(canvas, 'Traceability Canvas', 'notification canvas must document traceability');
must(canvas, 'Behavior Control ECS', 'notification canvas must document ECS');
must(canvas, 'Impact Prediction CIG', 'notification canvas must document CIG');
must(canvas, 'Structure Isolation FBIS', 'notification canvas must document FBIS');
must(contract, 'missingRoleColumnFallback', 'notification contract must define missing role column fallback');
must(service, 'missingRoleColumn', 'notification read service must handle missing recipient_role');
must(service, 'roleWide.error && !missingRoleColumn', 'role-wide query error must be optional when recipient_role is missing');
must(writer, 'includeRole', 'notification write service must support role-column fallback');
must(writer, 'lastError?.includes(\'recipient_role\')', 'role-only insert must be non-fatal when role column is absent');
must(dock, 'data-notification-dock="true"', 'NotificationDock must keep ownership marker');
must(dock, '🔔', 'NotificationDock must use bell icon surface');
must(dock, '120_000', 'NotificationDock polling must stay throttled');
must(accountMenu, '<NotificationDock />', 'AccountMenu must own NotificationDock');
mustNot(shell, '<NotificationDock', 'ConsoleShell must not mount NotificationDock directly');
must(migration, 'add column if not exists recipient_role', 'recipient_role migration must be present');
must(migration, "notify pgrst, 'reload schema'", 'migration must reload schema cache');

if (failures.length) {
  console.error(`notification-ui-schema-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('notification-ui-schema-guard: ok');

```

### src/features/notifications/notification-ui-contract.ts

- Status: ??

#### Old version preview

```text
[new file or old version unavailable]
```

#### Latest version preview

```text
export const notificationUiContract = {
  owner: 'src/features/notifications',
  canvas: 'docs/notification-ui-fbis-canvas.md',
  service: 'lib/notifications/notification-service.ts',
  writeService: 'lib/notifications/notification-write-service.ts',
  dock: 'components/notifications/NotificationDock.tsx',
  shellOwner: 'components/console/AccountMenu.tsx',
  guard: 'scripts/notification-ui-schema-guard.mjs',
  behavior: {
    directAudience: 'recipient_user_id',
    optionalRoleAudience: 'recipient_role',
    missingRoleColumnFallback: 'direct-notifications-only',
    popoverLayout: 'absolute-contained-no-content-push'
  }
} as const;

```

### supabase/migrations/20260620123000_notifications_recipient_role_safe_schema.sql

- Status: ??

#### Old version preview

```text
[new file or old version unavailable]
```

#### Latest version preview

```text
alter table public.notifications
  add column if not exists recipient_role text;

alter table public.notifications
  drop constraint if exists notifications_recipient_role_check;

alter table public.notifications
  add constraint notifications_recipient_role_check
  check (recipient_role is null or recipient_role in ('client', 'manager', 'master'));

alter table public.notifications
  drop constraint if exists notifications_has_audience;

alter table public.notifications
  add constraint notifications_has_audience
  check (recipient_user_id is not null or recipient_role is not null);

create index if not exists notifications_recipient_role_created_idx
  on public.notifications (recipient_role, created_at desc);

notify pgrst, 'reload schema';

```

