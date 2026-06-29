import PizZip from 'pizzip';
import { DOCX_MIME } from '../docx-renderer';

export type HeaderDedupeResult = {
  blob: Blob;
  changed: boolean;
  removedParagraphs: number;
  mutatedParts: string[];
  warning: string | null;
};

type ParagraphRange = { start: number; end: number; xml: string; text: string; index: number };

const PARAGRAPH_PATTERN = /<w:p[\s\S]*?<\/w:p>/gi;
const TEXT_NODE_PATTERN = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;
const WORD_DOCUMENT_XML = 'word/document.xml';
const HEADER_BOUNDARY = /^(?:RE\s*:|SUBJECT\s*:|Dear\b|To\s+Whom|I\s+am\s+writing|This\s+letter|Account\s+Information|My\s+sakalam|PERFORMANCE\b)/i;
const BUREAU_LINE = /\b(?:TransUnion|Experian|Equifax|Consumer\s+Dispute|Information\s+Services|PO\s+Box|P\.O\.\s*Box)\b/i;
const IDENTITY_LINE = /\b(?:DOB|SSN)\s*:/i;

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&');
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

function paragraphText(xml: string) {
  return Array.from(xml.matchAll(TEXT_NODE_PATTERN)).map((match) => decodeXml(match[1] || '')).join('').replace(/\s+/g, ' ').trim();
}

function paragraphRanges(xml: string): ParagraphRange[] {
  return Array.from(xml.matchAll(PARAGRAPH_PATTERN)).map((match, index) => ({
    start: match.index || 0,
    end: (match.index || 0) + match[0].length,
    xml: match[0],
    text: paragraphText(match[0]),
    index
  }));
}

function isNameLike(text: string) {
  const clean = text.trim();
  if (!clean || clean.length < 4 || clean.length > 70) return false;
  if (/\d|:|@|\b(?:DOB|SSN|PO\s+Box)\b/i.test(clean)) return false;
  if (BUREAU_LINE.test(clean)) return false;
  const letters = clean.replace(/[^A-Za-z]/g, '');
  if (letters.length < 4) return false;
  return clean === clean.toUpperCase() || /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)+$/.test(clean);
}

function headerBoundaryIndex(paragraphs: ParagraphRange[]) {
  const first = paragraphs.find((paragraph) => paragraph.text && HEADER_BOUNDARY.test(paragraph.text));
  return first ? first.index : Math.min(paragraphs.length, 34);
}

function duplicateHeaderStart(paragraphs: ParagraphRange[], identityIndex: number) {
  for (let pointer = identityIndex; pointer >= Math.max(0, identityIndex - 7); pointer -= 1) {
    if (isNameLike(paragraphs[pointer]?.text || '')) return pointer;
  }
  return identityIndex;
}

function removeRanges(xml: string, ranges: Array<{ start: number; end: number }>) {
  return ranges
    .sort((left, right) => right.start - left.start)
    .reduce((current, range) => current.slice(0, range.start) + current.slice(range.end), xml);
}

function dedupeDocumentXml(xml: string, clientName: string) {
  const paragraphs = paragraphRanges(xml);
  const clientKey = normalize(clientName);
  if (!clientKey || paragraphs.length < 4) return { xml, removedParagraphs: 0 };

  const boundary = headerBoundaryIndex(paragraphs);
  const header = paragraphs.slice(0, boundary);
  const currentIndex = header.find((paragraph) => normalize(paragraph.text).includes(clientKey))?.index ?? -1;
  if (currentIndex < 0) return { xml, removedParagraphs: 0 };

  const identityMarkers = header.filter((paragraph) => IDENTITY_LINE.test(paragraph.text));
  if (identityMarkers.length < 2) return { xml, removedParagraphs: 0 };

  const removals: Array<{ start: number; end: number; count: number }> = [];
  for (const marker of identityMarkers) {
    const windowText = normalize(paragraphs.slice(Math.max(0, marker.index - 6), Math.min(boundary, marker.index + 3)).map((paragraph) => paragraph.text).join(' '));
    if (windowText.includes(clientKey)) continue;
    const startIndex = duplicateHeaderStart(paragraphs, marker.index);
    const endIndex = marker.index > currentIndex ? boundary : currentIndex;
    if (endIndex > startIndex) {
      removals.push({ start: paragraphs[startIndex].start, end: paragraphs[endIndex]?.start ?? paragraphs[boundary - 1]?.end ?? paragraphs[startIndex].end, count: endIndex - startIndex });
    }
  }

  if (!removals.length) return { xml, removedParagraphs: 0 };
  const merged = removals
    .sort((left, right) => left.start - right.start)
    .reduce<Array<{ start: number; end: number; count: number }>>((acc, next) => {
      const last = acc[acc.length - 1];
      if (last && next.start <= last.end) {
        last.end = Math.max(last.end, next.end);
        last.count += next.count;
      } else acc.push({ ...next });
      return acc;
    }, []);

  return { xml: removeRanges(xml, merged), removedParagraphs: merged.reduce((sum, range) => sum + range.count, 0) };
}

export async function dedupeGeneratedClientHeaders(blob: Blob, input: { clientName: string }): Promise<HeaderDedupeResult> {
  const zip = new PizZip(await blob.arrayBuffer());
  const file = zip.file(WORD_DOCUMENT_XML);
  if (!file) return { blob, changed: false, removedParagraphs: 0, mutatedParts: [], warning: null };
  const originalXml = file.asText();
  const result = dedupeDocumentXml(originalXml, input.clientName);
  if (!result.removedParagraphs || result.xml === originalXml) return { blob, changed: false, removedParagraphs: 0, mutatedParts: [], warning: null };
  zip.file(WORD_DOCUMENT_XML, result.xml);
  const nextBlob = zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
  return {
    blob: nextBlob,
    changed: true,
    removedParagraphs: result.removedParagraphs,
    mutatedParts: [WORD_DOCUMENT_XML],
    warning: `Removed ${result.removedParagraphs} stale generated header paragraph(s) so only the current client information remains.`
  };
}
