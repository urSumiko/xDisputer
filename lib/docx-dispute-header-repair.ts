import PizZip from 'pizzip';
import { hardenGeneratedDocx } from './docx-safety';
import { DOCX_MIME, type ReferenceDisputeValues } from './docx-renderer';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const STATIC_HEADER_PLACEHOLDER = /^(?:NAME|ADDRESS|CITY,?\s*STATE\s+ZIP|DOB:?|SSN:?|\[DATE\]|\[CREDIT\s+BUREAU\s+NAME\]|\[DISPUTE\s+ADDRESS\])$/i;
const BODY_START = /^(?:RE\s*:|SUBJECT\s*:|Dear\b|To\s+Whom\b|Account\s+Information\b|Disputed\s+Accounts?\b)/i;

function paragraphs(body: Element) {
  return Array.from(body.getElementsByTagNameNS(WORD_NS, 'p')) as Element[];
}

function textOf(paragraph: Element) {
  return Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't')).map((node) => node.textContent || '').join('').replace(/\s+/g, ' ').trim();
}

function keyOf(value: string) {
  return value.replace(/[\[\]{}«»]/g, '').replace(/\s+/g, ' ').replace(/:$/, '').trim().toUpperCase();
}

function compactKey(value: string) {
  return keyOf(value).replace(/[^A-Z0-9]/g, '');
}

function bodyStartIndex(all: Element[]) {
  const index = all.findIndex((paragraph) => BODY_START.test(textOf(paragraph)));
  return index >= 0 ? index : all.length;
}

function staticHintSignals(value: string) {
  const key = keyOf(value);
  const compact = compactKey(value);
  const signals = new Set<string>();

  if (!key) return signals;
  if (/^NAME$/.test(key) || /\bNAME\b/.test(key)) signals.add('NAME');
  if (/^ADDRESS$/.test(key) || /\bADDRESS\b/.test(key)) signals.add('ADDRESS');
  if (/CITY\s*,?\s*STATE\s+ZIP/.test(key) || compact.includes('CITYSTATEZIP')) signals.add('CITY_STATE_ZIP');
  if (/^DOB\s*:?$/.test(key) || /\bDOB\s*:?\b/.test(key)) signals.add('DOB');
  if (/^SSN\s*:?$/.test(key) || /\bSSN\s*:?\b/.test(key)) signals.add('SSN');
  if (/^DATE$/.test(key) || /^\[?DATE\]?$/.test(value.trim().toUpperCase())) signals.add('DATE');
  if (/CREDIT\s+BUREAU\s+NAME/.test(key) || compact.includes('CREDITBUREAUNAME')) signals.add('BUREAU_NAME');
  if (/DISPUTE\s+ADDRESS/.test(key) || compact.includes('DISPUTEADDRESS')) signals.add('BUREAU_ADDRESS');

  return signals;
}

function isStaticHintParagraph(value: string) {
  if (STATIC_HEADER_PLACEHOLDER.test(value)) return true;
  const signals = staticHintSignals(value);
  return signals.size >= 2;
}

function hasEnoughStaticHeaderSignals(values: string[]) {
  const signals = new Set<string>();
  values.forEach((value) => staticHintSignals(value).forEach((signal) => signals.add(signal)));

  const hasClientHints = signals.has('NAME') && (signals.has('ADDRESS') || signals.has('CITY_STATE_ZIP'));
  const hasDateHints = signals.has('DATE') || signals.has('DOB') || signals.has('SSN');
  const hasBureauHints = signals.has('BUREAU_NAME') || signals.has('BUREAU_ADDRESS');

  return hasClientHints && hasDateHints && hasBureauHints;
}

function looksLikeUsableGeneratedHeader(values: string[], source: ReferenceDisputeValues) {
  const joined = values.join('\n');
  const hasClientName = Boolean(source.consumerName && joined.includes(source.consumerName));
  const hasIdentity = Boolean((source.dob && joined.includes(source.dob)) || (source.ssn && joined.includes(source.ssn)));
  const hasDate = Boolean(source.letterDate && joined.includes(source.letterDate));
  const hasBureau = Boolean(
    (source.bureauName && joined.includes(source.bureauName)) ||
    source.bureauAddressLines.some((line) => line && joined.includes(line))
  );

  return hasClientName && (hasIdentity || hasDate || hasBureau);
}

function staticHintRegionBeforeBody(all: Element[]) {
  const limit = bodyStartIndex(all);

  for (let index = 0; index < limit; index += 1) {
    if (!isStaticHintParagraph(textOf(all[index]))) continue;

    const region: Element[] = [];
    for (let pointer = index; pointer < limit; pointer += 1) {
      const paragraph = all[pointer];
      const value = textOf(paragraph);
      if (!value || isStaticHintParagraph(value)) {
        region.push(paragraph);
        continue;
      }
      break;
    }

    if (hasEnoughStaticHeaderSignals(region.map(textOf).filter(Boolean))) return region;
  }

  return [];
}

function textRunLike(source: Element) {
  const run = (Array.from(source.getElementsByTagNameNS(WORD_NS, 'r')).find((item) => textOf(item as Element)) || source.ownerDocument.createElementNS(WORD_NS, 'w:r')).cloneNode(true) as Element;
  Array.from(run.children).forEach((node) => {
    if (!(node.namespaceURI === WORD_NS && node.localName === 'rPr')) run.removeChild(node);
  });
  return run;
}

function writeLines(paragraph: Element, lines: string[]) {
  const doc = paragraph.ownerDocument;
  const runStyle = textRunLike(paragraph);
  Array.from(paragraph.children).forEach((node) => {
    if (!(node.namespaceURI === WORD_NS && node.localName === 'pPr')) paragraph.removeChild(node);
  });

  lines.forEach((line, index) => {
    if (index) {
      const breakRun = textRunLike(paragraph);
      breakRun.appendChild(doc.createElementNS(WORD_NS, 'w:br'));
      paragraph.appendChild(breakRun);
    }

    const run = runStyle.cloneNode(true) as Element;
    const text = doc.createElementNS(WORD_NS, 'w:t');
    if (/^\s|\s$/.test(line)) text.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    text.textContent = line;
    run.appendChild(text);
    paragraph.appendChild(run);
  });
}

function cloneParagraphWithText(source: Element, lines: string[]) {
  const paragraph = source.cloneNode(true) as Element;
  writeLines(paragraph, lines);
  return paragraph;
}

function blankParagraphLike(source: Element) {
  const paragraph = source.cloneNode(true) as Element;
  Array.from(paragraph.children).forEach((node) => {
    if (!(node.namespaceURI === WORD_NS && node.localName === 'pPr')) paragraph.removeChild(node);
  });
  return paragraph;
}

function replaceStaticHintRegionWithHeader(body: Element, region: Element[], values: ReferenceDisputeValues) {
  const reference = region[0];
  const style = region.find((paragraph) => textOf(paragraph)) || reference;
  if (!reference?.parentNode) return false;

  const clientLines = [values.consumerName, ...values.addressLines.map((line) => line.trim()).filter(Boolean), values.dob ? `DOB: ${values.dob}` : '', values.ssn ? `SSN: ${values.ssn}` : ''].filter(Boolean);
  const dateLines = [values.letterDate].filter(Boolean);
  const bureauLines = [values.bureauName, ...values.bureauAddressLines.map((line) => line.trim()).filter(Boolean)].filter(Boolean);
  const replacements = [
    cloneParagraphWithText(style, clientLines),
    cloneParagraphWithText(style, dateLines),
    cloneParagraphWithText(style, bureauLines),
    blankParagraphLike(style)
  ];

  replacements.forEach((paragraph) => reference.parentNode?.insertBefore(paragraph, reference));
  region.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
  return true;
}

function removeStaticHintsWhenHeaderAlreadyExists(body: Element, all: Element[], region: Element[], values: ReferenceDisputeValues) {
  const firstRegionIndex = all.indexOf(region[0]);
  const beforeRegion = firstRegionIndex >= 0 ? all.slice(0, firstRegionIndex).map(textOf).filter(Boolean) : [];
  const beforeBody = all.slice(0, bodyStartIndex(all)).map(textOf).filter(Boolean);

  if (!looksLikeUsableGeneratedHeader(beforeRegion, values) && !looksLikeUsableGeneratedHeader(beforeBody.filter((line) => !isStaticHintParagraph(line)), values)) return false;

  region.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
  return true;
}

function repairStaticHeaderHints(body: Element, values: ReferenceDisputeValues) {
  const all = paragraphs(body);
  const region = staticHintRegionBeforeBody(all);
  if (!region.length) return false;

  if (removeStaticHintsWhenHeaderAlreadyExists(body, all, region, values)) return true;
  return replaceStaticHintRegionWithHeader(body, region, values);
}

export async function repairDisputeStaticHeaderDuplication(blob: Blob, values: ReferenceDisputeValues): Promise<Blob> {
  const zip = new PizZip(await blob.arrayBuffer());
  const file = zip.file('word/document.xml');
  if (!file) return blob;

  const xml = new DOMParser().parseFromString(file.asText(), 'application/xml');
  const body = xml.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) return blob;

  const changed = repairStaticHeaderHints(body, values);
  if (!changed) return blob;

  zip.file('word/document.xml', new XMLSerializer().serializeToString(xml));
  return hardenGeneratedDocx(zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' }));
}
