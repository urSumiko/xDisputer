import { inspectTemplateContract, type TemplateContract } from './template-contracts';

export type ExhibitKind = 'FCRA' | 'AFFIDAVIT' | 'ATTACHMENT' | 'FTC';
export type ActiveExhibitKind = Exclude<ExhibitKind, 'FTC'>;
export type ExhibitMode = 'STATIC_PDF' | 'GENERATED_DOCX';
export type TemplateAssetProvenanceSource = 'LOCAL_BROWSER' | 'SUPABASE_TEMPLATE_ASSET' | 'UNKNOWN';
export type TemplateAssetProvenanceMetadata = { assetId?: string | null; source?: TemplateAssetProvenanceSource | string; versionNumber?: number | null; contentHash?: string | null; validationJson?: Record<string, unknown> | null; };
export type ExhibitAsset = TemplateAssetProvenanceMetadata & { id: string; kind: ExhibitKind; mode: ExhibitMode; name: string; type: string; size: number; contract?: TemplateContract; };
export type TemplateExhibits = Record<ExhibitKind, ExhibitAsset | null>;

const DB_NAME = 'lettergenerator-private-templates';
const STORE_NAME = 'files';
const META_PREFIX = 'lettergenerator.template-exhibits.v2.';
const LEGACY_PREFIX = 'lettergenerator.template-exhibits.v1.';
export const exhibitKinds: ActiveExhibitKind[] = ['FCRA', 'AFFIDAVIT', 'ATTACHMENT'];
export const exhibitModes: Record<ExhibitKind, ExhibitMode> = { FCRA: 'STATIC_PDF', AFFIDAVIT: 'GENERATED_DOCX', ATTACHMENT: 'STATIC_PDF', FTC: 'GENERATED_DOCX' };
export const exhibitTitles: Record<ExhibitKind, string> = { FCRA: 'FCRA Legal Exhibit', AFFIDAVIT: 'Affidavit', ATTACHMENT: 'Attachment', FTC: 'Inactive packet template' };
export const exhibitAccept: Record<ExhibitKind, string> = { FCRA: '.pdf,application/pdf', AFFIDAVIT: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', ATTACHMENT: '.pdf,application/pdf', FTC: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

function emptyTemplates(): TemplateExhibits { return { FCRA: null, AFFIDAVIT: null, ATTACHMENT: null, FTC: null }; }
function fileKey(round: string, kind: ExhibitKind) { return `template-exhibit/${round}/${kind}`; }
function metaKey(round: string) { return `${META_PREFIX}${round}`; }
function legacyMetaKey(round: string) { return `${LEGACY_PREFIX}${round}`; }
function normalizeAsset(kind: ExhibitKind, asset: ExhibitAsset | null | undefined): ExhibitAsset | null { return asset ? { ...asset, kind, mode: exhibitModes[kind] } : null; }
function saveTemplateMeta(round: string, exhibits: TemplateExhibits) { if (typeof window !== 'undefined') localStorage.setItem(metaKey(round), JSON.stringify(exhibits)); }
function cloudExhibitUrl(round: string, kind: ExhibitKind) { const params = new URLSearchParams({ round, templateKind: 'EXHIBIT', exhibitKind: kind, sync: String(Date.now()) }); return `/api/template-assets/file?${params.toString()}`; }
function responseFileName(response: Response, kind: ExhibitKind) { const headerName = response.headers.get('x-template-file-name') || ''; const disposition = response.headers.get('content-disposition') || ''; const dispositionName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || ''; return (headerName || dispositionName || `${exhibitTitles[kind]}.${exhibitModes[kind] === 'STATIC_PDF' ? 'pdf' : 'docx'}`).replace(/[\/:*?"<>|]+/g, ' ').trim(); }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function configuredExhibits(exhibits: TemplateExhibits) {
  return exhibitKinds.filter((kind) => Boolean(exhibits[kind]));
}

export function loadTemplateExhibits(round: string): TemplateExhibits {
  if (typeof window === 'undefined') return emptyTemplates();
  try {
    const raw = localStorage.getItem(metaKey(round)) || localStorage.getItem(legacyMetaKey(round));
    if (!raw) return emptyTemplates();
    const data = JSON.parse(raw) as Partial<TemplateExhibits>;
    return { FCRA: normalizeAsset('FCRA', data.FCRA), AFFIDAVIT: normalizeAsset('AFFIDAVIT', data.AFFIDAVIT), ATTACHMENT: normalizeAsset('ATTACHMENT', data.ATTACHMENT), FTC: null };
  } catch { return emptyTemplates(); }
}

function assertFileType(kind: ExhibitKind, file: File) {
  if (kind === 'FTC') throw new Error('This packet template type is inactive.');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(file.name);
  if (exhibitModes[kind] === 'STATIC_PDF' && !isPdf) throw new Error(`${exhibitTitles[kind]} accepts PDF files only.`);
  if (exhibitModes[kind] === 'GENERATED_DOCX' && !isDocx) throw new Error(`${exhibitTitles[kind]} accepts DOCX template files only.`);
}

async function readStoredExhibit(round: string, kind: ExhibitKind): Promise<File | null> {
  if (kind === 'FTC') return null;
  const db = await openDb();
  const file = await new Promise<File | null>((resolve, reject) => { const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(fileKey(round, kind)); request.onsuccess = () => resolve((request.result as File | undefined) || null); request.onerror = () => reject(request.error); });
  db.close();
  return file;
}

async function writeStoredExhibit(round: string, kind: ExhibitKind, file: File) {
  if (kind === 'FTC') throw new Error('This packet template type is inactive.');
  const db = await openDb();
  await new Promise<void>((resolve, reject) => { const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(file, fileKey(round, kind)); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  db.close();
}

async function readCloudExhibit(round: string, kind: ExhibitKind): Promise<File | null> {
  if (kind === 'FTC' || typeof window === 'undefined' || typeof fetch !== 'function') return null;
  const response = await fetch(cloudExhibitUrl(round, kind), { cache: 'no-store', headers: { accept: exhibitModes[kind] === 'STATIC_PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'cache-control': 'no-store' } });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (!blob.size) return null;
  const file = new File([blob], responseFileName(response, kind), { type: blob.type || response.headers.get('content-type') || 'application/octet-stream', lastModified: Date.now() });
  await writeStoredExhibit(round, kind, file).catch(() => undefined);
  return file;
}

async function assetFromStoredFile(round: string, kind: ExhibitKind, file: File, existing?: ExhibitAsset | null): Promise<ExhibitAsset> {
  const contract = existing?.contract || (exhibitModes[kind] === 'GENERATED_DOCX' ? await inspectTemplateContract(file, kind as any).catch(() => existing?.contract) : existing?.contract);
  return { id: fileKey(round, kind), kind, mode: exhibitModes[kind], name: existing?.name || file.name, type: existing?.type || file.type || 'application/octet-stream', size: existing?.size || file.size, contract, assetId: existing?.assetId, source: existing?.source, versionNumber: existing?.versionNumber, contentHash: existing?.contentHash, validationJson: existing?.validationJson };
}

export async function recoverTemplateExhibitsFromFiles(round: string, values: TemplateExhibits = loadTemplateExhibits(round)) {
  if (typeof window === 'undefined') return emptyTemplates();
  const recovered = { ...emptyTemplates(), ...values, FTC: null } as TemplateExhibits;
  let changed = false;
  for (const kind of exhibitKinds) {
    const cloud = await readCloudExhibit(round, kind).catch(() => null);
    const file = cloud || await readStoredExhibit(round, kind).catch(() => null);
    if (!file) {
      if (recovered[kind] && recovered[kind]?.source === 'LOCAL_BROWSER') { recovered[kind] = null; changed = true; }
      continue;
    }
    if (!recovered[kind] || recovered[kind]?.name !== file.name || recovered[kind]?.size !== file.size || cloud) {
      recovered[kind] = await assetFromStoredFile(round, kind, file, cloud ? { ...recovered[kind], name: file.name, type: file.type, size: file.size, source: 'SUPABASE_TEMPLATE_ASSET' } as ExhibitAsset : recovered[kind]);
      changed = true;
    }
  }
  if (values.FTC) { recovered.FTC = null; changed = true; }
  if (changed) saveTemplateMeta(round, recovered);
  return recovered;
}
export async function recoverAllTemplateExhibitsFromFiles(rounds: string[]) { const entries = await Promise.all(rounds.map(async (round) => [round, await recoverTemplateExhibitsFromFiles(round)] as const)); return Object.fromEntries(entries); }
export async function saveTemplateExhibit(round: string, kind: ExhibitKind, file: File) { assertFileType(kind, file); await writeStoredExhibit(round, kind, file); const current = loadTemplateExhibits(round); const next = { ...current, [kind]: await assetFromStoredFile(round, kind, file, current[kind]), FTC: null } as TemplateExhibits; saveTemplateMeta(round, next); return next; }
export async function removeTemplateExhibit(round: string, kind: ExhibitKind) { if (kind === 'FTC') return loadTemplateExhibits(round); const db = await openDb(); await new Promise<void>((resolve, reject) => { const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(fileKey(round, kind)); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); db.close(); const current = loadTemplateExhibits(round); const next = { ...current, [kind]: null, FTC: null } as TemplateExhibits; saveTemplateMeta(round, next); return next; }
export async function readTemplateExhibit(round: string, kind: ExhibitKind) { if (kind === 'FTC') return null; const cloud = await readCloudExhibit(round, kind).catch(() => null); if (cloud) return cloud; return readStoredExhibit(round, kind); }
