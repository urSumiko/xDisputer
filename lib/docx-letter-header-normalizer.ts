import PizZip from 'pizzip';
import { hardenGeneratedDocx } from './docx-safety';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const BODY_START = /^(?:RE\s*:|SUBJECT\s*:|Dear\b|To\s+Whom\b|Account\s+Information\b|Disputed\s+Accounts?\b|Hard\s+Inquir(?:y|ies)\b)/i;
const STATIC_HEADER_PLACEHOLDER = /^(?:NAME|ADDRESS|CITY,?\s*STATE\s+ZIP|DOB:?|SSN:?|\[DATE\]|\[CREDIT\s+BUREAU\s+NAME\]|\[DISPUTE\s+ADDRESS\])$/i;

type HeaderPlaceholderKind = 'NAME' | 'ADDRESS' | 'CITY_STATE_ZIP' | 'DOB' | 'SSN' | 'DATE' | 'BUREAU_NAME' | 'BUREAU_ADDRESS';

export type CanonicalLetterHeaderValues = {
  consumerName: string;
  addressLines: string[];
  dob?: string;
  ssn?: string;
  letterDate: string;
  bureauName: string;
  bureauAddressLines: string[];
};

export type CanonicalLetterHeaderResult = {
  blob: Blob;
  changed: boolean;
  reason: string;
};

function paragraphs(body: Element) {
  return Array.from(body.getElementsByTagNameNS(WORD_NS, 'p')) as Element[];
}

function textOf(paragraph: Element) {
  return Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't'))
    .map((node) => node.textContent || '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
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

function cleanLines(lines: string[]) {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function canonicalHeaderLines(values: CanonicalLetterHeaderValues) {
  const client = [
    values.consumerName,
    ...cleanLines(values.addressLines),
    values.dob ? `DOB: ${values.dob}` : '',
    values.ssn ? `SSN: ${values.ssn}` : ''
  ].filter(Boolean);

  const date = [values.letterDate].filter(Boolean);
  const bureau = [values.bureauName, ...cleanLines(values.bureauAddressLines)].filter(Boolean);
  return { client, date, bureau };
}

function staticHintSignals(value: string) {
  const key = keyOf(value);
  const compact = compactKey(value);
  const signals = new Set<HeaderPlaceholderKind>();
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

function isStaticHint(value: string) {
  return STATIC_HEADER_PLACEHOLDER.test(value) || staticHintSignals(value).size >= 2;
}

function preferredStaticKind(value: string): HeaderPlaceholderKind | null {
  const signals = staticHintSignals(value);
  const priority: HeaderPlaceholderKind[] = ['BUREAU_ADDRESS', 'BUREAU_NAME', 'CITY_STATE_ZIP', 'ADDRESS', 'NAME', 'DOB', 'SSN', 'DATE'];
  return priority.find((kind) => signals.has(kind)) || null;
}

function containsAny(text: string, values: string[]) {
  return values.some((value) => value && text.includes(value));
}

function isStrongHeaderSignal(value: string, values: CanonicalLetterHeaderValues) {
  const candidates = [
    values.consumerName,
    values.letterDate,
    values.bureauName,
    values.dob || '',
    values.ssn || '',
    ...cleanLines(values.addressLines),
    ...cleanLines(values.bureauAddressLines)
  ];

  return isStaticHint(value) || containsAny(value, candidates) || /\b(?:DOB|SSN)\s*:/i.test(value) || /\b(?:PO\s+Box|P\.O\.\s*Box|Consumer\s+Dispute|Equifax|Experian|TransUnion)\b/i.test(value);
}

function regionHasEnoughHeaderEvidence(values: string[], source: CanonicalLetterHeaderValues) {
  const joined = values.join('\n');
  const staticSignals = new Set<HeaderPlaceholderKind>();
  values.forEach((value) => staticHintSignals(value).forEach((signal) => staticSignals.add(signal)));

  const hasStaticTemplateHeader = staticSignals.has('NAME') && (staticSignals.has('ADDRESS') || staticSignals.has('CITY_STATE_ZIP')) && (staticSignals.has('DATE') || staticSignals.has('DOB') || staticSignals.has('SSN') || staticSignals.has('BUREAU_NAME') || staticSignals.has('BUREAU_ADDRESS'));
  const hasCurrentClient = Boolean(source.consumerName && joined.includes(source.consumerName));
  const hasIdentity = Boolean((source.dob && joined.includes(source.dob)) || (source.ssn && joined.includes(source.ssn)) || /\b(?:DOB|SSN)\s*:/i.test(joined));
  const hasBureau = Boolean(source.bureauName && joined.includes(source.bureauName)) || source.bureauAddressLines.some((line) => line && joined.includes(line));
  const hasDate = Boolean(source.letterDate && joined.includes(source.letterDate));

  return hasStaticTemplateHeader || (hasCurrentClient && (hasIdentity || hasBureau || hasDate)) || (hasIdentity && hasBureau);
}

function findHeaderRegion(all: Element[], values: CanonicalLetterHeaderValues) {
  const limit = bodyStartIndex(all);
  if (limit <= 0) return [];

  const beforeBody = all.slice(0, limit);
  const firstSignal = beforeBody.findIndex((paragraph) => isStrongHeaderSignal(textOf(paragraph), values));
  if (firstSignal < 0) return [];

  let start = firstSignal;
  while (start > 0) {
    const previous = textOf(beforeBody[start - 1]);
    if (!previous) {
      start -= 1;
      continue;
    }

    if (isStrongHeaderSignal(previous, values)) {
      start -= 1;
      continue;
    }

    break;
  }

  const region = beforeBody.slice(start, limit);
  const valuesInRegion = region.map(textOf).filter(Boolean);
  return regionHasEnoughHeaderEvidence(valuesInRegion, values) ? region : [];
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
  const style = textRunLike(paragraph);
  Array.from(paragraph.children).forEach((node) => {
    if (!(node.namespaceURI === WORD_NS && node.localName === 'pPr')) paragraph.removeChild(node);
  });

  lines.forEach((line, index) => {
    if (index) {
      const breakRun = textRunLike(paragraph);
      breakRun.appendChild(doc.createElementNS(WORD_NS, 'w:br'));
      paragraph.appendChild(breakRun);
    }

    const run = style.cloneNode(true) as Element;
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

function staticHintSlice(region: Element[]) {
  const first = region.findIndex((paragraph) => isStaticHint(textOf(paragraph)));
  if (first < 0) return [];
  let last = first;
  for (let index = first + 1; index < region.length; index += 1) {
    const value = textOf(region[index]);
    if (!value || isStaticHint(value)) {
      last = index;
      continue;
    }
    break;
  }
  return region.slice(first, last + 1);
}

function valuesForPlaceholder(kind: HeaderPlaceholderKind, values: CanonicalLetterHeaderValues, hasCityStateZipPlaceholder: boolean, used: Set<HeaderPlaceholderKind>) {
  if (used.has(kind)) return [];
  used.add(kind);

  const addressLines = cleanLines(values.addressLines);
  if (kind === 'NAME') return [values.consumerName].filter(Boolean);
  if (kind === 'ADDRESS') return hasCityStateZipPlaceholder ? addressLines.slice(0, 1) : addressLines;
  if (kind === 'CITY_STATE_ZIP') return addressLines.slice(1).length ? addressLines.slice(1) : addressLines.slice(0, 1);
  if (kind === 'DOB') return values.dob ? [`DOB: ${values.dob}`] : [];
  if (kind === 'SSN') return values.ssn ? [`SSN: ${values.ssn}`] : [];
  if (kind === 'DATE') return [values.letterDate].filter(Boolean);
  if (kind === 'BUREAU_NAME') return [values.bureauName].filter(Boolean);
  if (kind === 'BUREAU_ADDRESS') return cleanLines(values.bureauAddressLines);
  return [];
}

function replaceRegionUsingTemplateHints(region: Element[], values: CanonicalLetterHeaderValues) {
  const hintSlice = staticHintSlice(region);
  if (!hintSlice.length) return false;

  const reference = region[0];
  const parent = reference?.parentNode;
  if (!reference || !parent) return false;

  const used = new Set<HeaderPlaceholderKind>();
  const hasCityStateZipPlaceholder = hintSlice.some((paragraph) => staticHintSignals(textOf(paragraph)).has('CITY_STATE_ZIP'));
  const replacements = hintSlice.map((paragraph) => {
    const value = textOf(paragraph);
    if (!value) return blankParagraphLike(paragraph);
    const kind = preferredStaticKind(value);
    if (!kind) return blankParagraphLike(paragraph);
    const lines = valuesForPlaceholder(kind, values, hasCityStateZipPlaceholder, used);
    return lines.length ? cloneParagraphWithText(paragraph, lines) : blankParagraphLike(paragraph);
  });

  replacements.forEach((paragraph) => parent.insertBefore(paragraph, reference));
  region.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
  return true;
}

function replaceRegionWithCanonicalHeader(region: Element[], values: CanonicalLetterHeaderValues) {
  if (replaceRegionUsingTemplateHints(region, values)) return true;

  const reference = region[0];
  const parent = reference?.parentNode;
  if (!reference || !parent) return false;

  const styles = region.filter((paragraph) => textOf(paragraph));
  const fallback = styles[0] || reference;
  const lines = canonicalHeaderLines(values);
  const flat = [...lines.client, ...lines.date, '', ...lines.bureau, ''];
  const replacements = flat.map((line, index) => {
    const source = styles[index] || styles.at(-1) || fallback;
    return line ? cloneParagraphWithText(source, [line]) : blankParagraphLike(source);
  });

  replacements.forEach((paragraph) => parent.insertBefore(paragraph, reference));
  region.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
  return true;
}

function assertNoHeaderConflict(body: Element, values: CanonicalLetterHeaderValues) {
  const all = paragraphs(body);
  const limit = bodyStartIndex(all);
  const beforeBody = all.slice(0, limit).map(textOf).filter(Boolean);
  const remainingHints = beforeBody.filter(isStaticHint);
  const nameCount = values.consumerName ? beforeBody.filter((line) => line.includes(values.consumerName)).length : 0;

  if (remainingHints.length) {
    throw new Error(`Generated dispute letter still contains static header hint text before the body: ${remainingHints.slice(0, 3).join(' | ')}`);
  }

  if (nameCount > 1) {
    throw new Error('Generated dispute letter still contains duplicated client header information before the body.');
  }
}

export async function normalizeDisputeLetterHeader(blob: Blob, values: CanonicalLetterHeaderValues): Promise<CanonicalLetterHeaderResult> {
  const zip = new PizZip(await blob.arrayBuffer());
  const file = zip.file('word/document.xml');
  if (!file) return { blob, changed: false, reason: 'document.xml missing' };

  const xml = new DOMParser().parseFromString(file.asText(), 'application/xml');
  const body = xml.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) return { blob, changed: false, reason: 'body missing' };

  const region = findHeaderRegion(paragraphs(body), values);
  const changed = region.length ? replaceRegionWithCanonicalHeader(region, values) : false;
  assertNoHeaderConflict(body, values);

  if (!changed) return { blob, changed: false, reason: 'no conflicting header region found' };

  zip.file('word/document.xml', new XMLSerializer().serializeToString(xml));
  const output = await hardenGeneratedDocx(zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' }));
  return { blob: output, changed: true, reason: 'canonical header written once using template header styles and spacing' };
}
