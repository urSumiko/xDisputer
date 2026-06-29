import PizZip from 'pizzip';
import { bureauInfo, type LetterRoute, type ParsedSource } from '../letter-engine';

export type HeaderDedupeResult = {
  blob: Blob;
  changed: boolean;
  removedParagraphs: number;
  mutatedParts: string[];
  warning: string | null;
};

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WORD_DOCUMENT_XML = 'word/document.xml';
const HEADER_BOUNDARY = /^(?:RE\s*:|SUBJECT\s*:|Dear\b|To\s+Whom|I\s+am\s+writing|This\s+letter|Account\s+Information|REQUEST\s+FOR\s+INVESTIGATION\b|FORMAL\s+DISPUTE\b)/i;
const BUREAU_LINE = /\b(?:TransUnion|Experian|Equifax|Consumer\s+Dispute|Information\s+Services|PO\s+Box|P\.O\.\s*Box)\b/i;
const IDENTITY_LINE = /\b(?:DOB|SSN)\s*:/i;
const EMAIL_LINE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const RESERVED_ADDRESS_LINE = /^(?:PHONE(?:\s+NO\.?)?|TELEPHONE|MOBILE|EMAIL|E-?MAIL|COUNTRY|DOB|SSN)\s*:/i;

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

function content(paragraph: Element) {
  return Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't')).map((node) => node.textContent || '').join('').replace(/\s+/g, ' ').trim();
}

function paragraphs(body: Element) {
  return Array.from(body.children).filter((node) => node.namespaceURI === WORD_NS && node.localName === 'p') as Element[];
}

function cloneParagraphShell(source: Element, doc: XMLDocument) {
  const paragraph = source.cloneNode(true) as Element;
  Array.from(paragraph.children).forEach((node) => {
    if (!(node.namespaceURI === WORD_NS && node.localName === 'pPr')) paragraph.removeChild(node);
  });
  if (!Array.from(paragraph.children).some((node) => node.namespaceURI === WORD_NS && node.localName === 'pPr')) paragraph.appendChild(doc.createElementNS(WORD_NS, 'w:pPr'));
  return paragraph;
}

function cloneRunShell(source: Element, doc: XMLDocument) {
  const sourceRun = Array.from(source.getElementsByTagNameNS(WORD_NS, 'r')).find((run) => content(run as Element)) || source.getElementsByTagNameNS(WORD_NS, 'r')[0];
  const run = (sourceRun ? sourceRun.cloneNode(true) : doc.createElementNS(WORD_NS, 'w:r')) as Element;
  Array.from(run.children).forEach((node) => {
    if (!(node.namespaceURI === WORD_NS && node.localName === 'rPr')) run.removeChild(node);
  });
  return run;
}

function paragraphWithLines(doc: XMLDocument, source: Element, lines: string[]) {
  const paragraph = cloneParagraphShell(source, doc);
  lines.forEach((line, index) => {
    if (index) {
      const brRun = cloneRunShell(source, doc);
      brRun.appendChild(doc.createElementNS(WORD_NS, 'w:br'));
      paragraph.appendChild(brRun);
    }
    const run = cloneRunShell(source, doc);
    const text = doc.createElementNS(WORD_NS, 'w:t');
    if (/^\s|\s$/.test(line)) text.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    text.textContent = line;
    run.appendChild(text);
    paragraph.appendChild(run);
  });
  return paragraph;
}

function blankParagraph(doc: XMLDocument, source: Element) {
  return cloneParagraphShell(source, doc);
}

export function safeClientAddressLines(lines: string[]) {
  return lines.map((line) => line.trim()).filter(Boolean).filter((line) => !RESERVED_ADDRESS_LINE.test(line)).filter((line) => !EMAIL_LINE.test(line));
}

function findHeaderBoundary(all: Element[]) {
  const startIndex = all.findIndex((paragraph) => content(paragraph));
  if (startIndex < 0) return { startIndex: -1, boundary: null as Element | null, boundaryIndex: -1 };
  for (let index = startIndex + 1; index < Math.min(all.length, startIndex + 80); index += 1) {
    const text = content(all[index]);
    if (text && HEADER_BOUNDARY.test(text)) return { startIndex, boundary: all[index], boundaryIndex: index };
  }
  return { startIndex, boundary: null, boundaryIndex: -1 };
}

function headerLooksGenerated(region: Element[], parsed: ParsedSource, route?: LetterRoute | null) {
  const text = normalize(region.map(content).join(' '));
  const currentName = normalize(parsed.name || '');
  const identityCount = (text.match(/\b(?:DOB|SSN)\s*:/g) || []).length;
  const hasBureau = route?.bureau ? text.includes(normalize(bureauInfo[route.bureau].name)) || BUREAU_LINE.test(text) : BUREAU_LINE.test(text);
  return Boolean(currentName && text.includes(currentName)) || identityCount >= 2 || hasBureau;
}

function generatedHeader(doc: XMLDocument, style: Element, parsed: ParsedSource, route: LetterRoute | null | undefined, documentDate: string) {
  const bureauName = route?.bureau ? bureauInfo[route.bureau].name : '';
  const bureauAddress = route?.bureau ? bureauInfo[route.bureau].address.split('\n') : [];
  const clientLines = [parsed.name, ...safeClientAddressLines(parsed.address || []), parsed.dob ? `DOB: ${parsed.dob}` : '', parsed.ssn ? `SSN: ${parsed.ssn}` : ''].filter(Boolean);
  return [paragraphWithLines(doc, style, clientLines), paragraphWithLines(doc, style, [documentDate].filter(Boolean)), paragraphWithLines(doc, style, [bureauName, ...bureauAddress].filter(Boolean)), blankParagraph(doc, style)];
}

export async function normalizeGeneratedLetterHeader(blob: Blob, input: { parsed: ParsedSource; route?: LetterRoute | null; documentDate: string }): Promise<HeaderDedupeResult> {
  const zip = new PizZip(await blob.arrayBuffer());
  const file = zip.file(WORD_DOCUMENT_XML);
  if (!file) return { blob, changed: false, removedParagraphs: 0, mutatedParts: [], warning: null };
  const originalXml = file.asText();
  const xml = new DOMParser().parseFromString(originalXml, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) return { blob, changed: false, removedParagraphs: 0, mutatedParts: [], warning: null };
  const body = xml.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) return { blob, changed: false, removedParagraphs: 0, mutatedParts: [], warning: null };
  const all = paragraphs(body);
  const boundary = findHeaderBoundary(all);
  if (boundary.startIndex < 0 || !boundary.boundary || boundary.boundaryIndex <= boundary.startIndex) return { blob, changed: false, removedParagraphs: 0, mutatedParts: [], warning: null };
  const region = all.slice(boundary.startIndex, boundary.boundaryIndex);
  if (!headerLooksGenerated(region, input.parsed, input.route)) return { blob, changed: false, removedParagraphs: 0, mutatedParts: [], warning: null };
  const style = region.find((paragraph) => content(paragraph)) || boundary.boundary;
  region.forEach((paragraph) => paragraph.parentNode === body && body.removeChild(paragraph));
  generatedHeader(xml, style, input.parsed, input.route, input.documentDate).forEach((paragraph) => body.insertBefore(paragraph, boundary.boundary));
  const outputXml = new XMLSerializer().serializeToString(xml);
  if (outputXml === originalXml) return { blob, changed: false, removedParagraphs: 0, mutatedParts: [], warning: null };
  zip.file(WORD_DOCUMENT_XML, outputXml);
  return { blob: zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' }), changed: true, removedParagraphs: region.length, mutatedParts: [WORD_DOCUMENT_XML], warning: `Normalized generated letter header from parsed source data and removed ${region.length} stale header paragraph(s).` };
}

export async function dedupeGeneratedClientHeaders(blob: Blob, input: { clientName: string }): Promise<HeaderDedupeResult> {
  return { blob, changed: false, removedParagraphs: 0, mutatedParts: [], warning: input.clientName ? null : null };
}
