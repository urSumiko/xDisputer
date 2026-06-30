import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { hardenGeneratedDocx } from './docx-safety';
import { assertHydrationContract } from './docx-hydration-contract';
import { buildAccountHydrationBlocks, buildInquiryHydrationBlocks } from './dispute-hydration-blocks';
import { createStructuralSnapshot, validateStructuralInvariance } from './docx-structural-guard';
import { applyDocxFlowRulesToBlob, applyLetterFlowRules } from './docx-flow';
import { validateTemplateContentPreserved } from './docx-template-preservation-guard';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const STATEMENT_PREFIX = ['Pursuant to ', '15 USC'].join('');
const IDENTITY_THEFT_DISPUTE_STATEMENT = 'Pursuant to 15 USC 1681a(3), this account does not constitute a legitimate consumer obligation. My personal information was used without authorization, and this tradeline is the direct result of identity theft.';
const DISPUTE_EXCLUDED_ADDRESS_FIELD = /^(?:PHONE(?:\s+NO\.?)?|TELEPHONE|MOBILE|EMAIL|E-?MAIL|COUNTRY|DOB|SSN)\s*:/i;
const ACCOUNT_SECTION_PATTERNS = [
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?(?:DISPUTE(?:D)?\s+ACCOUNTS?(?:\s*(?:&|AND)\s*(?:INFORMATION|ITEMS))?|ACCOUNTS?\s+(?:IN\s+DISPUTE|TO\s+BE\s+DISPUTED)|(?:INACCURATE|UNVERIFIED|NEGATIVE)\s+ACCOUNTS?|FRAUDULENT\s+ACCOUNTS?(?:\s*\([^)]*\))?)(?:\s*[:\-–—].*)?$/i,
  /^.*\bDISPUTE(?:D)?\s+ACCOUNTS?\b.*$/i,
  /^FRAUDULENT\s+ACCOUNTS?\s+.*(?:DELETION|BLOCKING|RE-?ASSERTED).*$/i
];
const HARD_INQUIRY_LABEL = /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?HARD\s+(?:CREDIT\s+)?INQUIR(?:Y|IES)(?:\s*[:\-]\s*(.*))?$/i;
const DOWNSTREAM_SECTION_PATTERNS = [
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?HARD\s+(?:CREDIT\s+)?INQUIR(?:Y|IES)(?:\s*[:\-–—].*)?$/i,
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?FINAL\s+OPPORTUNITY\s+TO\s+COMPLY\b.*$/i,
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?FAILURE\s+TO\s+COMPLY\b.*$/i,
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?IF\s+YOU\s+FAIL\s+TO\s+COMPLY\b.*$/i,
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?LEGAL\s+(?:BASIS|DEMAND)(?:\s+AND\s+NOTICE\s+OF\s+DUTY)?\b.*$/i,
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?MANDATORY\s+DEMANDS?\b.*$/i,
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?REQUEST(?:ED)?\s+ACTION\b.*$/i,
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?NOTICE\s+OF\s+DUTY\b.*$/i,
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?CONSEQUENCES?\s+OF\s+NON-?COMPLIANCE\b.*$/i,
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?ENCLOSURES?\b.*$/i,
  /^(?:(?:[IVXLCDM]+|\d+|[A-Z])\s*[.)]?\s*)?CONCLUSION\b.*$/i,
  /^CLOSING$/i,
  /^GOVERN\s+YOURSELF\s+ACCORDINGLY\.?$/i
];
const NEXT_SECTION_PATTERNS = DOWNSTREAM_SECTION_PATTERNS;
const LEGAL_BOUNDARY_PATTERNS = DOWNSTREAM_SECTION_PATTERNS;
const SIGNATURE_PATTERN = /^(?:Sincerely|Respectfully(?:\s+submitted)?|Best\s+regards|Regards|Yours\s+(?:truly|sincerely)|Very\s+truly\s+yours|Thank\s+you),?$/i;
const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}|\[\[[^\]]+\]\]|«[^»]+»/;
const ACCOUNT_PROTOTYPE_PATTERN = /^(?:Account|Creditor|Furnisher|Company)\s*(?:Name)?\s*:|^Account\s*(?:Number|No\.?|#)\s*:|Account\s+Name\s*[-–—]\s*Account\s*(?:Number|#)/i;
const MASKED_ACCOUNT_LINE_PATTERN = /^[A-Z0-9][A-Z0-9\s&.,'()/\-]+\s+[–—-]\s*(?:[A-Z0-9*X]{2,}|\d{1,2}\/\d{1,2}\/\d{2,4})/i;
const DATE_LIKE_PATTERN = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b20\d{2}\b/i;
const BUREAU_LIKE_PATTERN = /\b(?:TransUnion|Experian|Equifax|Consumer\s+Dispute|PO\s+Box|P\.O\.\s*Box)\b/i;
const STATIC_HEADER_PLACEHOLDER_PATTERN = /^(?:NAME|ADDRESS|CITY,?\s*STATE\s+ZIP|DOB:?|SSN:?|\[DATE\]|\[CREDIT\s+BUREAU\s+NAME\]|\[DISPUTE\s+ADDRESS\])$/i;

export type TemplateValue = string | number | boolean | Array<Record<string, string>>;
export type PlaceholderValues = Record<string, TemplateValue>;
export type ReferenceDisputeValues = {
  consumerName: string;
  addressLines: string[];
  dob: string;
  ssn: string;
  letterDate: string;
  bureauName: string;
  bureauAddressLines: string[];
  disputeItems?: string[];
  hardInquiryItems?: string[];
  fraudItems?: string[];
};

type SectionRegion = { boundary: Node | null; region: Element[]; spacer?: Element };

export async function renderDocxTemplate(template: File, values: PlaceholderValues): Promise<Blob> {
  const zip = new PizZip(await template.arrayBuffer());
  const document = new Docxtemplater(zip, {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => ''
  });
  document.render(values);
  const generated = document.getZip().generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
  const output = await hardenGeneratedDocx(generated);
  return applyDocxFlowRulesToBlob(output);
}

function paragraphs(body: Element) {
  return Array.from(body.children).filter((node) => node.namespaceURI === WORD_NS && node.localName === 'p') as Element[];
}

function content(paragraph: Element) {
  return Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't')).map((node) => node.textContent || '').join('').replace(/\s+/g, ' ').trim();
}

function findParagraph(all: Element[], patterns: RegExp[]) {
  return all.find((paragraph) => patterns.some((pattern) => pattern.test(content(paragraph))));
}

function styleOf(paragraph: Element) {
  const runs = Array.from(paragraph.children).filter((node) => node.namespaceURI === WORD_NS && node.localName === 'r');
  return (runs.find((run) => content(run as Element)) || runs[0] || paragraph.ownerDocument.createElementNS(WORD_NS, 'w:r')).cloneNode(true) as Element;
}

function blankRun(source: Element) {
  const run = source.cloneNode(true) as Element;
  Array.from(run.children).forEach((node) => {
    if (!(node.namespaceURI === WORD_NS && node.localName === 'rPr')) run.removeChild(node);
  });
  return run;
}

function writeLines(paragraph: Element, lines: string[]) {
  const doc = paragraph.ownerDocument;
  const style = styleOf(paragraph);
  Array.from(paragraph.children).forEach((node) => {
    if (!(node.namespaceURI === WORD_NS && node.localName === 'pPr')) paragraph.removeChild(node);
  });
  lines.forEach((line, index) => {
    if (index) {
      const breakRun = blankRun(style);
      breakRun.appendChild(doc.createElementNS(WORD_NS, 'w:br'));
      paragraph.appendChild(breakRun);
    }
    const run = blankRun(style);
    const value = doc.createElementNS(WORD_NS, 'w:t');
    if (/^\s|\s$/.test(line)) value.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    value.textContent = line;
    run.appendChild(value);
    paragraph.appendChild(run);
  });
}

function cloneWithText(source: Element, lines: string[]) {
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

function forceIdentityStatementColor(paragraph: Element) {
  if (!content(paragraph).includes(IDENTITY_THEFT_DISPUTE_STATEMENT)) return paragraph;
  const doc = paragraph.ownerDocument;
  Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 'r')).forEach((run) => {
    let properties = Array.from(run.children).find((node) => node.namespaceURI === WORD_NS && node.localName === 'rPr') as Element | undefined;
    if (!properties) {
      properties = doc.createElementNS(WORD_NS, 'w:rPr');
      run.insertBefore(properties, run.firstChild);
    }
    Array.from(properties.children).filter((node) => node.namespaceURI === WORD_NS && node.localName === 'color').forEach((node) => properties?.removeChild(node));
    const color = doc.createElementNS(WORD_NS, 'w:color');
    color.setAttributeNS(WORD_NS, 'w:val', 'FF0000');
    properties.appendChild(color);
  });
  return paragraph;
}

function cloneStatementWithTemplateStyle(source: Element, lines: string[]) {
  return forceIdentityStatementColor(cloneWithText(source, lines));
}

function paragraphProperties(paragraph: Element) {
  const existing = Array.from(paragraph.children).find((node) => node.namespaceURI === WORD_NS && node.localName === 'pPr') as Element | undefined;
  if (existing) return existing;
  const properties = paragraph.ownerDocument.createElementNS(WORD_NS, 'w:pPr');
  paragraph.insertBefore(properties, paragraph.firstChild);
  return properties;
}

function ensureParagraphProperty(paragraph: Element, localName: string) {
  const properties = paragraphProperties(paragraph);
  const existing = Array.from(properties.children).find((node) => node.namespaceURI === WORD_NS && node.localName === localName) as Element | undefined;
  if (existing) return existing;
  const property = paragraph.ownerDocument.createElementNS(WORD_NS, `w:${localName}`);
  properties.appendChild(property);
  return property;
}

function keepParagraphLinesTogether(paragraph: Element) {
  ensureParagraphProperty(paragraph, 'keepLines');
  ensureParagraphProperty(paragraph, 'widowControl');
}

function keepWithNextParagraph(paragraph: Element) {
  keepParagraphLinesTogether(paragraph);
  ensureParagraphProperty(paragraph, 'keepNext');
}

function keepDisputeBlockTogether(items: Element[]) {
  items.filter(Boolean).forEach((paragraph, index) => {
    if (index < items.length - 1) keepWithNextParagraph(paragraph);
    else keepParagraphLinesTogether(paragraph);
  });
}

function preserveSsnDateBoundary(body: Element, ssnParagraph: Element, dateParagraph: Element) {
  const all = paragraphs(body);
  const ssnIndex = all.indexOf(ssnParagraph);
  const dateIndex = all.indexOf(dateParagraph);
  if (ssnIndex < 0 || dateIndex <= ssnIndex) return;
  keepParagraphLinesTogether(ssnParagraph);
  keepParagraphLinesTogether(dateParagraph);
}

function findPopulatedHeaderParagraphs(body: Element, values: ReferenceDisputeValues) {
  const all = paragraphs(body);
  const ssnParagraph = all.find((paragraph) => /\bSSN\s*:/i.test(content(paragraph)) && content(paragraph).includes(values.ssn));
  if (!ssnParagraph) return null;
  const index = all.indexOf(ssnParagraph);
  const dateParagraph = all.slice(index + 1).find((paragraph) => content(paragraph).includes(values.letterDate));
  return dateParagraph ? { ssnParagraph, dateParagraph } : null;
}

function removeHardInquiryLabels(body: Element) {
  paragraphs(body).filter((paragraph) => HARD_INQUIRY_LABEL.test(content(paragraph))).forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
}

async function finalizeRenderedDisputeTemplate(blob: Blob, values: ReferenceDisputeValues, sourceXmlForPreservation?: string) {
  assertHydrationContract();
  const zip = new PizZip(await blob.arrayBuffer());
  const file = zip.file('word/document.xml');
  if (!file) return blob;
  const originalXml = file.asText();
  const snapshot = createStructuralSnapshot(originalXml);
  const xml = new DOMParser().parseFromString(originalXml, 'application/xml');
  const body = xml.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) return blob;
  const header = findPopulatedHeaderParagraphs(body, values);
  if (header) preserveSsnDateBoundary(body, header.ssnParagraph, header.dateParagraph);
  removeHardInquiryLabels(body);
  applyLetterFlowRules(body);
  paragraphs(body).forEach(forceIdentityStatementColor);
  const outputXml = new XMLSerializer().serializeToString(xml);
  validateStructuralInvariance(snapshot, outputXml);
  if (sourceXmlForPreservation) validateTemplateContentPreserved(sourceXmlForPreservation, outputXml, { maxMissingRatio: 0.2 });
  zip.file('word/document.xml', outputXml);
  return hardenGeneratedDocx(zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' }));
}

function resolved(values: ReferenceDisputeValues) {
  if (values.disputeItems || values.hardInquiryItems) return { accounts: values.disputeItems || [], inquiries: values.hardInquiryItems || [] };
  const combined = values.fraudItems || [];
  return {
    accounts: combined.filter((entry) => /^(Account|Creditor)\s+Name\s*:/i.test(entry.trim())),
    inquiries: combined.filter((entry) => !/^(Account|Creditor)\s+Name\s*:/i.test(entry.trim()))
  };
}

function disputeAddressLines(values: ReferenceDisputeValues) {
  return values.addressLines.map((line) => line.trim()).filter(Boolean).filter((line) => !DISPUTE_EXCLUDED_ADDRESS_FIELD.test(line));
}

function accountValues(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const accountName = (lines.find((line) => /^(?:Account|Creditor)\s+Name\s*:/i.test(line)) || '').replace(/^(?:Account|Creditor)\s+Name\s*:\s*/i, '');
  const accountNumber = (lines.find((line) => /^Account\s+Number\s*:/i.test(line)) || '').replace(/^Account\s+Number\s*:\s*/i, '');
  return {
    account_name: accountName,
    account_number: accountNumber,
    account_line: [accountName, accountNumber].filter(Boolean).join(' - '),
    display_text: text,
    statement_line: IDENTITY_THEFT_DISPUTE_STATEMENT,
    legal_statement: IDENTITY_THEFT_DISPUTE_STATEMENT,
    dispute_statement: IDENTITY_THEFT_DISPUTE_STATEMENT
  };
}

function inquiryValues(text: string) {
  const clean = text.replace(/\s*[–—]\s*/g, ' — ').replace(/\s+/g, ' ').trim();
  const match = clean.match(/^(.+?)\s+[—-]\s+(.+)$/);
  const inquiryName = match?.[1]?.trim() || clean;
  const inquiryDate = match?.[2]?.trim() || '';
  return {
    inquiry_name: inquiryName,
    inquiry_date: inquiryDate,
    inquiry_line: clean,
    account_name: inquiryName,
    account_number: inquiryDate,
    account_line: clean,
    display_text: clean,
    statement_line: IDENTITY_THEFT_DISPUTE_STATEMENT,
    legal_statement: IDENTITY_THEFT_DISPUTE_STATEMENT,
    dispute_statement: IDENTITY_THEFT_DISPUTE_STATEMENT
  };
}

function disputePlaceholderValues(values: ReferenceDisputeValues): PlaceholderValues {
  const source = resolved(values);
  const address = disputeAddressLines(values);
  const accounts = source.accounts.map(accountValues);
  const inquiries = source.inquiries.map(inquiryValues);
  const combinedItems = [...accounts, ...inquiries];
  return {
    consumer_name: values.consumerName,
    client_name: values.consumerName,
    name: values.consumerName,
    address: address.join('\n'),
    address_inline: address.join(' '),
    address_line_1: address[0] || '',
    address_line_2: address.slice(1).join(' '),
    dob: values.dob,
    ssn: values.ssn,
    ssn_masked: values.ssn,
    date: values.letterDate,
    letter_date: values.letterDate,
    document_date: values.letterDate,
    bureau_name: values.bureauName,
    bureau_address: values.bureauAddressLines.join('\n'),
    bureau_address_line_1: values.bureauAddressLines[0] || '',
    bureau_address_line_2: values.bureauAddressLines.slice(1).join(' '),
    accounts: combinedItems,
    dispute_accounts: combinedItems,
    hard_inquiries: inquiries,
    account_lines: combinedItems.map((item) => [item.display_text, item.statement_line].join('\n')).join('\n\n'),
    hard_inquiry_lines: inquiries.map((item) => [item.display_text, item.statement_line].join('\n')).join('\n\n')
  };
}

function terminalBodyBoundary(body: Element) {
  return Array.from(body.children).find((node) => node.namespaceURI === WORD_NS && node.localName === 'sectPr') || null;
}

function indexOf(all: Element[], paragraph: Element | null | undefined) {
  return paragraph ? all.indexOf(paragraph) : -1;
}

function isSectionBoundary(value: string) {
  return NEXT_SECTION_PATTERNS.some((pattern) => pattern.test(value)) || LEGAL_BOUNDARY_PATTERNS.some((pattern) => pattern.test(value)) || SIGNATURE_PATTERN.test(value);
}

function isStatementPrototype(value: string) {
  return value.startsWith(STATEMENT_PREFIX) || value === IDENTITY_THEFT_DISPUTE_STATEMENT;
}

function isAccountPrototype(value: string) {
  return PLACEHOLDER_PATTERN.test(value) || ACCOUNT_PROTOTYPE_PATTERN.test(value) || MASKED_ACCOUNT_LINE_PATTERN.test(value);
}

function isInquiryPrototype(value: string) {
  return PLACEHOLDER_PATTERN.test(value) || HARD_INQUIRY_LABEL.test(value) || /^.+\s+[–—-]\s+\d{1,2}\/\d{1,2}\/\d{2,4}$/i.test(value);
}

function replacementRegionAfter(all: Element[], start: Element | null | undefined, preferredBoundary: Node | null | undefined, kind: 'account' | 'inquiry'): SectionRegion {
  if (!start) return { boundary: preferredBoundary || null, region: [] };
  const startIndex = indexOf(all, start);
  if (startIndex < 0) return { boundary: preferredBoundary || null, region: [] };
  const preferredIndex = preferredBoundary instanceof Element ? all.indexOf(preferredBoundary) : -1;
  const region: Element[] = [];
  let started = false;
  let boundary: Node | null = preferredBoundary || null;

  for (let pointer = startIndex + 1; pointer < all.length; pointer += 1) {
    const paragraph = all[pointer];
    if (preferredIndex >= 0 && pointer >= preferredIndex) {
      boundary = preferredBoundary || paragraph;
      break;
    }

    const value = content(paragraph);
    if (value && isSectionBoundary(value)) {
      boundary = paragraph;
      break;
    }

    if (!value) {
      region.push(paragraph);
      continue;
    }

    const isPrototype = kind === 'account' ? isAccountPrototype(value) : isInquiryPrototype(value);
    if (isPrototype || (started && isStatementPrototype(value))) {
      region.push(paragraph);
      started = true;
      continue;
    }

    boundary = paragraph;
    break;
  }

  const spacer = region.find((paragraph) => !content(paragraph));
  return { boundary, region, spacer };
}

function styleFrom(region: Element[], heading: Element | null | undefined, fallback: Node | null | undefined) {
  return region.find((paragraph) => {
    const value = content(paragraph);
    return value && !isStatementPrototype(value) && !HARD_INQUIRY_LABEL.test(value) && !PLACEHOLDER_PATTERN.test(value);
  }) || heading || (fallback instanceof Element ? fallback : undefined) || region.find((paragraph) => content(paragraph)) || undefined;
}

function statementStyleFrom(region: Element[], fallback: Element) {
  return region.find((paragraph) => isStatementPrototype(content(paragraph))) || fallback;
}

function insertBefore(body: Element, boundary: Node | null | undefined, node: Node) {
  if (boundary && boundary.parentNode === body) return body.insertBefore(node, boundary);
  return body.appendChild(node);
}

function addSpacer(body: Element, boundary: Node | null | undefined, sourceSpacer: Element | undefined, fallbackStyle: Element) {
  insertBefore(body, boundary, sourceSpacer ? sourceSpacer.cloneNode(true) : blankParagraphLike(fallbackStyle));
}

function removeRegion(region: Element[]) {
  region.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
}

function insertMappedDisputeItems(body: Element, source: { accounts: string[]; inquiries: string[] }, bureauName: string) {
  if (!source.accounts.length && !source.inquiries.length) throw new Error('No matching account or inquiry records were found.');
  const accountBlocks = buildAccountHydrationBlocks({ bureau: bureauName, accounts: source.accounts, statement: IDENTITY_THEFT_DISPUTE_STATEMENT });
  const inquiryBlocks = buildInquiryHydrationBlocks({ bureau: bureauName, inquiries: source.inquiries, statement: IDENTITY_THEFT_DISPUTE_STATEMENT });
  const all = paragraphs(body);
  const accountHeading = findParagraph(all, ACCOUNT_SECTION_PATTERNS);
  const hardInquiryHeading = findParagraph(all, [HARD_INQUIRY_LABEL]);
  const legalBoundary = findParagraph(all, LEGAL_BOUNDARY_PATTERNS);
  const signatureBoundary = all.find((paragraph) => SIGNATURE_PATTERN.test(content(paragraph)));
  const terminalBoundary = terminalBodyBoundary(body);
  const fallbackBoundary = legalBoundary || signatureBoundary || terminalBoundary;

  if (accountBlocks.length && !accountHeading) throw new Error('Disputed accounts anchor was not found in the latest DOCX template.');

  const accountRegion = replacementRegionAfter(all, accountHeading, hardInquiryHeading || fallbackBoundary, 'account');
  const accountStyle = styleFrom(accountRegion.region, accountHeading, accountRegion.boundary);
  if (!accountStyle) throw new Error('Disputed accounts template style could not be detected.');
  const accountStatementStyle = statementStyleFrom(accountRegion.region, accountStyle);
  removeRegion(accountRegion.region);

  if (accountBlocks.length) {
    addSpacer(body, accountRegion.boundary, accountRegion.spacer, accountStyle);
    accountBlocks.forEach((block) => {
      const accountParagraph = cloneWithText(accountStyle, block.lines);
      const statementParagraph = cloneStatementWithTemplateStyle(accountStatementStyle, [block.statement]);
      keepDisputeBlockTogether([accountParagraph, statementParagraph]);
      insertBefore(body, accountRegion.boundary, accountParagraph);
      insertBefore(body, accountRegion.boundary, statementParagraph);
      addSpacer(body, accountRegion.boundary, accountRegion.spacer, accountStyle);
    });
  }

  if (!inquiryBlocks.length) return;
  const refreshed = paragraphs(body);
  const currentHardInquiryHeading = findParagraph(refreshed, [HARD_INQUIRY_LABEL]);
  const inquiryBoundaryFallback = legalBoundary || signatureBoundary || terminalBoundary || accountRegion.boundary;
  const inquiryRegion = replacementRegionAfter(refreshed, currentHardInquiryHeading, inquiryBoundaryFallback, 'inquiry');
  const inquiryStyle = styleFrom(inquiryRegion.region, currentHardInquiryHeading || accountStyle, inquiryRegion.boundary) || accountStyle;
  const inquiryStatementStyle = statementStyleFrom(inquiryRegion.region, accountStatementStyle);
  removeRegion(inquiryRegion.region);
  addSpacer(body, inquiryRegion.boundary, inquiryRegion.spacer || accountRegion.spacer, inquiryStyle);
  inquiryBlocks.forEach((block) => {
    const inquiryParagraph = cloneWithText(inquiryStyle, block.lines);
    const statementParagraph = cloneStatementWithTemplateStyle(inquiryStatementStyle, [block.statement]);
    keepDisputeBlockTogether([inquiryParagraph, statementParagraph]);
    insertBefore(body, inquiryRegion.boundary, inquiryParagraph);
    insertBefore(body, inquiryRegion.boundary, statementParagraph);
    addSpacer(body, inquiryRegion.boundary, inquiryRegion.spacer || accountRegion.spacer, inquiryStyle);
  });
}

function firstContentNode(body: Element) {
  return paragraphs(body).find((paragraph) => content(paragraph)) || terminalBodyBoundary(body) || null;
}

function headerCanBeOverwritten(nonEmpty: Element[], accountHeading: Element | undefined) {
  if (nonEmpty.length < 3) return false;
  const accountIndex = accountHeading ? nonEmpty.indexOf(accountHeading) : -1;
  const headerBeforeAccount = accountIndex < 0 || accountIndex > 2;
  const first = content(nonEmpty[0]);
  const second = content(nonEmpty[1]);
  const third = content(nonEmpty[2]);
  return headerBeforeAccount && /\b(?:DOB|SSN|Address|Street|Ave|Road|Rd|Blvd|Drive|Dr|Lane|Ln|FL|CA|TX|NY|GA|AL|AZ|USA)\b/i.test(first) && DATE_LIKE_PATTERN.test(second) && BUREAU_LIKE_PATTERN.test(third);
}

function insertGeneratedHeader(body: Element, reference: Node | null, style: Element, values: ReferenceDisputeValues) {
  const client = cloneWithText(style, [values.consumerName, ...disputeAddressLines(values), `DOB: ${values.dob}`, `SSN: ${values.ssn}`]);
  const date = cloneWithText(style, [values.letterDate]);
  const bureau = cloneWithText(style, [values.bureauName, ...values.bureauAddressLines]);
  [client, date, bureau, blankParagraphLike(style)].forEach((paragraph) => insertBefore(body, reference, paragraph));
  preserveSsnDateBoundary(body, client, date);
}

function findStaticHeaderRegion(body: Element) {
  const all = paragraphs(body);
  const first = all.findIndex((paragraph) => /^NAME$/i.test(content(paragraph)));
  if (first < 0) return null;

  const region: Element[] = [];
  for (let index = first; index < all.length; index += 1) {
    const paragraph = all[index];
    const value = content(paragraph);

    if (!value) {
      region.push(paragraph);
      continue;
    }

    if (/^RE:/i.test(value) || ACCOUNT_SECTION_PATTERNS.some((pattern) => pattern.test(value))) break;

    if (STATIC_HEADER_PLACEHOLDER_PATTERN.test(value)) {
      region.push(paragraph);
      continue;
    }

    break;
  }

  const keys = region
    .map((paragraph) => content(paragraph).replace(/[\[\]]/g, '').replace(/\s+/g, ' ').replace(/:$/, '').trim().toUpperCase())
    .filter(Boolean);

  const hasClientBlock = keys.includes('NAME') && keys.includes('ADDRESS');
  const hasDateBlock = keys.includes('DATE');
  const hasBureauBlock = keys.includes('CREDIT BUREAU NAME') || keys.includes('DISPUTE ADDRESS');

  return hasClientBlock && hasDateBlock && hasBureauBlock ? region : null;
}

function replaceStaticHeaderRegion(body: Element, region: Element[], values: ReferenceDisputeValues) {
  const style = region.find((paragraph) => content(paragraph)) || region[0];
  const reference = region[0];

  const client = cloneWithText(style, [
    values.consumerName,
    ...disputeAddressLines(values),
    `DOB: ${values.dob}`,
    `SSN: ${values.ssn}`
  ]);
  const date = cloneWithText(style, [values.letterDate]);
  const bureau = cloneWithText(style, [values.bureauName, ...values.bureauAddressLines]);
  const spacer = blankParagraphLike(style);

  [client, date, bureau, spacer].forEach((paragraph) => reference.parentNode?.insertBefore(paragraph, reference));
  region.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
  preserveSsnDateBoundary(body, client, date);
}

function hydrateLegacyHeader(body: Element, values: ReferenceDisputeValues) {
  const staticHeaderRegion = findStaticHeaderRegion(body);
  if (staticHeaderRegion) {
    replaceStaticHeaderRegion(body, staticHeaderRegion, values);
    return;
  }

  const all = paragraphs(body);
  const nonEmpty = all.filter((paragraph) => content(paragraph));
  const accountHeading = findParagraph(all, ACCOUNT_SECTION_PATTERNS);
  if (headerCanBeOverwritten(nonEmpty, accountHeading)) {
    writeLines(nonEmpty[0], [values.consumerName, ...disputeAddressLines(values), `DOB: ${values.dob}`, `SSN: ${values.ssn}`]);
    writeLines(nonEmpty[1], [values.letterDate]);
    writeLines(nonEmpty[2], [values.bureauName, ...values.bureauAddressLines]);
    preserveSsnDateBoundary(body, nonEmpty[0], nonEmpty[1]);
    return;
  }

  const reference = firstContentNode(body);
  const style = nonEmpty[0] || body.ownerDocument.createElementNS(WORD_NS, 'w:p');
  insertGeneratedHeader(body, reference, style, values);
}

function replaceSignature(body: Element, values: ReferenceDisputeValues) {
  const renderedParagraphs = paragraphs(body);
  const close = renderedParagraphs.find((paragraph) => SIGNATURE_PATTERN.test(content(paragraph)));
  if (!close) return;
  const signature = renderedParagraphs.slice(renderedParagraphs.indexOf(close) + 1).find((paragraph) => content(paragraph));
  if (signature) writeLines(signature, [values.consumerName]);
}

export async function renderReferenceDisputeDocx(reference: File, values: ReferenceDisputeValues): Promise<Blob> {
  assertHydrationContract();
  const zip = new PizZip(await reference.arrayBuffer());
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('DOCX document XML is unavailable.');
  const documentXml = file.asText();

  if (/\{\{\s*[#/^]?[\w.-]+\s*\}\}/.test(documentXml)) {
    const rendered = await renderDocxTemplate(reference, disputePlaceholderValues(values));
    return finalizeRenderedDisputeTemplate(rendered, values, documentXml);
  }

  const snapshot = createStructuralSnapshot(documentXml);
  const xml = new DOMParser().parseFromString(documentXml, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw new Error('DOCX content could not be read.');
  const body = xml.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) throw new Error('DOCX body is unavailable.');

  const source = resolved(values);
  hydrateLegacyHeader(body, values);
  insertMappedDisputeItems(body, source, values.bureauName);
  replaceSignature(body, values);
  applyLetterFlowRules(body);
  paragraphs(body).forEach(forceIdentityStatementColor);

  const outputXml = new XMLSerializer().serializeToString(xml);
  validateStructuralInvariance(snapshot, outputXml);
  validateTemplateContentPreserved(documentXml, outputXml, { maxMissingRatio: 0.18 });
  zip.file('word/document.xml', outputXml);
  return hardenGeneratedDocx(zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' }));
}

export function isDocx(filename: string) {
  return /\.docx$/i.test(filename);
}
