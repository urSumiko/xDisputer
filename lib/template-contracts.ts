import PizZip from 'pizzip';

export type TemplateDocumentKind = 'FCRA' | 'AFFIDAVIT' | 'ATTACHMENT' | 'FTC' | 'DISPUTE_LETTER' | 'LATE_PAYMENT_LETTER';
export type TemplateFieldSection = 'CLIENT' | 'AFFIDAVIT' | 'FTC' | 'ROUTING' | 'CUSTOM';
export type TemplateContractMode = 'PLACEHOLDERS' | 'LEGACY_HIGHLIGHTED' | 'STATIC' | 'REFERENCE_LAYOUT';
export type TemplateValidationStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'STATIC';
export type CanonicalTemplateField =
  | 'client.name'
  | 'client.address'
  | 'client.dob'
  | 'client.ssnMasked'
  | 'client.email'
  | 'client.phone'
  | 'letter.date'
  | 'bureau.name'
  | 'bureau.address'
  | 'accounts.lines'
  | 'inquiries.lines'
  | 'affidavit.state'
  | 'affidavit.county'
  | 'ftc.reportNumber'
  | 'ftc.reportDate'
  | 'ftc.statement';
export type TemplateFieldContract = { key: string; label: string; section: TemplateFieldSection; sourceKey?: string; canonicalKey?: CanonicalTemplateField; required: boolean };
export type TemplateContractValidation = {
  status: TemplateValidationStatus;
  confidence: number;
  requiredFields: CanonicalTemplateField[];
  fulfilledFields: CanonicalTemplateField[];
  missingFields: CanonicalTemplateField[];
  unknownRequiredFields: string[];
  warnings: string[];
  errors: string[];
  aliasesUsed: Array<{ alias: string; canonical: CanonicalTemplateField }>;
  renderMode: TemplateContractMode;
  whatIfs: string[];
};
export type TemplateContract = {
  version: 1;
  kind: TemplateDocumentKind;
  mode: TemplateContractMode;
  tags: string[];
  loops: string[];
  fields: TemplateFieldContract[];
  customFields: TemplateFieldContract[];
  requiredCanonicalFields: CanonicalTemplateField[];
  optionalCanonicalFields: CanonicalTemplateField[];
  detected: { tags: string[]; loops: string[]; conditions: string[]; aliasesUsed: Array<{ alias: string; canonical: CanonicalTemplateField }> };
  validation: TemplateContractValidation;
};

const SOURCE_TO_CANONICAL: Record<string, CanonicalTemplateField> = {
  name: 'client.name',
  firstName: 'client.name',
  middleName: 'client.name',
  lastName: 'client.name',
  address: 'client.address',
  dob: 'client.dob',
  ssn: 'client.ssnMasked',
  phone: 'client.phone',
  email: 'client.email',
  generated: 'letter.date',
  'bureauInfo.name': 'bureau.name',
  'bureauInfo.address': 'bureau.address',
  dispute: 'accounts.lines',
  ftcAccounts: 'accounts.lines',
  latePaymentItems: 'accounts.lines',
  inquiry: 'inquiries.lines',
  affidavitState: 'affidavit.state',
  affidavitCounty: 'affidavit.county',
  ftcReportNumber: 'ftc.reportNumber',
  ftcReportDate: 'ftc.reportDate',
  ftcStatement: 'ftc.statement'
};

const REQUIRED_BY_KIND: Record<TemplateDocumentKind, CanonicalTemplateField[]> = {
  DISPUTE_LETTER: ['client.name', 'client.address', 'letter.date', 'bureau.name', 'bureau.address', 'accounts.lines'],
  LATE_PAYMENT_LETTER: ['client.name', 'client.address', 'letter.date', 'bureau.name', 'bureau.address', 'accounts.lines'],
  AFFIDAVIT: ['client.name', 'client.address', 'client.ssnMasked', 'letter.date', 'affidavit.state', 'affidavit.county', 'accounts.lines'],
  FTC: ['client.name', 'client.address'],
  FCRA: [],
  ATTACHMENT: []
};
const OPTIONAL_BY_KIND: Record<TemplateDocumentKind, CanonicalTemplateField[]> = {
  DISPUTE_LETTER: ['client.dob', 'client.ssnMasked', 'inquiries.lines'],
  LATE_PAYMENT_LETTER: ['client.dob', 'client.ssnMasked'],
  AFFIDAVIT: ['client.dob'],
  FTC: ['client.phone', 'client.email', 'ftc.reportNumber', 'ftc.reportDate', 'ftc.statement', 'accounts.lines'],
  FCRA: [],
  ATTACHMENT: []
};

const BASE_FIELDS: Record<string, Omit<TemplateFieldContract, 'key'>> = {
  consumer_name: { label: 'Consumer name', section: 'CLIENT', sourceKey: 'name', canonicalKey: 'client.name', required: true },
  client_name: { label: 'Consumer name', section: 'CLIENT', sourceKey: 'name', canonicalKey: 'client.name', required: true },
  name: { label: 'Consumer name', section: 'CLIENT', sourceKey: 'name', canonicalKey: 'client.name', required: true },
  full_name: { label: 'Full name', section: 'CLIENT', sourceKey: 'name', canonicalKey: 'client.name', required: true },
  consumer_first_name: { label: 'First name', section: 'FTC', sourceKey: 'firstName', canonicalKey: 'client.name', required: false },
  consumer_middle_name: { label: 'Middle name', section: 'FTC', sourceKey: 'middleName', canonicalKey: 'client.name', required: false },
  consumer_last_name: { label: 'Last name', section: 'FTC', sourceKey: 'lastName', canonicalKey: 'client.name', required: false },
  first_name: { label: 'First name', section: 'FTC', sourceKey: 'firstName', canonicalKey: 'client.name', required: false },
  middle_name: { label: 'Middle name', section: 'FTC', sourceKey: 'middleName', canonicalKey: 'client.name', required: false },
  last_name: { label: 'Last name', section: 'FTC', sourceKey: 'lastName', canonicalKey: 'client.name', required: false },
  address: { label: 'Address', section: 'CLIENT', sourceKey: 'address', canonicalKey: 'client.address', required: true },
  consumer_address: { label: 'Address', section: 'CLIENT', sourceKey: 'address', canonicalKey: 'client.address', required: true },
  client_address: { label: 'Address', section: 'CLIENT', sourceKey: 'address', canonicalKey: 'client.address', required: true },
  mailing_address: { label: 'Address', section: 'CLIENT', sourceKey: 'address', canonicalKey: 'client.address', required: false },
  bureau: { label: 'Bureau name', section: 'ROUTING', sourceKey: 'bureauInfo.name', canonicalKey: 'bureau.name', required: true },
  credit_bureau: { label: 'Bureau name', section: 'ROUTING', sourceKey: 'bureauInfo.name', canonicalKey: 'bureau.name', required: true },
  bureau_full_name: { label: 'Bureau name', section: 'ROUTING', sourceKey: 'bureauInfo.name', canonicalKey: 'bureau.name', required: true },
  current_date: { label: 'Document date', section: 'CLIENT', sourceKey: 'generated', canonicalKey: 'letter.date', required: true },
  today: { label: 'Document date', section: 'CLIENT', sourceKey: 'generated', canonicalKey: 'letter.date', required: true },
  generated_date: { label: 'Document date', section: 'CLIENT', sourceKey: 'generated', canonicalKey: 'letter.date', required: true },
  address_inline: { label: 'Address', section: 'CLIENT', sourceKey: 'address', canonicalKey: 'client.address', required: true },
  address_line_1: { label: 'Address line 1', section: 'CLIENT', sourceKey: 'address', canonicalKey: 'client.address', required: true },
  address_line_2: { label: 'Address line 2', section: 'CLIENT', sourceKey: 'address', canonicalKey: 'client.address', required: false },
  city_state_zip: { label: 'City/state/zip', section: 'CLIENT', sourceKey: 'address', canonicalKey: 'client.address', required: false },
  dob: { label: 'Date of birth', section: 'CLIENT', sourceKey: 'dob', canonicalKey: 'client.dob', required: false },
  ssn: { label: 'Masked SSN', section: 'CLIENT', sourceKey: 'ssn', canonicalKey: 'client.ssnMasked', required: false },
  ssn_masked: { label: 'Masked SSN', section: 'CLIENT', sourceKey: 'ssn', canonicalKey: 'client.ssnMasked', required: false },
  phone: { label: 'Phone', section: 'FTC', sourceKey: 'phone', canonicalKey: 'client.phone', required: false },
  email: { label: 'Email', section: 'FTC', sourceKey: 'email', canonicalKey: 'client.email', required: false },
  country: { label: 'Country', section: 'FTC', required: false },
  date: { label: 'Document date', section: 'CLIENT', sourceKey: 'generated', canonicalKey: 'letter.date', required: true },
  letter_date: { label: 'Document date', section: 'CLIENT', sourceKey: 'generated', canonicalKey: 'letter.date', required: true },
  document_date: { label: 'Document date', section: 'CLIENT', sourceKey: 'generated', canonicalKey: 'letter.date', required: true },
  bureau_name: { label: 'Bureau name', section: 'ROUTING', sourceKey: 'bureauInfo.name', canonicalKey: 'bureau.name', required: true },
  bureau_address: { label: 'Bureau address', section: 'ROUTING', sourceKey: 'bureauInfo.address', canonicalKey: 'bureau.address', required: true },
  bureau_address_line_1: { label: 'Bureau address line 1', section: 'ROUTING', sourceKey: 'bureauInfo.address', canonicalKey: 'bureau.address', required: true },
  bureau_address_line_2: { label: 'Bureau address line 2', section: 'ROUTING', sourceKey: 'bureauInfo.address', canonicalKey: 'bureau.address', required: false },
  affidavit_state: { label: 'State of execution', section: 'AFFIDAVIT', sourceKey: 'affidavitState', canonicalKey: 'affidavit.state', required: true },
  affidavit_county: { label: 'County of execution', section: 'AFFIDAVIT', sourceKey: 'affidavitCounty', canonicalKey: 'affidavit.county', required: true },
  ftc_report_number: { label: 'FTC report number', section: 'FTC', sourceKey: 'ftcReportNumber', canonicalKey: 'ftc.reportNumber', required: false },
  report_number: { label: 'FTC report number', section: 'FTC', sourceKey: 'ftcReportNumber', canonicalKey: 'ftc.reportNumber', required: false },
  ftc_report_date: { label: 'FTC report date', section: 'FTC', sourceKey: 'ftcReportDate', canonicalKey: 'ftc.reportDate', required: false },
  report_date: { label: 'FTC report date', section: 'FTC', sourceKey: 'ftcReportDate', canonicalKey: 'ftc.reportDate', required: false },
  ftc_statement: { label: 'FTC statement', section: 'FTC', sourceKey: 'ftcStatement', canonicalKey: 'ftc.statement', required: false },
  statement: { label: 'FTC statement', section: 'FTC', sourceKey: 'ftcStatement', canonicalKey: 'ftc.statement', required: false },
  account_lines: { label: 'Disputed accounts', section: 'AFFIDAVIT', sourceKey: 'dispute', canonicalKey: 'accounts.lines', required: false },
  account_name: { label: 'Account name', section: 'AFFIDAVIT', sourceKey: 'dispute', canonicalKey: 'accounts.lines', required: false },
  account_number: { label: 'Account number', section: 'AFFIDAVIT', sourceKey: 'dispute', canonicalKey: 'accounts.lines', required: false },
  account_line: { label: 'Account line', section: 'AFFIDAVIT', sourceKey: 'dispute', canonicalKey: 'accounts.lines', required: false },
  display_text: { label: 'Account display text', section: 'AFFIDAVIT', sourceKey: 'dispute', canonicalKey: 'accounts.lines', required: false },
  late_payment_items: { label: 'Late payment accounts', section: 'AFFIDAVIT', sourceKey: 'latePaymentItems', canonicalKey: 'accounts.lines', required: false },
  late_payment_lines: { label: 'Late payment accounts', section: 'AFFIDAVIT', sourceKey: 'latePaymentItems', canonicalKey: 'accounts.lines', required: false },
  hard_inquiry_lines: { label: 'Hard inquiries', section: 'CLIENT', sourceKey: 'inquiry', canonicalKey: 'inquiries.lines', required: false },
  inquiry_line: { label: 'Inquiry line', section: 'CLIENT', sourceKey: 'inquiry', canonicalKey: 'inquiries.lines', required: false },
  ftc_accounts: { label: 'Affected accounts', section: 'FTC', sourceKey: 'ftcAccounts', canonicalKey: 'accounts.lines', required: false },
  accounts: { label: 'Accounts', section: 'FTC', sourceKey: 'ftcAccounts', canonicalKey: 'accounts.lines', required: false },
  affected_accounts: { label: 'Affected accounts', section: 'FTC', sourceKey: 'ftcAccounts', canonicalKey: 'accounts.lines', required: false }
};

const LOOP_FIELDS = new Set(['accounts', 'affected_accounts', 'dispute_accounts', 'hard_inquiries', 'ftc_accounts', 'late_payment_items', 'late_payment_lines']);
const LOOP_CHILDREN = new Set(['index', 'number', 'account_name', 'account_number', 'account_line', 'display_text', 'inquiry_line', 'fraud_began', 'date_discovered', 'fraudulent_amount', 'fraud_amount']);
const SYSTEM_ROUTING_FIELDS = new Set(['bureau_name', 'bureau_address', 'bureau_address_line_1', 'bureau_address_line_2']);
const FTC_LEGACY_KEYS = ['ftc_report_number', 'ftc_report_date', 'consumer_first_name', 'consumer_middle_name', 'consumer_last_name', 'address', 'country', 'phone', 'email', 'ftc_accounts'];
const AFFIDAVIT_LEGACY_KEYS = ['affidavit_state', 'affidavit_county', 'consumer_name', 'address_inline', 'ssn_masked', 'account_lines', 'document_date'];
const REFERENCE_KEYS = ['consumer_name', 'address', 'dob', 'ssn_masked', 'document_date', 'bureau_name', 'bureau_address', 'account_lines'];
const XML_PART = /^word\/(?:document|header\d+|footer\d+)\.xml$/i;

function humanLabel(key: string) {
  return key.replace(/[_.-]+/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function fieldFor(key: string, kind?: TemplateDocumentKind): TemplateFieldContract {
  const known = BASE_FIELDS[key];
  const field: TemplateFieldContract = known ? { key, ...known } : { key, label: humanLabel(key), section: 'CUSTOM', required: kind !== 'FTC' };
  return kind === 'FTC' ? { ...field, required: false } : field;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function visibleText(xml: string) {
  return xml.replace(/<w:tab\b[^>]*\/>/gi, '\t').replace(/<w:(?:br|cr)\b[^>]*\/>/gi, '\n').replace(/<\/w:p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function templateText(zip: PizZip) {
  return Object.keys(zip.files).filter((name) => XML_PART.test(name)).map((name) => visibleText(zip.file(name)?.asText() || '')).join('\n');
}

function implicitFields(kind: TemplateDocumentKind) {
  if (kind === 'AFFIDAVIT') return AFFIDAVIT_LEGACY_KEYS.map((key) => fieldFor(key, kind));
  if (kind === 'FTC') return FTC_LEGACY_KEYS.map((key) => fieldFor(key, kind));
  if (kind === 'DISPUTE_LETTER' || kind === 'LATE_PAYMENT_LETTER') return REFERENCE_KEYS.map((key) => fieldFor(key, kind));
  return [];
}

function placeholderFields(tags: string[], loops: string[], kind: TemplateDocumentKind) {
  const fields = tags.filter((key) => !LOOP_CHILDREN.has(key)).map((key) => fieldFor(key, kind));
  loops.forEach((key) => {
    if (key === 'ftc_accounts' || key === 'affected_accounts' || (kind === 'FTC' && (key === 'accounts' || key === 'dispute_accounts'))) {
      fields.push(fieldFor('ftc_accounts', kind));
    } else if (key === 'hard_inquiries') {
      fields.push(fieldFor('hard_inquiry_lines', kind));
    } else if (key === 'late_payment_items' || key === 'late_payment_lines') {
      fields.push(fieldFor('late_payment_lines', kind));
    } else if (key === 'accounts' || key === 'dispute_accounts') {
      fields.push(fieldFor('account_lines', kind));
    }
  });
  const seen = new Set<string>();
  return fields.filter((field) => {
    if (seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  });
}

function canonicalForField(field: TemplateFieldContract): CanonicalTemplateField | undefined {
  return field.canonicalKey || (field.sourceKey ? SOURCE_TO_CANONICAL[field.sourceKey] : undefined);
}

function buildValidation(kind: TemplateDocumentKind, mode: TemplateContractMode, tags: string[], loops: string[], conditions: string[], fields: TemplateFieldContract[], customFields: TemplateFieldContract[]): TemplateContractValidation {
  if (mode === 'STATIC') {
    return { status: 'STATIC', confidence: 1, requiredFields: [], fulfilledFields: [], missingFields: [], unknownRequiredFields: [], warnings: [], errors: [], aliasesUsed: [], renderMode: mode, whatIfs: ['Static inserts are not source-populated; generation uses the uploaded file unchanged.'] };
  }
  const requiredFields = REQUIRED_BY_KIND[kind];
  const fulfilledFields = unique(fields.map(canonicalForField).filter(Boolean) as CanonicalTemplateField[]);
  const missingFields = requiredFields.filter((field) => !fulfilledFields.includes(field));
  const unknownRequiredFields = customFields.filter((field) => field.required).map((field) => field.key);
  const aliasesUsed = fields.flatMap((field) => {
    const canonical = canonicalForField(field);
    return canonical && field.key !== canonical ? [{ alias: field.key, canonical }] : [];
  });
  const warnings: string[] = [];
  const errors: string[] = [];
  if (mode === 'REFERENCE_LAYOUT' || mode === 'LEGACY_HIGHLIGHTED') warnings.push(`${mode} accepted through compatibility mode; placeholders are safer for future template changes.`);
  if (conditions.length) warnings.push(`${conditions.length} conditional tag(s) detected. Conditions must resolve from canonical source data.`);
  if (unknownRequiredFields.length) errors.push(`Unknown required field(s): ${unknownRequiredFields.join(', ')}. Add a source mapping or rename to a supported placeholder.`);
  if (missingFields.length) errors.push(`Missing required canonical field(s): ${missingFields.join(', ')}.`);
  const base = mode === 'PLACEHOLDERS' ? 0.95 : mode === 'REFERENCE_LAYOUT' ? 0.82 : 0.72;
  const penalty = missingFields.length * 0.12 + unknownRequiredFields.length * 0.1 + warnings.length * 0.03;
  const confidence = Math.max(0, Math.min(1, Number((base - penalty).toFixed(2))));
  const status: TemplateValidationStatus = errors.length ? 'BLOCKED' : warnings.length ? 'WARNING' : 'READY';
  return {
    status,
    confidence,
    requiredFields,
    fulfilledFields,
    missingFields,
    unknownRequiredFields,
    warnings,
    errors,
    aliasesUsed,
    renderMode: mode,
    whatIfs: [
      'If wording or section order changes but supported placeholders remain, generation can continue.',
      'If account placement is removed, upload is blocked before this version becomes active.',
      'If a custom required placeholder appears, generation is blocked until the field is mapped.',
      'If this upload is invalid, the previous active template version remains preserved.'
    ]
  };
}

function buildContract(kind: TemplateDocumentKind, mode: TemplateContractMode, tags: string[], loops: string[], conditions: string[], fields: TemplateFieldContract[]): TemplateContract {
  const customFields = fields.filter((field) => field.section === 'CUSTOM' && !SYSTEM_ROUTING_FIELDS.has(field.key));
  const validation = buildValidation(kind, mode, tags, loops, conditions, fields, customFields);
  return { version: 1, kind, mode, tags, loops, fields, customFields, requiredCanonicalFields: REQUIRED_BY_KIND[kind], optionalCanonicalFields: OPTIONAL_BY_KIND[kind], detected: { tags, loops, conditions, aliasesUsed: validation.aliasesUsed }, validation };
}

export function templateContractGateMessage(contract: TemplateContract) {
  if (contract.validation.status !== 'BLOCKED') return null;
  return [`${contract.kind} template is not generation-ready.`, ...contract.validation.errors, ...contract.validation.whatIfs].join(' ');
}

export function assertTemplateContractReady(contract: TemplateContract) {
  const message = templateContractGateMessage(contract);
  if (message) throw new Error(message);
}

export async function inspectTemplateContract(file: File, kind: TemplateDocumentKind): Promise<TemplateContract> {
  if (kind === 'FCRA' || kind === 'ATTACHMENT') {
    return buildContract(kind, 'STATIC', [], [], [], []);
  }
  const zip = new PizZip(await file.arrayBuffer());
  const xml = templateText(zip);
  const tokens = Array.from(xml.matchAll(/\{\{\s*([#\/^]?)([\w.-]+)\s*\}\}/g)).map((match) => ({ marker: match[1], key: match[2] }));
  const loops = unique(tokens.filter((token) => token.marker === '#').map((token) => token.key));
  const conditions = unique(tokens.filter((token) => token.marker === '^').map((token) => token.key));
  const loopLike = unique([...loops, ...conditions]);
  const tags = unique(tokens.filter((token) => !token.marker && !LOOP_FIELDS.has(token.key)).map((token) => token.key));
  const mode: TemplateContractMode = tags.length || loopLike.length ? 'PLACEHOLDERS' : kind === 'DISPUTE_LETTER' || kind === 'LATE_PAYMENT_LETTER' ? 'REFERENCE_LAYOUT' : 'LEGACY_HIGHLIGHTED';
  const fields = mode === 'PLACEHOLDERS' ? placeholderFields(tags, loopLike, kind) : implicitFields(kind);
  return buildContract(kind, mode, tags, loops, conditions, fields);
}

export function unresolvedCustomTemplateFields(contracts: Array<TemplateContract | undefined | null>) {
  const seen = new Set<string>();
  return contracts.flatMap((contract) => contract?.customFields || []).filter((field) => {
    if (SYSTEM_ROUTING_FIELDS.has(field.key) || seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  });
}
