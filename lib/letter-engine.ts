export type Bureau = 'TRANSUNION' | 'EQUIFAX' | 'EXPERIAN';
export type LetterType = 'DISPUTE' | 'LATE_PAYMENT';
export type ItemType = 'DISPUTE_ACCOUNT' | 'HARD_INQUIRY' | 'LATE_PAYMENT';

export type FtcDerivedFields = { dateDiscovered: string; fraudulentAmount: string };
export type FtcAffectedAccount = { accountName: string; accountNumber: string; fraudBegan: string; dateDiscovered: string; fraudulentAmount: string };
export type SourceItem = { type: ItemType; displayText: string; ftcDerived?: FtcDerivedFields };
export type ParseDiagnostic = { level: 'warning' | 'info'; message?: string; line?: number };
export type PreservedSourceLine = { line: number; text: string; reason: string };
export type ParsedSource = {
  name: string; firstName: string; middleName: string; lastName: string;
  address: string[]; country: string; dob: string; ssn: string; phone: string; email: string;
  affidavitState: string; affidavitCounty: string;
  ftcReportNumber: string; ftcReportDate: string; ftcAccounts: FtcAffectedAccount[];
  templateFields: Record<string, string>;
  dispute: Record<Bureau, SourceItem[]>; inquiry: Record<Bureau, SourceItem[]>; late: Record<Bureau, SourceItem[]>;
  preserved: PreservedSourceLine[]; diagnostics: ParseDiagnostic[];
};
export type LetterRoute = { bureau: Bureau; type: LetterType; items: SourceItem[]; reason: string };
export type NormalizedSourceCopy = { text: string; usedFields: string[]; reservedFields: string[]; preservedLines: PreservedSourceLine[] };

export const bureaus: Bureau[] = ['TRANSUNION', 'EQUIFAX', 'EXPERIAN'];
export const MAX_FTC_ACCOUNTS = 0;
export const bureauInfo: Record<Bureau, { name: string; address: string }> = {
  TRANSUNION: { name: 'TransUnion LLC Consumer Dispute Center', address: 'PO Box 2000\nChester, PA 19016' },
  EQUIFAX: { name: 'Equifax Information Services LLC', address: 'PO Box 105139\nAtlanta, GA 30348' },
  EXPERIAN: { name: 'Experian', address: 'PO Box 4500\nAllen, TX 75013' }
};

type Section = 'header' | 'dispute' | 'inquiry' | 'late' | 'ignore' | 'discard';
type ItemStore = Record<Bureau, SourceItem[]>;

const DATE_PATTERN = /\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:\d{2}|\d{4})\b/;
const WORD_MONTH_DATE_PATTERN = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+([0-3]?\d)(?:st|nd|rd|th)?\s*,?\s*(\d{2}|\d{4})\b/gi;
const ACCOUNT_NAME = /^(?:ACCOUNT|CREDITOR|FURNISHER|COMPANY)(?:\s*(?:OR\s+ORGANIZATION))?\s*(?:NAME)?\s*[:#-]\s*(.+)$/i;
const ACCOUNT_NUMBER = /^(?:ACCOUNT|ACCT)\s*(?:NUMBER|NO\.?|#)\s*[:#-]\s*(.*)$/i;
const TEMPLATE_FIELD = /^TEMPLATE\s+FIELD\s+([\w.-]+)\s*:\s*(.*)$/i;
const PHONE_FIELD = /^(?:PHONE(?:\s+NO\.?)?|TELEPHONE|MOBILE)\s*:\s*/i;
const KNOWN_HEADER = /^(NAME|CLIENT|CONSUMER(?:\s+NAME)?|FIRST\s+NAME|MIDDLE\s+NAME|LAST\s+NAME|ADDRESS|COUNTRY|DOB|SSN|PHONE(?:\s+NO\.?)?|TELEPHONE|MOBILE|EMAIL|E-?MAIL|AFFIDAVIT\s+STATE|AFFIDAVIT\s+COUNTY|FTC\s+REPORT\s+NUMBER|FTC\s+REPORT\s+DATE|TEMPLATE\s+FIELD\s+[\w.-]+)\s*:/i;
const RESERVED_HEADER = /^(PHONE(?:\s+NO\.?)?|TELEPHONE|MOBILE|EMAIL|E-?MAIL|COUNTRY|FTC\s+REPORT\s+NUMBER|FTC\s+REPORT\s+DATE)\s*:/i;
const FTC_HEADING = /^(FTC\s+IDENTITY\s+THEFT\s+REPORT|FTC\s+AFFECTED\s+ACCOUNTS?|AFFECTED\s+ACCOUNTS?)$/;
const MONTH_NUMBER: Record<string, number> = { JAN: 1, JANUARY: 1, FEB: 2, FEBRUARY: 2, MAR: 3, MARCH: 3, APR: 4, APRIL: 4, MAY: 5, JUN: 6, JUNE: 6, JUL: 7, JULY: 7, AUG: 8, AUGUST: 8, SEP: 9, SEPT: 9, SEPTEMBER: 9, OCT: 10, OCTOBER: 10, NOV: 11, NOVEMBER: 11, DEC: 12, DECEMBER: 12 };

function itemMap(): ItemStore { return { TRANSUNION: [], EQUIFAX: [], EXPERIAN: [] }; }
function normalized(value: string) { return value.replace(/[\[\]{}()=*#_]+/g, ' ').replace(/[:\-|/]+$/g, '').replace(/[\-_]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase(); }
function safeLine(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function maskedAccountNumber(value: string) { return value.replace(/x/gi, 'X'); }

/** FTC is intentionally inactive in the active product workflow. These compatibility helpers stay inert for older imports. */
export function automatedFtcReportDate() { return ''; }
export function ftcFraudMonthYearFromReportDate(_reportDate = '') { return ''; }
export function currentFtcFraudMonthYear() { return ''; }
export function validFtcAccounts(_items: FtcAffectedAccount[]) { return false; }

function bureauIn(value: string): Bureau | '' {
  const key = normalized(value);
  if (/\b(TRANS\s*UNION|TRANSUNION|TU)\b/.test(key)) return 'TRANSUNION';
  if (/\b(EQUIFAX|EQ)\b/.test(key)) return 'EQUIFAX';
  if (/\b(EXPERIAN|EXP)\b/.test(key)) return 'EXPERIAN';
  return '';
}
function isBureauHeading(value: string) { return /^(TRANS\s*UNION|TRANSUNION|TU|EQUIFAX|EQ|EXPERIAN|EXP)$/.test(normalized(value).replace(/^(CREDIT\s+)?BUREAU\s+/, '')); }
function sectionOf(value: string): Section | '' {
  const key = normalized(value);
  if (FTC_HEADING.test(key)) return 'discard';
  if (/^(PRESERVED\s+SOURCE\s+DATA|SUPPLEMENTAL\s+CLIENT\s+DATA|UNMAPPED\s+SOURCE\s+TEXT)/.test(key)) return 'ignore';
  if (/\b(HARD\s*(INQ|INQUIRY|INQUIRIES|INQUIRES)|INQUIRY\s+REMOVAL)\b/.test(key)) return 'inquiry';
  if (/\b(LATE\s*(PAY|PAYMENT|PAYMENTS)|PAYMENT\s+HISTORY\s+DISPUTE)\b/.test(key)) return 'late';
  if (/\b(FOR\s+DISPUTE|DISPUTE\s+(ACCOUNTS?|ITEMS?|RECORDS?|LETTERS?)|FRAUDULENT\s+ACCOUNTS?|IDENTITY\s+THEFT\s+ACCOUNTS?)\b/.test(key) || /^(DISPUTE|DISPUTES)$/.test(key)) return 'dispute';
  if (/^(OPEN\s+ACCOUNTS?|PERSONAL\s+INFORMATION|EMPLOYMENT|SUMMARY|NOTES?)$/.test(key)) return 'ignore';
  return '';
}
function isSectionHeading(value: string, section: Section) {
  const key = normalized(value);
  if (section === 'discard') return FTC_HEADING.test(key);
  if (section === 'ignore') return true;
  if (section === 'inquiry') return key.length < 64 && /HARD\s*(INQ|INQUIRY|INQUIRIES|INQUIRES)|INQUIRY\s+REMOVAL/.test(key);
  if (section === 'late') return key.length < 68 && /LATE\s*(PAY|PAYMENT|PAYMENTS)|PAYMENT\s+HISTORY\s+DISPUTE/.test(key);
  return key.length < 76 && /DISPUTE|FRAUDULENT\s+ACCOUNTS?|IDENTITY\s+THEFT\s+ACCOUNTS?/.test(key);
}
function isNoData(value: string) { return /^(N+ONE|NONE|NO\s+(ACCOUNT|ACCOUNTS|ITEM|ITEMS|LATE\s+PAYMENTS?|HARD\s+INQUIR(?:Y|IES|ES))|N\/?A|NOTHING|NOT\s+APPLICABLE)$/i.test(normalized(value)); }
function cleanLines(lines: string[]) { return lines.map(safeLine).filter(Boolean).filter((line) => !isNoData(line)); }
function fieldValue(lines: string[], pattern: RegExp) { for (const line of lines) { const match = line.match(pattern); if (match && match[1] !== undefined) return safeLine(match[1]); } return ''; }
function displayAccount(lines: string[]) { const clean = cleanLines(lines); const name = fieldValue(clean, ACCOUNT_NAME); const number = maskedAccountNumber(fieldValue(clean, ACCOUNT_NUMBER)); return name || number ? [name ? `Account Name: ${name}` : '', number ? `Account Number: ${number}` : ''].filter(Boolean).join('\n') : ''; }
function lateDisplayText(lines: string[]) { const clean = cleanLines(lines); const base = displayAccount(clean); const relevant = clean.filter((line) => /late|payment|30\s*day|60\s*day|90\s*day|120\s*day/i.test(line)); return [base, ...relevant.filter((line) => !ACCOUNT_NAME.test(line) && !ACCOUNT_NUMBER.test(line))].filter(Boolean).join('\n'); }
function normalizeYear(value: string) { return value.length === 2 ? `20${value}` : value; }
function normalizeWordMonthDates(value: string) {
  return value.replace(WORD_MONTH_DATE_PATTERN, (_match, month: string, day: string, year: string) => {
    const number = MONTH_NUMBER[String(month).replace(/\.$/, '').toUpperCase()];
    return number ? `${number}/${Number(day)}/${normalizeYear(String(year))}` : String(_match);
  });
}
function normalizeNumericDates(value: string) {
  return value.replace(DATE_PATTERN, (match) => {
    const parts = match.split(/[\/-]/);
    if (parts.length !== 3) return match;
    return `${Number(parts[0])}/${Number(parts[1])}/${normalizeYear(parts[2])}`;
  });
}
function normalizeHardInquiryDates(value: string) { return normalizeNumericDates(normalizeWordMonthDates(value)); }
function hasHardInquiryDate(value: string) { return DATE_PATTERN.test(value) || new RegExp(WORD_MONTH_DATE_PATTERN.source, 'i').test(value); }
function stripPreservedLinePrefix(value: string) { return value.replace(/^(?:\s*\[LINE\s+\d+\]\s*)+/gi, '').trim(); }
function isMappedHardInquiryLine(value: string) { const clean = stripPreservedLinePrefix(value); return hasHardInquiryDate(clean) && /\S+\s+[-–—]\s+/.test(clean); }
function inquiryDisplayText(lines: string[]) { const joined = cleanLines(lines).join(' - '); return hasHardInquiryDate(joined) ? normalizeHardInquiryDates(joined).replace(/\s*[-–—]\s*/g, ' - ').replace(/\s+/g, ' ').trim() : ''; }
function createItem(type: ItemType, lines: string[]): SourceItem | null { const displayText = type === 'DISPUTE_ACCOUNT' ? displayAccount(lines) : type === 'HARD_INQUIRY' ? inquiryDisplayText(lines) : lateDisplayText(lines); return displayText ? { type, displayText } : null; }
function appendSourceItem(target: SourceItem[], item: SourceItem | null) { if (item) target.push(item); }
function headerField(lines: string[], label: RegExp) { const line = lines.find((entry) => label.test(entry)); return line ? line.replace(label, '').trim() : ''; }
function looksLikeRecord(line: string) { return ACCOUNT_NAME.test(line) || ACCOUNT_NUMBER.test(line) || hasHardInquiryDate(line); }
function pushPreserved(parsed: ParsedSource, line: number, text: string, reason: string) { if (isMappedHardInquiryLine(text)) return; if (!parsed.preserved.some((item) => item.line === line && item.text === text)) parsed.preserved.push({ line, text, reason }); }
function splitName(name: string) { const parts = safeLine(name).split(' ').filter(Boolean); return { firstName: parts[0] || '', middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '', lastName: parts.length > 1 ? parts[parts.length - 1] : '' }; }
function emptyParsed(): ParsedSource { return { name: '', firstName: '', middleName: '', lastName: '', address: [], country: '', dob: '', ssn: '', phone: '', email: '', affidavitState: '', affidavitCounty: '', ftcReportNumber: '', ftcReportDate: '', ftcAccounts: [], templateFields: {}, dispute: itemMap(), inquiry: itemMap(), late: itemMap(), preserved: [], diagnostics: [] }; }

export function parseSource(text: string): ParsedSource {
  const parsed = emptyParsed();
  const header: Array<{ text: string; line: number }> = [];
  let section: Section = 'header';
  let bureau: Bureau | '' = '';
  let buffer: string[] = [];
  let bufferLine = 0;

  const flush = () => {
    if (!buffer.length) return;
    if (section === 'discard') { buffer = []; return; }
    if (!bureau || (section !== 'dispute' && section !== 'late')) {
      if (buffer.some(looksLikeRecord)) parsed.diagnostics.push({ level: 'warning', message: 'Account-like text was ignored because its bureau or category was not identified.', line: bufferLine });
      buffer = [];
      return;
    }
    const created = createItem(section === 'dispute' ? 'DISPUTE_ACCOUNT' : 'LATE_PAYMENT', buffer);
    if (created) appendSourceItem(section === 'dispute' ? parsed.dispute[bureau] : parsed.late[bureau], created);
    else if (buffer.some(looksLikeRecord)) parsed.diagnostics.push({ level: 'warning', message: `${section === 'dispute' ? 'Dispute' : 'Late-payment'} record in ${bureau} is missing a usable account name or account number.`, line: bufferLine });
    buffer = [];
  };

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    const lineNumber = index + 1;
    if (!line) { flush(); return; }

    const detectedSection = sectionOf(line);
    const detectedBureau = bureauIn(line);
    const heading = detectedSection && isSectionHeading(line, detectedSection);
    const bureauHeading = detectedBureau && (isBureauHeading(line) || Boolean(heading));

    if (heading || bureauHeading) {
      flush();
      if (heading) section = detectedSection;
      if (bureauHeading) bureau = detectedBureau;
      return;
    }

    if (section === 'header' && !bureau) { header.push({ text: line, line: lineNumber }); return; }
    if (section === 'discard') return;
    if (section === 'ignore') { pushPreserved(parsed, lineNumber, line, 'Supplemental or unmapped source data: not inserted unless a document maps it.'); return; }
    if (section === 'inquiry') {
      if (!bureau) { if (hasHardInquiryDate(line)) parsed.diagnostics.push({ level: 'warning', message: 'Hard inquiry ignored because no bureau heading was identified.', line: lineNumber }); else pushPreserved(parsed, lineNumber, line, 'Unrecognized hard-inquiry text.'); return; }
      if (hasHardInquiryDate(line)) appendSourceItem(parsed.inquiry[bureau], createItem('HARD_INQUIRY', [line]));
      else if (!isNoData(line)) { parsed.diagnostics.push({ level: 'warning', message: `Hard inquiry in ${bureau} must include a date on the same line: COMPANY - MM/DD/YYYY or COMPANY - Month D, YYYY.`, line: lineNumber }); pushPreserved(parsed, lineNumber, line, 'Inquiry retained for manual review.'); }
      return;
    }
    if ((section === 'dispute' || section === 'late') && bureau) { if (ACCOUNT_NAME.test(line) && buffer.length) flush(); if (!buffer.length) bufferLine = lineNumber; buffer.push(line); return; }
    if (looksLikeRecord(line)) parsed.diagnostics.push({ level: 'warning', message: 'Record-like text was not assigned to an output. Use a category and bureau heading.', line: lineNumber });
    else pushPreserved(parsed, lineNumber, line, 'Text not mapped to a standard output field.');
  });

  flush();
  const headerLines = header.map((item) => item.text);
  const firstUnlabelled = header.find((item) => !KNOWN_HEADER.test(item.text));
  parsed.name = headerField(headerLines, /^(?:NAME|CLIENT|CONSUMER(?:\s+NAME)?)\s*:\s*/i) || firstUnlabelled?.text || '';
  const split = splitName(parsed.name);
  parsed.firstName = headerField(headerLines, /^FIRST\s+NAME\s*:\s*/i) || split.firstName;
  parsed.middleName = headerField(headerLines, /^MIDDLE\s+NAME\s*:\s*/i) || split.middleName;
  parsed.lastName = headerField(headerLines, /^LAST\s+NAME\s*:\s*/i) || split.lastName;
  parsed.dob = headerField(headerLines, /^DOB\s*:\s*/i);
  parsed.ssn = headerField(headerLines, /^SSN\s*:\s*/i);
  parsed.phone = headerField(headerLines, PHONE_FIELD);
  parsed.email = headerField(headerLines, /^(?:EMAIL|E-?MAIL)\s*:\s*/i);
  parsed.country = headerField(headerLines, /^COUNTRY\s*:\s*/i);
  parsed.affidavitState = headerField(headerLines, /^AFFIDAVIT\s+STATE\s*:\s*/i);
  parsed.affidavitCounty = headerField(headerLines, /^AFFIDAVIT\s+COUNTY\s*:\s*/i);
  headerLines.forEach((line) => { const match = line.match(TEMPLATE_FIELD); if (match) parsed.templateFields[match[1]] = safeLine(match[2]); });

  const labelledAddress = header.filter((item) => /^ADDRESS\s*:/i.test(item.text)).map((item) => item.text.replace(/^ADDRESS\s*:\s*/i, '')).filter(Boolean);
  const continuationAddress = header.filter((item) => item.text !== parsed.name && !KNOWN_HEADER.test(item.text)).map((item) => item.text).filter(Boolean);
  parsed.address = [...labelledAddress, ...continuationAddress];
  header.filter((item) => RESERVED_HEADER.test(item.text)).forEach((item) => pushPreserved(parsed, item.line, item.text, 'Supplemental client field mapped only when a configured template requires it.'));
  if (!parsed.name) parsed.diagnostics.push({ level: 'warning', message: 'Client name could not be identified in the source header.' });
  return parsed;
}

export function detectRoutes(parsed: ParsedSource): LetterRoute[] {
  return bureaus.flatMap((bureau) => {
    const accounts = parsed.dispute[bureau];
    const inquiries = parsed.inquiry[bureau];
    const late = parsed.late[bureau];
    const routes: LetterRoute[] = [];
    if (accounts.length || inquiries.length) {
      const reason = accounts.length && inquiries.length ? `${accounts.length} dispute account(s) and ${inquiries.length} hard inquiry item(s).` : accounts.length ? `${accounts.length} dispute account(s).` : `${inquiries.length} hard inquiry item(s) only.`;
      routes.push({ bureau, type: 'DISPUTE', items: [...accounts, ...inquiries], reason });
    }
    if (late.length) routes.push({ bureau, type: 'LATE_PAYMENT', items: late, reason: `${late.length} late-payment item(s).` });
    return routes;
  });
}

function disputeLines(items: SourceItem[]) { return items.flatMap((item, index) => [index ? '' : '', ...item.displayText.split('\n')]); }

export function createNormalizedSourceCopy(source: string): NormalizedSourceCopy {
  const parsed = parseSource(source);
  const sections: string[] = [`NAME: ${parsed.name}`, `FIRST NAME: ${parsed.firstName}`, `MIDDLE NAME: ${parsed.middleName}`, `LAST NAME: ${parsed.lastName}`, ...parsed.address.map((line, index) => `${index === 0 ? 'ADDRESS: ' : ''}${line}`), `COUNTRY: ${parsed.country}`, `DOB: ${parsed.dob}`, `SSN: ${parsed.ssn}`, `PHONE: ${parsed.phone}`, `EMAIL: ${parsed.email}`];
  if (parsed.affidavitState || parsed.affidavitCounty) sections.push(`AFFIDAVIT STATE: ${parsed.affidavitState}`, `AFFIDAVIT COUNTY: ${parsed.affidavitCounty}`);
  Object.entries(parsed.templateFields).forEach(([key, value]) => sections.push(`TEMPLATE FIELD ${key}: ${value}`));
  const disputes = bureaus.flatMap((bureau) => parsed.dispute[bureau].length ? ['', bureau, ...disputeLines(parsed.dispute[bureau])] : []);
  const inquiries = bureaus.flatMap((bureau) => parsed.inquiry[bureau].length ? ['', bureau, ...parsed.inquiry[bureau].map((item) => item.displayText)] : []);
  const late = bureaus.flatMap((bureau) => parsed.late[bureau].length ? ['', bureau, ...parsed.late[bureau].map((item) => item.displayText).join('\n\n').split('\n')] : []);
  const preserved = parsed.preserved.filter((item) => !RESERVED_HEADER.test(item.text) && !isMappedHardInquiryLine(item.text));
  if (disputes.length) sections.push('', 'DISPUTE ACCOUNTS', ...disputes);
  if (inquiries.length) sections.push('', 'HARD INQUIRIES', ...inquiries);
  if (late.length) sections.push('', 'LATE PAYMENTS', ...late);
  if (preserved.length) { sections.push('', 'PRESERVED SOURCE DATA - NOT INSERTED UNLESS A TEMPLATE MAPS IT'); preserved.forEach((item) => sections.push(`[LINE ${item.line}] ${item.text}`)); }
  return { text: sections.filter((line, index, all) => line || all[index - 1] !== '').join('\n').trim(), usedFields: ['Name', 'Address', 'DOB', 'SSN', parsed.affidavitState ? 'Affidavit state' : '', parsed.affidavitCounty ? 'Affidavit county' : '', 'Dispute accounts', 'Hard inquiries', 'Late payments'].filter(Boolean), reservedFields: [parsed.phone ? 'Phone' : '', parsed.email ? 'Email' : '', parsed.country ? 'Country' : ''].filter(Boolean), preservedLines: preserved };
}

export const recommendedSourceFormat = `NAME: CLIENT FULL NAME\nFIRST NAME:\nMIDDLE NAME:\nLAST NAME:\nADDRESS: STREET ADDRESS\nCITY, STATE ZIP\nCOUNTRY: USA\nDOB: MM/DD/YYYY\nSSN: XXX-XX-1234\nPHONE:\nEMAIL:\n\nDISPUTE ACCOUNTS\nTRANSUNION\nAccount Name: EXAMPLE BANK\nAccount Number: XXXX1234\n\nHARD INQUIRIES\nTRANSUNION\nEXAMPLE LENDER - 08/08/2024\nONEMAIN - Jan 29, 2025\nONEMAIN - January 29, 2025\n\nLATE PAYMENTS\nTRANSUNION\nAccount Name: EXAMPLE BANK\nAccount Number: XXXX1234\nLate payment details`;
