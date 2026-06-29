import type { TemplateDocumentKind } from '../template-contracts';

export type DynamicTemplatePacketRole = 'LETTER_DOCX' | 'EDITABLE_EXHIBIT_DOCX' | 'STATIC_EXHIBIT_PDF';
export type DynamicTemplateFieldKind = 'INLINE' | 'MULTILINE' | 'REPEATING_BLOCK' | 'CONDITIONAL_BLOCK';
export type DynamicTemplateRenderIntent = 'REPLACE_TEXT' | 'REPLACE_MULTILINE' | 'CLONE_PARAGRAPH_BLOCK' | 'CLONE_TABLE_ROW' | 'REMOVE_OR_KEEP_SECTION' | 'STATIC_INSERT_ONLY';

export type DynamicCanonicalFieldKey =
  | 'client.name'
  | 'client.addressLines'
  | 'client.dob'
  | 'client.ssnMasked'
  | 'client.email'
  | 'client.phone'
  | 'letter.date'
  | 'letter.round'
  | 'bureau.name'
  | 'bureau.addressLines'
  | 'accounts.dispute'
  | 'accounts.latePayments'
  | 'accounts.ftcAffected'
  | 'inquiries.hard'
  | 'affidavit.state'
  | 'affidavit.county'
  | 'ftc.reportNumber'
  | 'ftc.reportDate'
  | 'ftc.statement'
  | 'conditional.hasDisputeAccounts'
  | 'conditional.hasLatePayments'
  | 'conditional.hasHardInquiries'
  | 'conditional.hasFtcAccounts';

export type DynamicFieldDefinition = {
  key: DynamicCanonicalFieldKey;
  label: string;
  kind: DynamicTemplateFieldKind;
  dataPath: string;
  aliases: string[];
  renderIntent: DynamicTemplateRenderIntent;
  requiredFor: TemplateDocumentKind[];
  optionalFor: TemplateDocumentKind[];
  repeatItemName?: string;
  notes?: string;
};

export type DynamicDocumentProfile = {
  kind: TemplateDocumentKind;
  packetRole: DynamicTemplatePacketRole;
  editableDocx: boolean;
  staticPdf: boolean;
  requiredFields: DynamicCanonicalFieldKey[];
  optionalFields: DynamicCanonicalFieldKey[];
  repeatingFields: DynamicCanonicalFieldKey[];
  conditionalFields: DynamicCanonicalFieldKey[];
  allowedRoundMismatch: boolean;
  warningRules: string[];
};

export const dynamicFieldRegistry: DynamicFieldDefinition[] = [
  {
    key: 'client.name',
    label: 'Client full name',
    kind: 'INLINE',
    dataPath: 'client.name',
    aliases: ['client.name', 'client_name', 'consumer_name', 'consumer.full_name', 'full_name', 'name', 'consumer', 'consumer_full_name'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER', 'AFFIDAVIT', 'FTC'],
    optionalFor: []
  },
  {
    key: 'client.addressLines',
    label: 'Client address lines',
    kind: 'MULTILINE',
    dataPath: 'client.addressLines',
    aliases: ['client.address', 'client.addressLines', 'client_address', 'consumer_address', 'address', 'mailing_address', 'address_inline', 'address_line_1', 'address_line_2', 'city_state_zip'],
    renderIntent: 'REPLACE_MULTILINE',
    requiredFor: ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER', 'AFFIDAVIT', 'FTC'],
    optionalFor: []
  },
  {
    key: 'client.dob',
    label: 'Client date of birth',
    kind: 'INLINE',
    dataPath: 'client.dob',
    aliases: ['client.dob', 'dob', 'date_of_birth', 'birth_date', 'consumer_dob'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: [],
    optionalFor: ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER', 'AFFIDAVIT', 'FTC']
  },
  {
    key: 'client.ssnMasked',
    label: 'Client masked SSN',
    kind: 'INLINE',
    dataPath: 'client.ssnMasked',
    aliases: ['client.ssnMasked', 'ssn', 'ssn_masked', 'masked_ssn', 'consumer_ssn', 'last4_ssn'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: ['AFFIDAVIT'],
    optionalFor: ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER', 'FTC']
  },
  {
    key: 'client.email',
    label: 'Client email',
    kind: 'INLINE',
    dataPath: 'client.email',
    aliases: ['client.email', 'email', 'consumer_email'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: [],
    optionalFor: ['FTC']
  },
  {
    key: 'client.phone',
    label: 'Client phone',
    kind: 'INLINE',
    dataPath: 'client.phone',
    aliases: ['client.phone', 'phone', 'telephone', 'consumer_phone'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: [],
    optionalFor: ['FTC']
  },
  {
    key: 'letter.date',
    label: 'Letter/document date',
    kind: 'INLINE',
    dataPath: 'letter.date',
    aliases: ['letter.date', 'letter_date', 'document_date', 'current_date', 'generated_date', 'date', 'today'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER', 'AFFIDAVIT', 'FTC'],
    optionalFor: []
  },
  {
    key: 'letter.round',
    label: 'Selected round label',
    kind: 'INLINE',
    dataPath: 'letter.round',
    aliases: ['letter.round', 'round', 'round_label', 'filing_round'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: [],
    optionalFor: ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER', 'AFFIDAVIT', 'FTC']
  },
  {
    key: 'bureau.name',
    label: 'Credit bureau name',
    kind: 'INLINE',
    dataPath: 'bureau.name',
    aliases: ['bureau.name', 'bureau_name', 'bureau', 'credit_bureau', 'credit_bureau_name', 'bureau_full_name'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER'],
    optionalFor: ['AFFIDAVIT']
  },
  {
    key: 'bureau.addressLines',
    label: 'Credit bureau address lines',
    kind: 'MULTILINE',
    dataPath: 'bureau.addressLines',
    aliases: ['bureau.address', 'bureau.addressLines', 'bureau_address', 'bureau_address_line_1', 'bureau_address_line_2', 'credit_bureau_address'],
    renderIntent: 'REPLACE_MULTILINE',
    requiredFor: ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER'],
    optionalFor: []
  },
  {
    key: 'accounts.dispute',
    label: 'Dispute account items',
    kind: 'REPEATING_BLOCK',
    dataPath: 'accounts.dispute[]',
    aliases: ['accounts.dispute', 'dispute_accounts', 'account_lines', 'accounts', 'account_line', 'account_name', 'account_number', 'display_text', 'dispute_items'],
    renderIntent: 'CLONE_PARAGRAPH_BLOCK',
    requiredFor: ['DISPUTE_LETTER', 'AFFIDAVIT'],
    optionalFor: ['FTC'],
    repeatItemName: 'account'
  },
  {
    key: 'accounts.latePayments',
    label: 'Late payment account items',
    kind: 'REPEATING_BLOCK',
    dataPath: 'accounts.latePayments[]',
    aliases: ['accounts.latePayments', 'late_payment_items', 'late_payment_lines', 'late_payments', 'late_accounts'],
    renderIntent: 'CLONE_PARAGRAPH_BLOCK',
    requiredFor: ['LATE_PAYMENT_LETTER'],
    optionalFor: [],
    repeatItemName: 'account'
  },
  {
    key: 'accounts.ftcAffected',
    label: 'FTC affected accounts',
    kind: 'REPEATING_BLOCK',
    dataPath: 'accounts.ftcAffected[]',
    aliases: ['accounts.ftcAffected', 'ftc_accounts', 'affected_accounts', 'fraud_accounts'],
    renderIntent: 'CLONE_PARAGRAPH_BLOCK',
    requiredFor: [],
    optionalFor: ['FTC'],
    repeatItemName: 'account'
  },
  {
    key: 'inquiries.hard',
    label: 'Hard inquiry items',
    kind: 'REPEATING_BLOCK',
    dataPath: 'inquiries.hard[]',
    aliases: ['inquiries.hard', 'hard_inquiries', 'hard_inquiry_lines', 'inquiry_line', 'inquiries'],
    renderIntent: 'CLONE_PARAGRAPH_BLOCK',
    requiredFor: [],
    optionalFor: ['DISPUTE_LETTER'],
    repeatItemName: 'inquiry'
  },
  {
    key: 'affidavit.state',
    label: 'Affidavit state',
    kind: 'INLINE',
    dataPath: 'affidavit.state',
    aliases: ['affidavit.state', 'affidavit_state', 'state_of_execution', 'notary_state'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: ['AFFIDAVIT'],
    optionalFor: []
  },
  {
    key: 'affidavit.county',
    label: 'Affidavit county',
    kind: 'INLINE',
    dataPath: 'affidavit.county',
    aliases: ['affidavit.county', 'affidavit_county', 'county_of_execution', 'notary_county'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: ['AFFIDAVIT'],
    optionalFor: []
  },
  {
    key: 'ftc.reportNumber',
    label: 'FTC report number',
    kind: 'INLINE',
    dataPath: 'ftc.reportNumber',
    aliases: ['ftc.reportNumber', 'ftc_report_number', 'report_number', 'identity_theft_report_number'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: [],
    optionalFor: ['FTC']
  },
  {
    key: 'ftc.reportDate',
    label: 'FTC report date',
    kind: 'INLINE',
    dataPath: 'ftc.reportDate',
    aliases: ['ftc.reportDate', 'ftc_report_date', 'report_date'],
    renderIntent: 'REPLACE_TEXT',
    requiredFor: [],
    optionalFor: ['FTC']
  },
  {
    key: 'ftc.statement',
    label: 'FTC statement',
    kind: 'MULTILINE',
    dataPath: 'ftc.statement',
    aliases: ['ftc.statement', 'ftc_statement', 'statement', 'identity_theft_statement'],
    renderIntent: 'REPLACE_MULTILINE',
    requiredFor: [],
    optionalFor: ['FTC']
  },
  {
    key: 'conditional.hasDisputeAccounts',
    label: 'Conditional dispute-account section',
    kind: 'CONDITIONAL_BLOCK',
    dataPath: 'accounts.dispute.length > 0',
    aliases: ['if.hasDisputeAccounts', 'if_has_dispute_accounts', 'has_dispute_accounts'],
    renderIntent: 'REMOVE_OR_KEEP_SECTION',
    requiredFor: [],
    optionalFor: ['DISPUTE_LETTER', 'AFFIDAVIT']
  },
  {
    key: 'conditional.hasLatePayments',
    label: 'Conditional late-payment section',
    kind: 'CONDITIONAL_BLOCK',
    dataPath: 'accounts.latePayments.length > 0',
    aliases: ['if.hasLatePayments', 'if_has_late_payments', 'has_late_payments'],
    renderIntent: 'REMOVE_OR_KEEP_SECTION',
    requiredFor: [],
    optionalFor: ['LATE_PAYMENT_LETTER']
  },
  {
    key: 'conditional.hasHardInquiries',
    label: 'Conditional hard-inquiry section',
    kind: 'CONDITIONAL_BLOCK',
    dataPath: 'inquiries.hard.length > 0',
    aliases: ['if.hasHardInquiries', 'if_has_hard_inquiries', 'has_hard_inquiries'],
    renderIntent: 'REMOVE_OR_KEEP_SECTION',
    requiredFor: [],
    optionalFor: ['DISPUTE_LETTER']
  },
  {
    key: 'conditional.hasFtcAccounts',
    label: 'Conditional FTC account section',
    kind: 'CONDITIONAL_BLOCK',
    dataPath: 'accounts.ftcAffected.length > 0',
    aliases: ['if.hasFtcAccounts', 'if_has_ftc_accounts', 'has_ftc_accounts'],
    renderIntent: 'REMOVE_OR_KEEP_SECTION',
    requiredFor: [],
    optionalFor: ['FTC']
  }
];

export const dynamicDocumentProfiles: Record<TemplateDocumentKind, DynamicDocumentProfile> = {
  DISPUTE_LETTER: {
    kind: 'DISPUTE_LETTER',
    packetRole: 'LETTER_DOCX',
    editableDocx: true,
    staticPdf: false,
    requiredFields: ['client.name', 'client.addressLines', 'letter.date', 'bureau.name', 'bureau.addressLines', 'accounts.dispute'],
    optionalFields: ['client.dob', 'client.ssnMasked', 'letter.round', 'inquiries.hard', 'conditional.hasDisputeAccounts', 'conditional.hasHardInquiries'],
    repeatingFields: ['accounts.dispute', 'inquiries.hard'],
    conditionalFields: ['conditional.hasDisputeAccounts', 'conditional.hasHardInquiries'],
    allowedRoundMismatch: true,
    warningRules: ['Warn when text mentions a different round, but allow if the canonical dispute contract passes.']
  },
  LATE_PAYMENT_LETTER: {
    kind: 'LATE_PAYMENT_LETTER',
    packetRole: 'LETTER_DOCX',
    editableDocx: true,
    staticPdf: false,
    requiredFields: ['client.name', 'client.addressLines', 'letter.date', 'bureau.name', 'bureau.addressLines', 'accounts.latePayments'],
    optionalFields: ['client.dob', 'client.ssnMasked', 'letter.round', 'conditional.hasLatePayments'],
    repeatingFields: ['accounts.latePayments'],
    conditionalFields: ['conditional.hasLatePayments'],
    allowedRoundMismatch: true,
    warningRules: ['Warn when text mentions a different round, but allow if the canonical late-payment contract passes.']
  },
  AFFIDAVIT: {
    kind: 'AFFIDAVIT',
    packetRole: 'EDITABLE_EXHIBIT_DOCX',
    editableDocx: true,
    staticPdf: false,
    requiredFields: ['client.name', 'client.addressLines', 'client.ssnMasked', 'letter.date', 'affidavit.state', 'affidavit.county', 'accounts.dispute'],
    optionalFields: ['client.dob', 'bureau.name', 'letter.round', 'conditional.hasDisputeAccounts'],
    repeatingFields: ['accounts.dispute'],
    conditionalFields: ['conditional.hasDisputeAccounts'],
    allowedRoundMismatch: true,
    warningRules: ['Affidavit is shared across the dispute packet and must remain editable DOCX.']
  },
  FTC: {
    kind: 'FTC',
    packetRole: 'EDITABLE_EXHIBIT_DOCX',
    editableDocx: true,
    staticPdf: false,
    requiredFields: ['client.name', 'client.addressLines', 'letter.date'],
    optionalFields: ['client.dob', 'client.ssnMasked', 'client.phone', 'client.email', 'letter.round', 'accounts.ftcAffected', 'ftc.reportNumber', 'ftc.reportDate', 'ftc.statement', 'conditional.hasFtcAccounts'],
    repeatingFields: ['accounts.ftcAffected'],
    conditionalFields: ['conditional.hasFtcAccounts'],
    allowedRoundMismatch: true,
    warningRules: ['FTC report is an editable DOCX packet component and should preserve the uploaded template layout.']
  },
  FCRA: {
    kind: 'FCRA',
    packetRole: 'STATIC_EXHIBIT_PDF',
    editableDocx: false,
    staticPdf: true,
    requiredFields: [],
    optionalFields: [],
    repeatingFields: [],
    conditionalFields: [],
    allowedRoundMismatch: true,
    warningRules: ['Static PDF exhibit is inserted unchanged.']
  },
  ATTACHMENT: {
    kind: 'ATTACHMENT',
    packetRole: 'STATIC_EXHIBIT_PDF',
    editableDocx: false,
    staticPdf: true,
    requiredFields: [],
    optionalFields: [],
    repeatingFields: [],
    conditionalFields: [],
    allowedRoundMismatch: true,
    warningRules: ['Static PDF attachment is inserted unchanged.']
  }
};

const aliasToCanonical = new Map<string, DynamicFieldDefinition>();

function normalizeAlias(value: string) {
  return value
    .replace(/^#|^\/|^if\./i, '')
    .replace(/^each\./i, '')
    .replace(/[{}\[\]«»]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .trim()
    .toLowerCase();
}

for (const definition of dynamicFieldRegistry) {
  aliasToCanonical.set(normalizeAlias(definition.key), definition);
  for (const alias of definition.aliases) aliasToCanonical.set(normalizeAlias(alias), definition);
}

export function normalizeTemplateToken(raw: string) {
  return normalizeAlias(raw);
}

export function resolveDynamicField(raw: string) {
  const normalized = normalizeAlias(raw);
  const definition = aliasToCanonical.get(normalized);

  if (!definition) return null;

  return {
    definition,
    canonicalKey: definition.key,
    alias: raw,
    normalizedAlias: normalized
  };
}

export function profileForDocumentKind(kind: TemplateDocumentKind) {
  return dynamicDocumentProfiles[kind];
}

export function requiredDynamicFieldsForKind(kind: TemplateDocumentKind) {
  return dynamicDocumentProfiles[kind].requiredFields;
}

export function optionalDynamicFieldsForKind(kind: TemplateDocumentKind) {
  return dynamicDocumentProfiles[kind].optionalFields;
}

export function isEditableDocxTemplateKind(kind: TemplateDocumentKind) {
  return dynamicDocumentProfiles[kind].editableDocx;
}

export function isStaticPdfTemplateKind(kind: TemplateDocumentKind) {
  return dynamicDocumentProfiles[kind].staticPdf;
}

export function dynamicFieldDefinition(key: DynamicCanonicalFieldKey) {
  return dynamicFieldRegistry.find((field) => field.key === key) || null;
}
