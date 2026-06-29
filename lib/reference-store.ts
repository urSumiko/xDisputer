import type { LetterType } from './letter-engine';
import { inspectTemplateContract, type TemplateContract } from './template-contracts';

export type Round = '1st Round' | '2nd Round' | '3rd Round' | 'Final';
export type TemplateAssetProvenanceSource = 'LOCAL_BROWSER' | 'SUPABASE_TEMPLATE_ASSET' | 'UNKNOWN';
export type TemplateAssetProvenanceMetadata = {
  assetId?: string | null;
  source?: TemplateAssetProvenanceSource | string;
  versionNumber?: number | null;
  contentHash?: string | null;
  validationJson?: Record<string, unknown> | null;
};
export type LetterReference = TemplateAssetProvenanceMetadata & { id: string; round: Round; type: LetterType; name: string; file: string; size?: number; contract?: TemplateContract };

const DB_NAME = 'lettergenerator-private-templates';
const STORE_NAME = 'files';
const META_KEY = 'lettergenerator.references.v15';
export const rounds: Round[] = ['1st Round', '2nd Round', '3rd Round', 'Final'];

export function defaultReferences(): LetterReference[] {
  return rounds.flatMap((round, index) => {
    const prefix = index ? `r${index + 1}-` : '';
    return [
      { id: `${prefix}dispute-letter`, round, type: 'DISPUTE', name: `${round} Dispute Letter`, file: '' },
      { id: `${prefix}late-letter`, round, type: 'LATE_PAYMENT', name: `${round} Late Payment Letter`, file: '' }
    ];
  });
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export function loadReferenceMeta() {
  if (typeof window === 'undefined') return defaultReferences();

  try {
    const raw = localStorage.getItem(META_KEY) || localStorage.getItem('lettergenerator.visual-reference-output.v13');
    const values = raw ? JSON.parse(raw) as LetterReference[] : [];
    const saved = Array.isArray(values) ? values : [];

    return defaultReferences().map((slot) => ({
      ...slot,
      ...(saved.find((value) => value.id === slot.id) || {})
    }));
  } catch {
    return defaultReferences();
  }
}

export function saveReferenceMeta(values: LetterReference[]) {
  if (typeof window === 'undefined') return;

  let existing: LetterReference[] = [];

  try {
    const raw = localStorage.getItem(META_KEY) || localStorage.getItem('lettergenerator.visual-reference-output.v13');
    const parsed = raw ? JSON.parse(raw) as LetterReference[] : [];
    existing = Array.isArray(parsed) ? parsed : [];
  } catch {
    existing = [];
  }

  const incoming = Array.isArray(values) ? values : [];
  const byId = new Map<string, LetterReference>();

  /*
    All-round persistence contract:
    - every slot is keyed by id, not by active round
    - saving one slot cannot erase another round's slot
    - each round keeps its own file name, size, and placeholder contract
  */
  for (const slot of defaultReferences()) byId.set(slot.id, slot);
  for (const slot of existing) if (slot?.id) byId.set(slot.id, { ...(byId.get(slot.id) || slot), ...slot });
  for (const slot of incoming) if (slot?.id) byId.set(slot.id, { ...(byId.get(slot.id) || slot), ...slot });

  const merged = defaultReferences().map((slot) => byId.get(slot.id) || slot);
  localStorage.setItem(META_KEY, JSON.stringify(merged));
}

export async function recoverReferenceMetaFromFiles(values: LetterReference[] = loadReferenceMeta()) {
  if (typeof window === 'undefined') return defaultReferences();

  const base = defaultReferences().map((slot) => ({
    ...slot,
    ...(values.find((value) => value.id === slot.id) || {})
  }));

  const recovered = await Promise.all(base.map(async (slot) => {
    const file = await readReferenceFile(slot.id).catch(() => null);

    if (!file) return slot;

    if (slot.file === file.name && slot.size === file.size) return slot;

    const contract = await inspectTemplateContract(file, slot.type === 'LATE_PAYMENT' ? 'LATE_PAYMENT_LETTER' : 'DISPUTE_LETTER').catch(() => slot.contract);
    return { ...slot, file: file.name, size: file.size, contract };
  }));

  saveReferenceMeta(recovered);
  return recovered;
}
export async function saveReferenceFile(slot: LetterReference, file: File) {
  if (!/\.docx$/i.test(file.name)) throw new Error('Reference templates must be DOCX files.');
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(file, slot.id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
  return inspectTemplateContract(file, slot.type === 'LATE_PAYMENT' ? 'LATE_PAYMENT_LETTER' : 'DISPUTE_LETTER');
}
export async function readReferenceFile(id: string) {
  const db = await openDb();
  const file = await new Promise<File | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as File | undefined) || null);
    request.onerror = () => reject(request.error);
  });
  db.close(); return file;
}
export async function removeReferenceFile(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}
