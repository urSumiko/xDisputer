import { createDocxStructureMap, type DocxStructureMap } from './docx-structure-reader';
import { detectTemplateAnchors } from './semantic-section-detector';

export type TemplateDiffRisk = {
  kind: 'removed-anchor' | 'moved-anchor' | 'removed-static-block' | 'added-custom-block';
  severity: 'low' | 'medium' | 'high';
  label: string;
  detail: string;
};

export type TemplateDiffAnalysis = {
  oldParagraphCount: number;
  newParagraphCount: number;
  removedParagraphs: string[];
  addedParagraphs: string[];
  risks: TemplateDiffRisk[];
};

function important(text: string) {
  return /FRAUDULENT|DISPUTED|ACCOUNT NAME|ACCOUNT NUMBER|SUPPORTING DOCUMENTS|SINCERELY|LEGAL DEMAND|NOTICE OF DUTY|REQUIRED ACTIONS/i.test(text);
}

export function analyzeTemplateStructureDiff(oldStructure: DocxStructureMap, newStructure: DocxStructureMap): TemplateDiffAnalysis {
  const oldSet = new Set(oldStructure.paragraphs.map((paragraph) => paragraph.normalizedText).filter(Boolean));
  const newSet = new Set(newStructure.paragraphs.map((paragraph) => paragraph.normalizedText).filter(Boolean));
  const removedParagraphs = oldStructure.paragraphs.map((paragraph) => paragraph.text).filter((text) => text && !newSet.has(text.replace(/\s+/g, ' ').trim().toUpperCase()));
  const addedParagraphs = newStructure.paragraphs.map((paragraph) => paragraph.text).filter((text) => text && !oldSet.has(text.replace(/\s+/g, ' ').trim().toUpperCase()));
  const oldAnchors = detectTemplateAnchors(oldStructure);
  const newAnchors = detectTemplateAnchors(newStructure);
  const risks: TemplateDiffRisk[] = [];
  for (const oldAnchor of oldAnchors.filter((anchor) => anchor.confidence >= 0.82)) {
    const replacement = newAnchors.find((anchor) => anchor.kind === oldAnchor.kind && anchor.confidence >= 0.72);
    if (!replacement) {
      risks.push({ kind: 'removed-anchor', severity: 'high', label: `${oldAnchor.kind} removed`, detail: `Anchor paragraph "${oldAnchor.matchedText}" is no longer detected.` });
    } else if (Math.abs(replacement.paragraphIndex - oldAnchor.paragraphIndex) > 3) {
      risks.push({ kind: 'moved-anchor', severity: 'medium', label: `${oldAnchor.kind} moved`, detail: `Anchor moved from paragraph ${oldAnchor.paragraphIndex + 1} to ${replacement.paragraphIndex + 1}.` });
    }
  }
  for (const text of removedParagraphs.filter(important).slice(0, 8)) {
    risks.push({ kind: 'removed-static-block', severity: 'medium', label: 'Important static block removed', detail: text });
  }
  for (const text of addedParagraphs.filter(important).slice(0, 8)) {
    risks.push({ kind: 'added-custom-block', severity: 'low', label: 'New custom block detected', detail: text });
  }
  return { oldParagraphCount: oldStructure.paragraphCount, newParagraphCount: newStructure.paragraphCount, removedParagraphs, addedParagraphs, risks };
}

export function analyzeTemplateXmlDiff(oldDocumentXml: string, newDocumentXml: string) {
  return analyzeTemplateStructureDiff(createDocxStructureMap(oldDocumentXml), createDocxStructureMap(newDocumentXml));
}
