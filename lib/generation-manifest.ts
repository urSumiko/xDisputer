import type { LetterRoute, LetterType, ParsedSource } from './letter-engine';
import type { LetterReference, Round } from './reference-store';
import type { ExhibitKind, TemplateExhibits } from './template-exhibits';
import { roundTemplateSnapshot } from './round-template-policy';

export type GeneratedOutputManifestItem = {
  id: string;
  path: string;
  type: LetterType;
  role: string;
  bureau: string;
  sequence: number;
  count: number;
};

export type ManifestTemplateSource = 'LOCAL_BROWSER' | 'SUPABASE_TEMPLATE_ASSET' | 'MANAGER_TEMPLATE_ASSET' | 'UNKNOWN';

export type GenerationTemplateManifestItem = {
  slot: string;
  source: ManifestTemplateSource;
  templateScope: string | null;
  managerUserId: string | null;
  uploadedByUserId: string | null;
  assetId: string | null;
  fileName: string;
  templateKind: 'LETTER' | 'EXHIBIT';
  letterType: LetterType | null;
  exhibitKind: ExhibitKind | null;
  versionNumber: number | null;
  contentHash: string | null;
  validationStatus: string | null;
  validationConfidence: number | null;
  missingFields: string[];
  unknownRequiredFields: string[];
  warnings: string[];
};

export type ManifestOutputInput = {
  id?: string;
  path: string;
  type: LetterType;
  role?: string;
  bureau?: string;
  sequence?: number;
  count?: number;
};

export type GenerationManifest = {
  version: '1.2.0';
  generatedAt: string;
  clientName: string;
  sourceHash: string;
  sourceSummary: {
    addressLineCount: number;
    disputeAccountCount: number;
    hardInquiryCount: number;
    latePaymentCount: number;
    customFieldCount: number;
  };
  round: Round;
  routeCount: number;
  bureaus: string[];
  templates: GenerationTemplateManifestItem[];
  managerTemplateProvenance: {
    templateCount: number;
    managerTemplateCount: number;
    localBrowserTemplateCount: number;
    managerUserIds: string[];
    assetIds: string[];
    contentHashes: string[];
  };
  roundPolicy: ReturnType<typeof roundTemplateSnapshot>;
  outputs: GeneratedOutputManifestItem[];
  warnings: string[];
};

type TemplateCarrier = {
  assetId?: string | null;
  source?: ManifestTemplateSource | string;
  versionNumber?: number | null;
  contentHash?: string | null;
  validationJson?: Record<string, unknown> | null;
};

function cleanManifestPart(value: string | undefined, fallback: string) {
  return (value || fallback).replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function stableHash(value: unknown) {
  const text = stableStringify(value);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function safeSource(value: unknown): ManifestTemplateSource {
  return value === 'LOCAL_BROWSER' || value === 'SUPABASE_TEMPLATE_ASSET' || value === 'MANAGER_TEMPLATE_ASSET' || value === 'UNKNOWN'
    ? value
    : 'UNKNOWN';
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

function provenanceFromCarrier(carrier: TemplateCarrier) {
  const validationJson = carrier.validationJson || {};
  return {
    templateScope: stringOrNull(validationJson.templateScope),
    managerUserId: stringOrNull(validationJson.managerUserId),
    uploadedByUserId: stringOrNull(validationJson.uploadedByUserId)
  };
}

function validationFromCarrier(carrier: TemplateCarrier, contract: unknown) {
  const validationJson = carrier.validationJson || {};
  const contractValidation = typeof contract === 'object' && contract && 'validation' in contract
    ? (contract as { validation?: Record<string, unknown> }).validation || {}
    : {};
  const status = validationJson.status || contractValidation.status || null;
  const confidence = validationJson.confidence ?? contractValidation.confidence ?? null;

  return {
    status: typeof status === 'string' ? status : null,
    confidence: typeof confidence === 'number' ? confidence : null,
    missingFields: safeStringArray(validationJson.missingFields || contractValidation.missingFields),
    unknownRequiredFields: safeStringArray(validationJson.unknownRequiredFields || contractValidation.unknownRequiredFields),
    warnings: safeStringArray(validationJson.warnings || contractValidation.warnings)
  };
}

function sourceSummary(parsed: ParsedSource) {
  return {
    addressLineCount: parsed.address.length,
    disputeAccountCount: Object.values(parsed.dispute).reduce((total, items) => total + items.length, 0),
    hardInquiryCount: Object.values(parsed.inquiry).reduce((total, items) => total + items.length, 0),
    latePaymentCount: Object.values(parsed.late).reduce((total, items) => total + items.length, 0),
    customFieldCount: Object.keys(parsed.templateFields || {}).length
  };
}

function sourceHash(parsed: ParsedSource, routes: LetterRoute[]) {
  return stableHash({
    name: parsed.name,
    address: parsed.address,
    dob: parsed.dob,
    ssn: parsed.ssn,
    affidavitState: parsed.affidavitState,
    affidavitCounty: parsed.affidavitCounty,
    templateFields: parsed.templateFields,
    routes: routes.map((route) => ({
      type: route.type,
      bureau: route.bureau,
      reason: route.reason,
      items: route.items.map((item) => item.displayText)
    }))
  });
}

function sourceFromCarrier(carrier: TemplateCarrier) {
  const validationScope = stringOrNull(carrier.validationJson?.templateScope);
  if (validationScope === 'MANAGER_TEMPLATE_ASSET') return 'MANAGER_TEMPLATE_ASSET';
  return safeSource(carrier.source || (carrier.assetId ? 'SUPABASE_TEMPLATE_ASSET' : 'LOCAL_BROWSER'));
}

function letterTemplateManifest(slot: LetterReference): GenerationTemplateManifestItem {
  const carrier = slot as LetterReference & TemplateCarrier;
  const validation = validationFromCarrier(carrier, slot.contract);
  const provenance = provenanceFromCarrier(carrier);
  const source = sourceFromCarrier(carrier);

  return {
    slot: `${slot.round}::LETTER::${slot.type}`,
    source,
    templateScope: provenance.templateScope,
    managerUserId: provenance.managerUserId,
    uploadedByUserId: provenance.uploadedByUserId,
    assetId: carrier.assetId || null,
    fileName: slot.file || slot.name,
    templateKind: 'LETTER',
    letterType: slot.type,
    exhibitKind: null,
    versionNumber: typeof carrier.versionNumber === 'number' ? carrier.versionNumber : null,
    contentHash: carrier.contentHash || null,
    validationStatus: validation.status,
    validationConfidence: validation.confidence,
    missingFields: validation.missingFields,
    unknownRequiredFields: validation.unknownRequiredFields,
    warnings: validation.warnings
  };
}

function exhibitTemplateManifest(kind: ExhibitKind, asset: NonNullable<TemplateExhibits[ExhibitKind]>): GenerationTemplateManifestItem {
  const carrier = asset as NonNullable<TemplateExhibits[ExhibitKind]> & TemplateCarrier;
  const validation = validationFromCarrier(carrier, asset.contract);
  const provenance = provenanceFromCarrier(carrier);
  const source = sourceFromCarrier(carrier);

  return {
    slot: `${kind}::EXHIBIT`,
    source,
    templateScope: provenance.templateScope,
    managerUserId: provenance.managerUserId,
    uploadedByUserId: provenance.uploadedByUserId,
    assetId: carrier.assetId || (asset.id.startsWith('template-exhibit/') ? null : asset.id),
    fileName: asset.name,
    templateKind: 'EXHIBIT',
    letterType: null,
    exhibitKind: kind,
    versionNumber: typeof carrier.versionNumber === 'number' ? carrier.versionNumber : null,
    contentHash: carrier.contentHash || null,
    validationStatus: validation.status,
    validationConfidence: validation.confidence,
    missingFields: validation.missingFields,
    unknownRequiredFields: validation.unknownRequiredFields,
    warnings: validation.warnings
  };
}

function templateManifestItems(input: { references: LetterReference[]; templates: TemplateExhibits }) {
  const letters = input.references.filter((slot) => Boolean(slot.file)).map(letterTemplateManifest);
  const exhibits = (Object.entries(input.templates) as Array<[ExhibitKind, TemplateExhibits[ExhibitKind]]>).filter(([, asset]) => Boolean(asset)).map(([kind, asset]) => exhibitTemplateManifest(kind, asset!));
  return [...letters, ...exhibits];
}

function managerTemplateProvenance(templates: GenerationTemplateManifestItem[]): GenerationManifest['managerTemplateProvenance'] {
  const managerTemplates = templates.filter((template) => template.source === 'MANAGER_TEMPLATE_ASSET' || template.templateScope === 'MANAGER_TEMPLATE_ASSET');
  return {
    templateCount: templates.length,
    managerTemplateCount: managerTemplates.length,
    localBrowserTemplateCount: templates.filter((template) => template.source === 'LOCAL_BROWSER').length,
    managerUserIds: Array.from(new Set(managerTemplates.map((template) => template.managerUserId).filter((value): value is string => Boolean(value)))),
    assetIds: Array.from(new Set(managerTemplates.map((template) => template.assetId).filter((value): value is string => Boolean(value)))),
    contentHashes: Array.from(new Set(managerTemplates.map((template) => template.contentHash).filter((value): value is string => Boolean(value))))
  };
}

export function normalizeGeneratedOutputForManifest(item: ManifestOutputInput, index: number): GeneratedOutputManifestItem {
  const sequence = typeof item.sequence === 'number' && Number.isFinite(item.sequence) ? item.sequence : index + 1;
  const role = item.role || 'OUTPUT';
  const bureau = item.bureau || 'CLIENT';
  return { id: item.id || `${cleanManifestPart(item.type, 'TYPE')}-${cleanManifestPart(bureau, 'CLIENT')}-${cleanManifestPart(role, 'OUTPUT')}-${sequence}`, path: item.path, type: item.type, role, bureau, sequence, count: typeof item.count === 'number' && Number.isFinite(item.count) ? item.count : 0 };
}

export function buildGenerationManifest(input: { round: Round; parsed: ParsedSource; routes: LetterRoute[]; references: LetterReference[]; templates: TemplateExhibits; outputs: GeneratedOutputManifestItem[]; warnings: string[] }): GenerationManifest {
  const templates = templateManifestItems({ references: input.references, templates: input.templates });
  return {
    version: '1.2.0',
    generatedAt: new Date().toISOString(),
    clientName: input.parsed.name || 'Unknown client',
    sourceHash: sourceHash(input.parsed, input.routes),
    sourceSummary: sourceSummary(input.parsed),
    round: input.round,
    routeCount: input.routes.length,
    bureaus: Array.from(new Set(input.routes.map((route) => route.bureau))),
    templates,
    managerTemplateProvenance: managerTemplateProvenance(templates),
    roundPolicy: roundTemplateSnapshot({ round: input.round, routes: input.routes, references: input.references, templates: input.templates }),
    outputs: input.outputs,
    warnings: input.warnings
  };
}

export function generationManifestText(manifest: GenerationManifest) {
  return [
    'GENERATION MANIFEST',
    `Version: ${manifest.version}`,
    `Generated At: ${manifest.generatedAt}`,
    `Client: ${manifest.clientName}`,
    `Source Hash: ${manifest.sourceHash}`,
    `Round: ${manifest.round}`,
    `Routes: ${manifest.routeCount}`,
    `Bureaus: ${manifest.bureaus.join(', ') || 'None'}`,
    `Manager Template Count: ${manifest.managerTemplateProvenance.managerTemplateCount}/${manifest.managerTemplateProvenance.templateCount}`,
    `Manager Template IDs: ${manifest.managerTemplateProvenance.assetIds.join(', ') || 'None'}`,
    '',
    JSON.stringify(manifest, null, 2)
  ].join('\n');
}
