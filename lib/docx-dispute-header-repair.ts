import PizZip from 'pizzip';
import { hardenGeneratedDocx } from './docx-safety';
import { DOCX_MIME, type ReferenceDisputeValues } from './docx-renderer';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
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

function hasGeneratedHeaderBefore(all: Element[], startIndex: number, values: ReferenceDisputeValues) {
  const before = all.slice(0, startIndex).map(textOf).join('\n');
  return before.includes(values.consumerName) && before.includes(values.bureauName) && before.includes(values.letterDate);
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

function staticHeaderRegion(all: Element[], startIndex: number) {
  const region: Element[] = [];
  const limit = bodyStartIndex(all);

  for (let index = startIndex; index < limit; index += 1) {
    const paragraph = all[index];
    const value = textOf(paragraph);

    if (!value) {
      region.push(paragraph);
      continue;
    }

    if (isStaticHintParagraph(value)) {
      region.push(paragraph);
      continue;
    }

    break;
  }

  const values = region.map(textOf).filter(Boolean);
  return hasEnoughStaticHeaderSignals(values) ? region : [];
}

function removeStaticHintParagraphsBeforeBody(body: Element, values: ReferenceDisputeValues) {
  const all = paragraphs(body);
  const limit = bodyStartIndex(all);
  const beforeBody = all.slice(0, limit);
  const textBeforeBody = beforeBody.map(textOf).join('\n');
  const hasGeneratedHeader = textBeforeBody.includes(values.consumerName) && textBeforeBody.includes(values.bureauName) && textBeforeBody.includes(values.letterDate);

  if (!hasGeneratedHeader) return false;

  const candidates = beforeBody.filter((paragraph) => isStaticHintParagraph(textOf(paragraph)));
  if (!hasEnoughStaticHeaderSignals(candidates.map(textOf))) return false;

  candidates.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
  return candidates.length > 0;
}

function removeDuplicateStaticHeader(body: Element, values: ReferenceDisputeValues) {
  const all = paragraphs(body);

  for (let index = 0; index < all.length; index += 1) {
    const value = textOf(all[index]);
    if (!isStaticHintParagraph(value)) continue;
    if (!hasGeneratedHeaderBefore(all, index, values)) continue;

    const region = staticHeaderRegion(all, index);
    if (!region.length) continue;

    region.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
    return true;
  }

  return removeStaticHintParagraphsBeforeBody(body, values);
}

export async function repairDisputeStaticHeaderDuplication(blob: Blob, values: ReferenceDisputeValues): Promise<Blob> {
  const zip = new PizZip(await blob.arrayBuffer());
  const file = zip.file('word/document.xml');
  if (!file) return blob;

  const xml = new DOMParser().parseFromString(file.asText(), 'application/xml');
  const body = xml.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) return blob;

  const changed = removeDuplicateStaticHeader(body, values);
  if (!changed) return blob;

  zip.file('word/document.xml', new XMLSerializer().serializeToString(xml));
  return hardenGeneratedDocx(zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' }));
}
