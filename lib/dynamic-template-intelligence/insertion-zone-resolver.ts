import { anchorPolicy, type TemplateAnchorKind } from './anchor-alias-registry';
import type { DocxStructureMap } from './docx-structure-reader';
import type { DetectedAnchor } from './semantic-section-detector';
import type { TemplateInsertionMode } from './template-rule-store';

export type InsertionZone = {
  anchorKind: TemplateAnchorKind;
  startParagraphIndex: number;
  endParagraphIndex: number | null;
  insertMode: TemplateInsertionMode;
  confidence: number;
  requiresManagerReview: boolean;
  reason: string;
};

const NEXT_SECTION_HINT = /^(?:LEGAL\s+DEMAND|NOTICE\s+OF\s+DUTY|REQUIRED\s+ACTIONS|SUPPORTING\s+DOCUMENTS|SINCERELY|RESPECTFULLY|CC:|NOTICE\s+OF\s+LIABILITY|FAILURE\s+TO\s+COMPLY|HARD\s+INQUIRIES|LATE\s+PAYMENTS)/i;
const ACCOUNT_ITEM_HINT = /^(?:Account|Creditor)\s+Name\s*:|^Account\s+Number\s*:|identity theft|unauthori[sz]ed|not opened|not authorized|tradeline/i;

function findNextSection(structure: DocxStructureMap, afterIndex: number) {
  return structure.paragraphs.slice(afterIndex + 1).find((paragraph) => NEXT_SECTION_HINT.test(paragraph.text)) || null;
}

function findDetectedItemEnd(structure: DocxStructureMap, startIndex: number) {
  let last = startIndex;
  for (const paragraph of structure.paragraphs.slice(startIndex + 1)) {
    if (!paragraph.text) continue;
    if (NEXT_SECTION_HINT.test(paragraph.text)) break;
    if (ACCOUNT_ITEM_HINT.test(paragraph.text)) last = paragraph.index;
  }
  return last;
}

export function resolveInsertionZone(structure: DocxStructureMap, anchor: DetectedAnchor): InsertionZone {
  const policy = anchorPolicy(anchor.kind);
  if (anchor.source === 'fallback-created') {
    return {
      anchorKind: anchor.kind,
      startParagraphIndex: anchor.paragraphIndex,
      endParagraphIndex: anchor.paragraphIndex,
      insertMode: 'append-before-signature',
      confidence: anchor.confidence,
      requiresManagerReview: true,
      reason: `${anchor.reason} Manager should review the auto-created insertion zone.`
    };
  }
  if (anchor.source === 'paragraph-pattern') {
    return {
      anchorKind: anchor.kind,
      startParagraphIndex: anchor.paragraphIndex,
      endParagraphIndex: findDetectedItemEnd(structure, anchor.paragraphIndex),
      insertMode: 'replace-detected-items',
      confidence: anchor.confidence,
      requiresManagerReview: anchor.confidence < Math.max(0.82, policy.confidenceFloor),
      reason: `${anchor.reason} Existing account-like paragraphs can be replaced with generated blocks.`
    };
  }
  const next = findNextSection(structure, anchor.paragraphIndex);
  return {
    anchorKind: anchor.kind,
    startParagraphIndex: anchor.paragraphIndex,
    endParagraphIndex: next ? Math.max(anchor.paragraphIndex, next.index - 1) : null,
    insertMode: 'insert-after-heading',
    confidence: anchor.confidence,
    requiresManagerReview: anchor.confidence < Math.max(0.82, policy.confidenceFloor),
    reason: `${anchor.reason} Insert generated content after the detected heading until the next known section.`
  };
}

export function resolveBestInsertionZone(structure: DocxStructureMap, anchors: DetectedAnchor[], anchorKind: TemplateAnchorKind) {
  const anchor = anchors.filter((candidate) => candidate.kind === anchorKind).sort((a, b) => b.confidence - a.confidence)[0] || null;
  return anchor ? resolveInsertionZone(structure, anchor) : null;
}
