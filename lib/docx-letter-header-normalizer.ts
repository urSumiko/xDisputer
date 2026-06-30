import PizZip from 'pizzip';
import { hardenGeneratedDocx } from './docx-safety';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const BODY_START = /^(?:RE\b\s*:?.*|SUBJECT\b\s*:?.*|Dear\b|To\s+Whom\b|Account\s+Information\b|Disputed\s+Accounts?\b|Fraudulent\s+Accounts?\b|Hard\s+Inquir(?:y|ies)\b|Legal\s+(?:Demand|Basis|Notice)\b|Sincerely\b|Respectfully\b|CC\s*:)/i;
const STATIC_HEADER_PLACEHOLDER = /^(?:NAME|ADDRESS|CITY,?\s*STATE\s+ZIP|DOB:?|SSN:?|\[DATE\]|\[CREDIT\s+BUREAU\s+NAME\]|\[DISPUTE\s+ADDRESS\])$/i;
const MAX_HEADER_REGION_PARAGRAPHS = 16;

type HeaderLineKind = 'NAME' | 'ADDRESS' | 'CITY_STATE_ZIP' | 'DOB' | 'SSN' | 'DATE' | 'BUREAU_NAME' | 'BUREAU_ADDRESS' | 'BLANK';

type HeaderLineSpec = {
  kind: HeaderLineKind;
  lines: string[];
};

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

const HEADER_STYLE_PRIORITY: HeaderLineKind[] = ['BUREAU_ADDRESS', 'BUREAU_NAME', 'CITY_STATE_ZIP', 'ADDRESS', 'NAME', 'DOB', 'SSN', 'DATE'];

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

function staticHintSignals(value: string) {
  const key = keyOf(value);
  const compact = compactKey(value);
  const signals = new Set<HeaderLineKind>();
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

function containsAny(text: string, values: string[]) {
  return values.some((value) => value && text.includes(value));
}

function isStrongHeaderSignal(value: string, values: CanonicalLetterHeaderValues) {
  if (!value || BODY_START.test(value)) return false;
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
  const staticSignals = new Set<HeaderLineKind>();
  values.forEach((value) => staticHintSignals(value).forEach((signal) => staticSignals.add(signal)));

  const hasStaticTemplateHeader = staticSignals.has('NAME') && (staticSignals.has('ADDRESS') || staticSignals.has('CITY_STATE_ZIP')) && (staticSignals.has('DATE') || staticSignals.has('DOB') || staticSignals.has('SSN') || staticSignals.has('BUREAU_NAME') || staticSignals.has('BUREAU_ADDRESS'));
  const hasCurrentClient = Boolean(source.consumerName && joined.includes(source.consumerName));
  const hasIdentity = Boolean((source.dob && joined.includes(source.dob)) || (source.ssn && joined.includes(source.ssn)) || /\b(?:DOB|SSN)\s*:/i.test(joined));
  const hasBureau = Boolean(source.bureauName && joined.includes(source.bureauName)) || source.bureauAddressLines.some((line) => line && joined.includes(line));
  const hasDate = Boolean(source.letterDate && joined.includes(source.letterDate));

  return hasStaticTemplateHeader || (hasCurrentClient && (hasIdentity || hasBureau || hasDate)) || (hasIdentity && hasBureau);
}

function findHeaderRegion(all: Element[], values: CanonicalLetterHeaderValues) {
  const explicitBodyStart = bodyStartIndex(all);
  if (explicitBodyStart <= 0) return [];

  const scanLimit = explicitBodyStart;
  const firstSignal = all.slice(0, scanLimit).findIndex((paragraph) => isStrongHeaderSignal(textOf(paragraph), values));
  if (firstSignal < 0) return [];

  let start = firstSignal;
  while (start > 0) {
    const previous = textOf(all[start - 1]);
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

  const maxEnd = Math.min(scanLimit, start + MAX_HEADER_REGION_PARAGRAPHS);
  let end = firstSignal;
  for (let index = firstSignal; index < maxEnd; index += 1) {
    const value = textOf(all[index]);
    if (BODY_START.test(value)) break;

    if (!value || isStrongHeaderSignal(value, values)) {
      end = index + 1;
      continue;
    }

    const candidateValues = all.slice(start, Math.max(end, index)).map(textOf).filter(Boolean);
    if (regionHasEnoughHeaderEvidence(candidateValues, values)) break;
    return [];
  }

  const region = all.slice(start, end);
  const valuesInRegion = region.map(textOf).filter(Boolean);
  return regionHasEnoughHeaderEvidence(valuesInRegion, values) ? region : [];
}

function first<T>(values: T[]) {
  return values[0];
}

function last<T>(values: T[]) {
  return values.length ? values[values.length - 1] : undefined;
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

function ensureRunProperty(run: Element, localName: string) {
  const doc = run.ownerDocument;
  let properties = Array.from(run.children).find((node) => node.namespaceURI === WORD_NS && node.localName === 'rPr') as Element | undefined;
  if (!properties) {
    properties = doc.createElementNS(WORD_NS, 'w:rPr');
    run.insertBefore(properties, run.firstChild);
  }

  let property = Array.from(properties.children).find((node) => node.namespaceURI === WORD_NS && node.localName === localName) as Element | undefined;
  if (!property) {
    property = doc.createElementNS(WORD_NS, `w:${localName}`);
    properties.appendChild(property);
  }
  property.setAttributeNS(WORD_NS, 'w:val', '1');
}

function forceBoldParagraph(paragraph: Element) {
  Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 'r')).forEach((run) => {
    ensureRunProperty(run, 'b');
    ensureRunProperty(run, 'bCs');
  });
  return paragraph;
}

function isBureauHeaderKind(kind: HeaderLineKind) {
  return kind === 'BUREAU_NAME' || kind === 'BUREAU_ADDRESS';
}

function detectKindFromRenderedValue(value: string, values: CanonicalLetterHeaderValues): HeaderLineKind | null {
  if (values.consumerName && value.includes(values.consumerName)) return 'NAME';
  if (values.letterDate && value.includes(values.letterDate)) return 'DATE';
  if (values.bureauName && value.includes(values.bureauName)) return 'BUREAU_NAME';
  if (values.dob && value.includes(values.dob)) return 'DOB';
  if (values.ssn && value.includes(values.ssn)) return 'SSN';
  if (values.bureauAddressLines.some((line) => line && value.includes(line))) return 'BUREAU_ADDRESS';

  const addressLines = cleanLines(values.addressLines);
  if (addressLines[0] && value.includes(addressLines[0])) return 'ADDRESS';
  if (addressLines.slice(1).some((line) => value.includes(line))) return 'CITY_STATE_ZIP';
  return null;
}

function detectStaticKind(paragraph: Element): HeaderLineKind | null {
  const signals = staticHintSignals(textOf(paragraph));
  return HEADER_STYLE_PRIORITY.find((kind) => signals.has(kind)) || null;
}

function headerPrototypeMap(region: Element[], values: CanonicalLetterHeaderValues) {
  const map = new Map<HeaderLineKind, Element>();
  const blank = region.find((paragraph) => !textOf(paragraph));

  region.forEach((paragraph) => {
    const kind = detectStaticKind(paragraph);
    if (kind && !map.has(kind)) map.set(kind, paragraph);
  });

  region.forEach((paragraph) => {
    const kind = detectKindFromRenderedValue(textOf(paragraph), values);
    if (kind && !map.has(kind)) map.set(kind, paragraph);
  });

  return { map, blank };
}

function styleSourceForKind(kind: HeaderLineKind, map: Map<HeaderLineKind, Element>, fallback: Element) {
  if (kind === 'BUREAU_ADDRESS') return map.get('BUREAU_ADDRESS') || map.get('BUREAU_NAME') || first(Array.from(map.values())) || fallback;
  if (kind === 'BUREAU_NAME') return map.get('BUREAU_NAME') || map.get('BUREAU_ADDRESS') || first(Array.from(map.values())) || fallback;
  if (kind === 'CITY_STATE_ZIP') return map.get('CITY_STATE_ZIP') || map.get('ADDRESS') || first(Array.from(map.values())) || fallback;
  if (kind === 'ADDRESS') return map.get('ADDRESS') || map.get('CITY_STATE_ZIP') || first(Array.from(map.values())) || fallback;
  if (kind === 'DOB' || kind === 'SSN') return map.get(kind) || map.get('NAME') || map.get('ADDRESS') || first(Array.from(map.values())) || fallback;
  if (kind === 'DATE') return map.get('DATE') || map.get('NAME') || first(Array.from(map.values())) || fallback;
  return map.get(kind) || map.get('NAME') || map.get('ADDRESS') || first(Array.from(map.values())) || fallback;
}

function paragraphForKind(input: {
  kind: HeaderLineKind;
  lines: string[];
  map: Map<HeaderLineKind, Element>;
  blank?: Element;
  fallback: Element;
}) {
  if (input.kind === 'BLANK' || !input.lines.length) {
    return blankParagraphLike(input.blank || input.fallback);
  }

  const paragraph = cloneParagraphWithText(styleSourceForKind(input.kind, input.map, input.fallback), input.lines);
  return isBureauHeaderKind(input.kind) ? forceBoldParagraph(paragraph) : paragraph;
}

function lineSpecs(values: CanonicalLetterHeaderValues): HeaderLineSpec[] {
  const addressLines = cleanLines(values.addressLines);
  const bureauAddressLines = cleanLines(values.bureauAddressLines);
  const specs: HeaderLineSpec[] = [
    { kind: 'NAME', lines: [values.consumerName].filter(Boolean) },
    { kind: 'ADDRESS', lines: addressLines.slice(0, 1) },
    { kind: 'CITY_STATE_ZIP', lines: addressLines.slice(1) },
    { kind: 'DOB', lines: values.dob ? [`DOB: ${values.dob}`] : [] },
    { kind: 'SSN', lines: values.ssn ? [`SSN: ${values.ssn}`] : [] },
    { kind: 'DATE', lines: [values.letterDate].filter(Boolean) },
    { kind: 'BLANK', lines: [] },
    { kind: 'BUREAU_NAME', lines: [values.bureauName].filter(Boolean) },
    ...bureauAddressLines.map((line) => ({ kind: 'BUREAU_ADDRESS' as const, lines: [line] })),
    { kind: 'BLANK', lines: [] }
  ];

  return specs.filter((spec) => spec.kind === 'BLANK' || spec.lines.length);
}

function replaceRegionWithStyledHeader(region: Element[], values: CanonicalLetterHeaderValues) {
  const reference = region[0];
  const parent = reference?.parentNode;
  if (!reference || !parent) return false;

  const nonEmpty = region.filter((paragraph) => textOf(paragraph));
  const fallback = first(nonEmpty) || reference;
  const { map, blank } = headerPrototypeMap(region, values);
  const replacements = lineSpecs(values).map((spec) => paragraphForKind({ ...spec, map, blank, fallback }));

  replacements.forEach((paragraph) => parent.insertBefore(paragraph, reference));
  region.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
  return true;
}

function assertNoHeaderConflict(body: Element, values: CanonicalLetterHeaderValues) {
  const all = paragraphs(body);
  const headerRegion = findHeaderRegion(all, values);
  const limit = Math.min(bodyStartIndex(all), MAX_HEADER_REGION_PARAGRAPHS);
  const beforeBody = (headerRegion.length ? headerRegion : all.slice(0, limit)).map(textOf).filter(Boolean);
  const remainingHints = beforeBody.filter(isStaticHint);
  const nameCount = values.consumerName ? beforeBody.filter((line) => line.includes(values.consumerName)).length : 0;
  const addressLines = cleanLines(values.addressLines);
  const missingRequired = [
    values.consumerName,
    addressLines[0] || '',
    last(addressLines) || '',
    values.dob || '',
    values.ssn || '',
    values.letterDate,
    values.bureauName,
    ...cleanLines(values.bureauAddressLines)
  ].filter(Boolean).filter((value) => !beforeBody.some((line) => line.includes(value)));

  if (remainingHints.length) {
    throw new Error(`Generated dispute letter still contains static header hint text before the body: ${remainingHints.slice(0, 3).join(' | ')}`);
  }

  if (nameCount > 1) {
    throw new Error('Generated dispute letter still contains duplicated client header information before the body.');
  }

  if (missingRequired.length) {
    throw new Error(`Generated dispute letter header is missing required value(s): ${missingRequired.slice(0, 4).join(', ')}`);
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
  const changed = region.length ? replaceRegionWithStyledHeader(region, values) : false;
  assertNoHeaderConflict(body, values);

  if (!changed) return { blob, changed: false, reason: 'no conflicting header region found' };

  zip.file('word/document.xml', new XMLSerializer().serializeToString(xml));
  const output = await hardenGeneratedDocx(zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' }));
  return { blob: output, changed: true, reason: 'complete dispute header rebuilt once without consuming letter body' };
}
