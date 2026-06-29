import { readDocxStructure, type DocxStructureMap, type DocxParagraphNode } from '../dynamic-template-intelligence';
import type { TemplateDomainKind } from './template-domain-registry';

export type ManagerTemplateBlockKind =
  | 'STATIC_PRESERVE'
  | 'STATIC_OPTIONAL'
  | 'DYNAMIC_FIELD'
  | 'REPEATING_ENTITY_BLOCK'
  | 'ANCHOR_HEADING'
  | 'SUPPORTING_DOCUMENT_SECTION'
  | 'SIGNATURE_SECTION'
  | 'UNKNOWN_MANAGER_CUSTOM_TEXT';

export type ManagerTemplateBlock = {
  blockKey: string;
  kind: ManagerTemplateBlockKind;
  paragraphStart: number;
  paragraphEnd: number;
  sampleText: string;
  confidence: number;
  preserveByDefault: boolean;
  reason: string;
};

export type ManagerTemplateStructureMap = {
  domain: TemplateDomainKind;
  paragraphCount: number;
  tableCount: number;
  bookmarks: string[];
  contentControls: string[];
  blocks: ManagerTemplateBlock[];
  raw: DocxStructureMap;
};

function blockKey(paragraph: DocxParagraphNode, kind: ManagerTemplateBlockKind) {
  return `${kind.toLowerCase()}-${paragraph.index}`;
}

export function classifyParagraphBlock(paragraph: DocxParagraphNode): ManagerTemplateBlock {
  const text = paragraph.text.trim();
  const normalized = paragraph.normalizedText;
  if (!text) {
    return { blockKey: blockKey(paragraph, 'STATIC_OPTIONAL'), kind: 'STATIC_OPTIONAL', paragraphStart: paragraph.index, paragraphEnd: paragraph.index, sampleText: '', confidence: 0.5, preserveByDefault: false, reason: 'Blank paragraph can be removed only if surrounding section policy allows it.' };
  }
  if (/\{\{|\[\[|«/.test(text)) {
    return { blockKey: blockKey(paragraph, 'DYNAMIC_FIELD'), kind: 'DYNAMIC_FIELD', paragraphStart: paragraph.index, paragraphEnd: paragraph.index, sampleText: text, confidence: 0.92, preserveByDefault: true, reason: 'Paragraph contains explicit template placeholder syntax.' };
  }
  if (/FRAUDULENT ACCOUNTS|DISPUTED ACCOUNTS|DISPUTE ACCOUNTS|HARD INQUIRIES|LATE PAYMENTS|ACCOUNT NAME:|ACCOUNT NUMBER:/.test(normalized)) {
    return { blockKey: blockKey(paragraph, 'REPEATING_ENTITY_BLOCK'), kind: 'REPEATING_ENTITY_BLOCK', paragraphStart: paragraph.index, paragraphEnd: paragraph.index, sampleText: text, confidence: 0.86, preserveByDefault: true, reason: 'Paragraph marks or belongs to a repeating dynamic entity zone.' };
  }
  if (/SUPPORTING DOCUMENTS|ENCLOSURES|DOCUMENTS ENCLOSED/.test(normalized)) {
    return { blockKey: blockKey(paragraph, 'SUPPORTING_DOCUMENT_SECTION'), kind: 'SUPPORTING_DOCUMENT_SECTION', paragraphStart: paragraph.index, paragraphEnd: paragraph.index, sampleText: text, confidence: 0.84, preserveByDefault: true, reason: 'Paragraph belongs to supporting-document packet scope.' };
  }
  if (/SINCERELY|RESPECTFULLY|DECLARE UNDER PENALTY|PERJURY|REGARDS/.test(normalized)) {
    return { blockKey: blockKey(paragraph, 'SIGNATURE_SECTION'), kind: 'SIGNATURE_SECTION', paragraphStart: paragraph.index, paragraphEnd: paragraph.index, sampleText: text, confidence: 0.82, preserveByDefault: true, reason: 'Paragraph belongs to signature or perjury declaration area.' };
  }
  if (/RE:|NOTICE|DEMAND|FCRA|605B|611|607\(B\)|IDENTITY THEFT|VICTIM/.test(normalized)) {
    return { blockKey: blockKey(paragraph, 'STATIC_PRESERVE'), kind: 'STATIC_PRESERVE', paragraphStart: paragraph.index, paragraphEnd: paragraph.index, sampleText: text, confidence: 0.78, preserveByDefault: true, reason: 'Important legal/static manager-authored paragraph should be preserved.' };
  }
  return { blockKey: blockKey(paragraph, 'UNKNOWN_MANAGER_CUSTOM_TEXT'), kind: 'UNKNOWN_MANAGER_CUSTOM_TEXT', paragraphStart: paragraph.index, paragraphEnd: paragraph.index, sampleText: text, confidence: 0.66, preserveByDefault: true, reason: 'Unknown manager-authored text is preserved by default until the manager marks it removable.' };
}

export function buildManagerTemplateStructureMap(structure: DocxStructureMap, domain: TemplateDomainKind): ManagerTemplateStructureMap {
  return {
    domain,
    paragraphCount: structure.paragraphCount,
    tableCount: structure.tableCount,
    bookmarks: structure.bookmarks,
    contentControls: structure.contentControls,
    blocks: structure.paragraphs.map(classifyParagraphBlock),
    raw: structure
  };
}

export async function readManagerTemplateStructureMap(input: Blob | ArrayBuffer | Uint8Array | string, domain: TemplateDomainKind) {
  const structure = await readDocxStructure(input);
  return buildManagerTemplateStructureMap(structure, domain);
}
