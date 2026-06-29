const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

type PreservationOptions = {
  ignoredPatterns?: RegExp[];
  minimumTextLength?: number;
  maxMissingRatio?: number;
};

const DEFAULT_IGNORED_PATTERNS: RegExp[] = [
  /\{\{[^}]+\}\}|\[\[[^\]]+\]\]|«[^»]+»/,
  /^(?:Account|Creditor|Furnisher|Company)\s*(?:Name)?\s*:/i,
  /^Account\s*(?:Number|No\.?|#)\s*:/i,
  /^\s*(?:X{2,}|\d{2,}).*(?:X{2,}|\d{2,})\s*$/i,
  /Account\s+Name\s*[-–—]\s*Account\s*(?:Number|#)/i,
  /^\s*(?:DOB|SSN|Date)\s*:/i
];

function parseXml(xmlText: string) {
  return new DOMParser().parseFromString(xmlText, 'application/xml');
}

function paragraphTexts(xmlText: string) {
  const xml = parseXml(xmlText);
  if (xml.getElementsByTagName('parsererror').length) return [] as string[];
  return Array.from(xml.getElementsByTagNameNS(WORD_NS, 'p'))
    .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't')).map((node) => node.textContent || '').join('').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function shouldIgnore(value: string, options: PreservationOptions) {
  const ignoredPatterns = [...DEFAULT_IGNORED_PATTERNS, ...(options.ignoredPatterns || [])];
  return ignoredPatterns.some((pattern) => pattern.test(value));
}

export function validateTemplateContentPreserved(beforeXmlText: string, afterXmlText: string, options: PreservationOptions = {}) {
  const minimumTextLength = options.minimumTextLength ?? 18;
  const before = unique(paragraphTexts(beforeXmlText).map(normalize))
    .filter((value) => value.length >= minimumTextLength)
    .filter((value) => !shouldIgnore(value, options));

  if (!before.length) return true;

  const afterCombined = normalize(paragraphTexts(afterXmlText).join(' ')).toUpperCase();
  const missing = before.filter((value) => !afterCombined.includes(value.toUpperCase()));
  const maxMissingRatio = options.maxMissingRatio ?? 0.16;
  const maxAllowedMissing = Math.max(2, Math.floor(before.length * maxMissingRatio));

  if (missing.length > maxAllowedMissing) {
    throw new Error(`Generated DOCX failed template preservation proof. Missing protected template content: ${missing.slice(0, 4).join(' | ')}`);
  }

  return true;
}
