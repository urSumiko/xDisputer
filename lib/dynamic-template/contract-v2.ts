import PizZip from 'pizzip';
import type { TemplateDocumentKind } from '../template-contracts';
import {
  dynamicFieldDefinition,
  isEditableDocxTemplateKind,
  isStaticPdfTemplateKind,
  profileForDocumentKind,
  resolveDynamicField,
  type DynamicCanonicalFieldKey,
  type DynamicTemplateRenderIntent
} from './field-registry';

export type DynamicTemplateOccurrenceLocation = 'BODY' | 'HEADER' | 'FOOTER' | 'TABLE_ROW' | 'TABLE_CELL' | 'UNKNOWN';
export type DynamicTemplateContractStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'STATIC';

export type DynamicTemplateFieldOccurrence = {
  canonicalKey: DynamicCanonicalFieldKey;
  alias: string;
  normalizedAlias: string;
  partName: string;
  location: DynamicTemplateOccurrenceLocation;
  occurrenceIndex: number;
  renderIntent: DynamicTemplateRenderIntent;
  insideTable: boolean;
  insideTableRow: boolean;
  tableRowIndex?: number;
  preserveStyle: true;
};

export type DynamicTemplateRepeatBlock = {
  canonicalKey: DynamicCanonicalFieldKey;
  alias: string;
  partName: string;
  location: DynamicTemplateOccurrenceLocation;
  blockType: 'EXPLICIT_BLOCK' | 'TABLE_ROW_PROTOTYPE' | 'IMPLICIT_PLACEHOLDER';
  renderIntent: DynamicTemplateRenderIntent;
  tableRowIndex?: number;
  preservePrototypeStyle: true;
};

export type DynamicTemplateUnknownPlaceholder = {
  alias: string;
  normalizedAlias: string;
  partName: string;
  location: DynamicTemplateOccurrenceLocation;
  required: boolean;
};

export type DynamicTemplateUnsupportedZone = {
  partName: string;
  zone: 'TEXT_BOX' | 'DRAWING' | 'ALT_CHUNK' | 'CONTENT_CONTROL' | 'UNKNOWN';
  requiredFieldAliases: string[];
  warning: string;
};

export type DynamicTemplateContractV2 = {
  version: 2;
  kind: TemplateDocumentKind;
  roundLabel?: string | null;
  editableDocx: boolean;
  staticPdf: boolean;
  packetRole: string;
  status: DynamicTemplateContractStatus;
  confidence: number;
  requiredFields: DynamicCanonicalFieldKey[];
  optionalFields: DynamicCanonicalFieldKey[];
  fulfilledFields: DynamicCanonicalFieldKey[];
  missingFields: DynamicCanonicalFieldKey[];
  fieldOccurrences: DynamicTemplateFieldOccurrence[];
  repeatBlocks: DynamicTemplateRepeatBlock[];
  unknownPlaceholders: DynamicTemplateUnknownPlaceholder[];
  unsupportedZones: DynamicTemplateUnsupportedZone[];
  warnings: string[];
  errors: string[];
  diagnostics: {
    xmlPartsScanned: string[];
    placeholderCount: number;
    canonicalFieldCount: number;
    unknownPlaceholderCount: number;
    repeatBlockCount: number;
    tableRowPrototypeCount: number;
    headerFooterFieldCount: number;
    editableDocxPacketComponents: TemplateDocumentKind[];
    staticPdfPacketComponents: TemplateDocumentKind[];
  };
};

type XmlPart = {
  name: string;
  xml: string;
  location: DynamicTemplateOccurrenceLocation;
};

const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}|\[\[\s*([^\[\]]+?)\s*\]\]|«\s*([^«»]+?)\s*»/g;
const XML_PART_PATTERN = /^word\/(?:document|header\d+|footer\d+)\.xml$/i;
const TABLE_ROW_PATTERN = /<w:tr[\s\S]*?<\/w:tr>/gi;

function partLocation(name: string): DynamicTemplateOccurrenceLocation {
  if (/\/header\d+\.xml$/i.test(name)) return 'HEADER';
  if (/\/footer\d+\.xml$/i.test(name)) return 'FOOTER';
  if (/\/document\.xml$/i.test(name)) return 'BODY';
  return 'UNKNOWN';
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXmlTags(value: string) {
  return decodeXmlText(value.replace(/<[^>]+>/g, ''));
}

function isBlockStart(alias: string) {
  return /^#/.test(alias.trim()) || /^each\./i.test(alias.trim());
}

function isBlockEnd(alias: string) {
  return /^\//.test(alias.trim());
}

function rowHasPlaceholder(xml: string) {
  return PLACEHOLDER_PATTERN.test(stripXmlTags(xml));
}

function collectXmlParts(zip: PizZip): XmlPart[] {
  return Object.keys(zip.files)
    .filter((name) => XML_PART_PATTERN.test(name))
    .map((name) => ({
      name,
      xml: zip.file(name)?.asText() || '',
      location: partLocation(name)
    }))
    .filter((part) => part.xml.trim().length > 0);
}

function findLocationForIndex(xml: string, index: number, baseLocation: DynamicTemplateOccurrenceLocation): {
  location: DynamicTemplateOccurrenceLocation;
  insideTable: boolean;
  insideTableRow: boolean;
  tableRowIndex?: number;
} {
  const before = xml.slice(0, index);
  const after = xml.slice(index);
  const openTable = before.lastIndexOf('<w:tbl');
  const closeTable = before.lastIndexOf('</w:tbl>');
  const openRow = before.lastIndexOf('<w:tr');
  const closeRow = before.lastIndexOf('</w:tr>');
  const closeRowAfter = after.indexOf('</w:tr>');
  const insideTable = openTable > closeTable;
  const insideTableRow = insideTable && openRow > closeRow && closeRowAfter >= 0;

  if (!insideTable) return { location: baseLocation, insideTable: false, insideTableRow: false };

  const tableRowIndex = (before.match(/<w:tr\b/gi) || []).length;

  return {
    location: insideTableRow ? 'TABLE_ROW' : 'TABLE_CELL',
    insideTable,
    insideTableRow,
    tableRowIndex
  };
}

function detectUnsupportedZones(part: XmlPart, aliasesInPart: string[]): DynamicTemplateUnsupportedZone[] {
  const zones: DynamicTemplateUnsupportedZone[] = [];
  const checks: Array<[DynamicTemplateUnsupportedZone['zone'], RegExp, string]> = [
    ['TEXT_BOX', /<w:txbxContent\b/i, 'Template contains text-box content. Required placeholders inside text boxes may not preserve layout until renderer-v2 supports them.'],
    ['DRAWING', /<w:drawing\b/i, 'Template contains drawing content. Required placeholders inside drawings may not preserve layout until renderer-v2 supports them.'],
    ['ALT_CHUNK', /<w:altChunk\b/i, 'Template contains altChunk content. Dynamic placeholders inside altChunk are unsupported.'],
    ['CONTENT_CONTROL', /<w:sdt\b/i, 'Template contains content controls. Renderer-v2 must preserve them when replacing nested placeholders.']
  ];

  for (const [zone, pattern, warning] of checks) {
    if (pattern.test(part.xml)) zones.push({ partName: part.name, zone, requiredFieldAliases: aliasesInPart, warning });
  }

  return zones;
}

function tokenFromMatch(match: RegExpExecArray) {
  return String(match[1] || match[2] || match[3] || '').trim();
}

function fieldKeys(values: DynamicTemplateFieldOccurrence[]) {
  return Array.from(new Set(values.map((item) => item.canonicalKey)));
}

function confidenceFor(input: {
  requiredFields: DynamicCanonicalFieldKey[];
  missingFields: DynamicCanonicalFieldKey[];
  unknownRequiredCount: number;
  unsupportedZoneCount: number;
}) {
  if (!input.requiredFields.length) return input.unknownRequiredCount || input.unsupportedZoneCount ? 0.75 : 1;
  const fulfilled = input.requiredFields.length - input.missingFields.length;
  const base = Math.max(0, fulfilled / input.requiredFields.length);
  const penalty = Math.min(0.35, (input.unknownRequiredCount * 0.08) + (input.unsupportedZoneCount * 0.05));
  return Number(Math.max(0, base - penalty).toFixed(2));
}

export async function inspectDynamicTemplateContractV2(file: File, kind: TemplateDocumentKind, roundLabel?: string | null): Promise<DynamicTemplateContractV2> {
  const profile = profileForDocumentKind(kind);

  if (isStaticPdfTemplateKind(kind)) {
    return {
      version: 2,
      kind,
      roundLabel,
      editableDocx: false,
      staticPdf: true,
      packetRole: profile.packetRole,
      status: 'STATIC',
      confidence: 1,
      requiredFields: [],
      optionalFields: [],
      fulfilledFields: [],
      missingFields: [],
      fieldOccurrences: [],
      repeatBlocks: [],
      unknownPlaceholders: [],
      unsupportedZones: [],
      warnings: profile.warningRules,
      errors: [],
      diagnostics: {
        xmlPartsScanned: [],
        placeholderCount: 0,
        canonicalFieldCount: 0,
        unknownPlaceholderCount: 0,
        repeatBlockCount: 0,
        tableRowPrototypeCount: 0,
        headerFooterFieldCount: 0,
        editableDocxPacketComponents: ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER', 'AFFIDAVIT', 'FTC'],
        staticPdfPacketComponents: ['FCRA', 'ATTACHMENT']
      }
    };
  }

  if (!isEditableDocxTemplateKind(kind)) {
    throw new Error(`${kind} is not configured as an editable DOCX template kind.`);
  }

  const buffer = await file.arrayBuffer();
  const zip = new PizZip(buffer);
  const parts = collectXmlParts(zip);
  const fieldOccurrences: DynamicTemplateFieldOccurrence[] = [];
  const repeatBlocks: DynamicTemplateRepeatBlock[] = [];
  const unknownPlaceholders: DynamicTemplateUnknownPlaceholder[] = [];
  const unsupportedZones: DynamicTemplateUnsupportedZone[] = [];
  const aliasesByPart = new Map<string, string[]>();

  let occurrenceIndex = 0;

  for (const part of parts) {
    const partAliases: string[] = [];
    const text = stripXmlTags(part.xml);
    const matches = Array.from(text.matchAll(PLACEHOLDER_PATTERN));

    for (const match of matches) {
      const alias = tokenFromMatch(match);
      if (!alias || isBlockEnd(alias)) continue;

      partAliases.push(alias);
      const resolved = resolveDynamicField(alias);
      const locationInfo = findLocationForIndex(part.xml, Math.max(0, part.xml.indexOf(match[0])), part.location);

      if (!resolved) {
        unknownPlaceholders.push({
          alias,
          normalizedAlias: alias.toLowerCase().replace(/\s+/g, '_'),
          partName: part.name,
          location: locationInfo.location,
          required: !/^optional\./i.test(alias)
        });
        continue;
      }

      const definition = resolved.definition;
      const occurrence: DynamicTemplateFieldOccurrence = {
        canonicalKey: resolved.canonicalKey,
        alias,
        normalizedAlias: resolved.normalizedAlias,
        partName: part.name,
        location: locationInfo.location,
        occurrenceIndex: occurrenceIndex++,
        renderIntent: definition.renderIntent,
        insideTable: locationInfo.insideTable,
        insideTableRow: locationInfo.insideTableRow,
        tableRowIndex: locationInfo.tableRowIndex,
        preserveStyle: true
      };

      fieldOccurrences.push(occurrence);

      if (definition.kind === 'REPEATING_BLOCK') {
        repeatBlocks.push({
          canonicalKey: resolved.canonicalKey,
          alias,
          partName: part.name,
          location: locationInfo.location,
          blockType: isBlockStart(alias) ? 'EXPLICIT_BLOCK' : locationInfo.insideTableRow ? 'TABLE_ROW_PROTOTYPE' : 'IMPLICIT_PLACEHOLDER',
          renderIntent: locationInfo.insideTableRow ? 'CLONE_TABLE_ROW' : definition.renderIntent,
          tableRowIndex: locationInfo.tableRowIndex,
          preservePrototypeStyle: true
        });
      }
    }

    aliasesByPart.set(part.name, partAliases);

    const rows = Array.from(part.xml.matchAll(TABLE_ROW_PATTERN));
    rows.forEach((row, index) => {
      PLACEHOLDER_PATTERN.lastIndex = 0;
      if (!rowHasPlaceholder(row[0])) return;
      const rowText = stripXmlTags(row[0]);
      const rowMatches = Array.from(rowText.matchAll(PLACEHOLDER_PATTERN));

      rowMatches.forEach((match) => {
        const alias = tokenFromMatch(match);
        const resolved = resolveDynamicField(alias);
        if (!resolved) return;
        const definition = dynamicFieldDefinition(resolved.canonicalKey);
        if (definition?.kind !== 'REPEATING_BLOCK') return;
        if (repeatBlocks.some((block) => block.partName === part.name && block.canonicalKey === resolved.canonicalKey && block.tableRowIndex === index + 1)) return;
        repeatBlocks.push({
          canonicalKey: resolved.canonicalKey,
          alias,
          partName: part.name,
          location: 'TABLE_ROW',
          blockType: 'TABLE_ROW_PROTOTYPE',
          renderIntent: 'CLONE_TABLE_ROW',
          tableRowIndex: index + 1,
          preservePrototypeStyle: true
        });
      });
    });
  }

  for (const part of parts) unsupportedZones.push(...detectUnsupportedZones(part, aliasesByPart.get(part.name) || []));

  const fulfilledFields = fieldKeys(fieldOccurrences);
  const missingFields = profile.requiredFields.filter((field) => !fulfilledFields.includes(field));
  const unknownRequired = unknownPlaceholders.filter((item) => item.required);
  const warnings: string[] = [...profile.warningRules];
  const errors: string[] = [];

  if (roundLabel && /final/i.test(stripXmlTags(parts.map((part) => part.xml).join('\n'))) && !/final/i.test(roundLabel)) {
    warnings.push(`Template text appears to mention Final Round while being used for ${roundLabel}. This is allowed only if the canonical contract passes.`);
  }

  if (missingFields.length) errors.push(`Missing required canonical field(s): ${missingFields.join(', ')}.`);
  if (unknownRequired.length) warnings.push(`Unknown required placeholder(s) need mapping before renderer-v2 can guarantee output: ${unknownRequired.map((item) => item.alias).join(', ')}.`);
  if (unsupportedZones.length) warnings.push('Template contains advanced DOCX zones that renderer-v2 must treat carefully: ' + Array.from(new Set(unsupportedZones.map((item) => item.zone))).join(', ') + '.');

  const status: DynamicTemplateContractStatus = missingFields.length ? 'BLOCKED' : warnings.length || unknownRequired.length || unsupportedZones.length ? 'WARNING' : 'READY';

  return {
    version: 2,
    kind,
    roundLabel,
    editableDocx: true,
    staticPdf: false,
    packetRole: profile.packetRole,
    status,
    confidence: confidenceFor({ requiredFields: profile.requiredFields, missingFields, unknownRequiredCount: unknownRequired.length, unsupportedZoneCount: unsupportedZones.length }),
    requiredFields: profile.requiredFields,
    optionalFields: profile.optionalFields,
    fulfilledFields,
    missingFields,
    fieldOccurrences,
    repeatBlocks,
    unknownPlaceholders,
    unsupportedZones,
    warnings,
    errors,
    diagnostics: {
      xmlPartsScanned: parts.map((part) => part.name),
      placeholderCount: fieldOccurrences.length + unknownPlaceholders.length,
      canonicalFieldCount: fulfilledFields.length,
      unknownPlaceholderCount: unknownPlaceholders.length,
      repeatBlockCount: repeatBlocks.length,
      tableRowPrototypeCount: repeatBlocks.filter((block) => block.blockType === 'TABLE_ROW_PROTOTYPE').length,
      headerFooterFieldCount: fieldOccurrences.filter((item) => item.location === 'HEADER' || item.location === 'FOOTER').length,
      editableDocxPacketComponents: ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER', 'AFFIDAVIT', 'FTC'],
      staticPdfPacketComponents: ['FCRA', 'ATTACHMENT']
    }
  };
}

export function dynamicTemplateContractV2Summary(contract: DynamicTemplateContractV2) {
  return {
    version: contract.version,
    kind: contract.kind,
    status: contract.status,
    confidence: contract.confidence,
    editableDocx: contract.editableDocx,
    staticPdf: contract.staticPdf,
    requiredFields: contract.requiredFields,
    fulfilledFields: contract.fulfilledFields,
    missingFields: contract.missingFields,
    repeatBlocks: contract.repeatBlocks.map((block) => ({
      canonicalKey: block.canonicalKey,
      blockType: block.blockType,
      renderIntent: block.renderIntent,
      location: block.location,
      tableRowIndex: block.tableRowIndex || null
    })),
    unknownPlaceholders: contract.unknownPlaceholders,
    warnings: contract.warnings,
    errors: contract.errors,
    diagnostics: contract.diagnostics
  };
}
