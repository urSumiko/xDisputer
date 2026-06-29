import type { TemplateDocumentKind } from '../template-contracts';
import type { DynamicCanonicalFieldKey } from '../dynamic-template/field-registry';
import type { TemplateAnchorKind } from '../dynamic-template-intelligence';

export type TemplateDomainKind =
  | 'DISPUTE_LETTER'
  | 'LATE_PAYMENT_LETTER'
  | 'AFFIDAVIT'
  | 'FCRA_ATTACHMENT'
  | 'FTC_REPORT'
  | 'BANKRUPTCY'
  | 'CHEXSYSTEMS'
  | 'DEBT_VALIDATION'
  | 'CUSTOM';

export type ManagerTemplateEntityKey =
  | 'dispute_accounts'
  | 'hard_inquiries'
  | 'late_payments'
  | 'supporting_documents'
  | 'bankruptcy_records'
  | 'chexsystems_items'
  | 'public_records'
  | 'custom_items';

export type TemplateDomainContract = {
  domain: TemplateDomainKind;
  documentKinds: TemplateDocumentKind[];
  label: string;
  description: string;
  requiredFields: DynamicCanonicalFieldKey[];
  optionalFields: DynamicCanonicalFieldKey[];
  requiredEntities: ManagerTemplateEntityKey[];
  optionalEntities: ManagerTemplateEntityKey[];
  requiredAnchors: TemplateAnchorKind[];
  optionalAnchors: TemplateAnchorKind[];
  futureReady: boolean;
};

export const MANAGER_TEMPLATE_DOMAIN_REGISTRY: TemplateDomainContract[] = [
  {
    domain: 'DISPUTE_LETTER',
    documentKinds: ['DISPUTE_LETTER'],
    label: 'Dispute letter',
    description: 'Manager-owned bureau dispute letter with client, bureau, and disputed account insertion zones.',
    requiredFields: ['client.name', 'client.addressLines', 'letter.date', 'bureau.name', 'bureau.addressLines'],
    optionalFields: ['client.dob', 'client.ssnMasked', 'letter.round', 'conditional.hasDisputeAccounts', 'conditional.hasHardInquiries'],
    requiredEntities: ['dispute_accounts'],
    optionalEntities: ['hard_inquiries', 'supporting_documents'],
    requiredAnchors: ['FRAUDULENT_ACCOUNTS', 'SIGNATURE'],
    optionalAnchors: ['SUPPORTING_DOCUMENTS', 'LEGAL_DEMAND', 'HARD_INQUIRIES'],
    futureReady: true
  },
  {
    domain: 'LATE_PAYMENT_LETTER',
    documentKinds: ['LATE_PAYMENT_LETTER'],
    label: 'Late payment letter',
    description: 'Manager-owned late-payment goodwill/dispute letter with late-payment entity loops.',
    requiredFields: ['client.name', 'client.addressLines', 'letter.date', 'bureau.name', 'bureau.addressLines'],
    optionalFields: ['client.dob', 'client.ssnMasked', 'letter.round', 'conditional.hasLatePayments'],
    requiredEntities: ['late_payments'],
    optionalEntities: ['supporting_documents'],
    requiredAnchors: ['LATE_PAYMENTS', 'SIGNATURE'],
    optionalAnchors: ['SUPPORTING_DOCUMENTS', 'LEGAL_DEMAND'],
    futureReady: true
  },
  {
    domain: 'AFFIDAVIT',
    documentKinds: ['AFFIDAVIT'],
    label: 'Identity theft affidavit',
    description: 'Editable affidavit output with sworn consumer identity, perjury declaration, disputed accounts, and supporting document references.',
    requiredFields: ['client.name', 'client.addressLines', 'client.ssnMasked', 'letter.date'],
    optionalFields: ['client.dob', 'letter.round', 'affidavit.state', 'affidavit.county', 'ftc.reportNumber', 'ftc.reportDate', 'ftc.statement', 'conditional.hasDisputeAccounts'],
    requiredEntities: ['dispute_accounts'],
    optionalEntities: ['supporting_documents'],
    requiredAnchors: ['CLIENT_INFO', 'FRAUDULENT_ACCOUNTS', 'SIGNATURE'],
    optionalAnchors: ['SUPPORTING_DOCUMENTS', 'LEGAL_DEMAND'],
    futureReady: true
  },
  {
    domain: 'FTC_REPORT',
    documentKinds: ['FTC'],
    label: 'FTC report attachment',
    description: 'Editable FTC support document that can reference report number, report date, consumer statement, and affected accounts.',
    requiredFields: ['client.name', 'client.addressLines', 'letter.date'],
    optionalFields: ['client.dob', 'client.ssnMasked', 'client.phone', 'client.email', 'ftc.reportNumber', 'ftc.reportDate', 'ftc.statement', 'conditional.hasFtcAccounts'],
    requiredEntities: [],
    optionalEntities: ['dispute_accounts', 'supporting_documents'],
    requiredAnchors: ['CLIENT_INFO'],
    optionalAnchors: ['FRAUDULENT_ACCOUNTS', 'SUPPORTING_DOCUMENTS', 'SIGNATURE'],
    futureReady: true
  },
  {
    domain: 'BANKRUPTCY',
    documentKinds: ['DISPUTE_LETTER'],
    label: 'Bankruptcy dispute',
    description: 'Future-ready domain for bankruptcy/public-record correction without a new renderer.',
    requiredFields: ['client.name', 'client.addressLines', 'letter.date', 'bureau.name', 'bureau.addressLines'],
    optionalFields: ['client.dob', 'client.ssnMasked', 'letter.round'],
    requiredEntities: ['bankruptcy_records'],
    optionalEntities: ['supporting_documents', 'public_records'],
    requiredAnchors: ['SIGNATURE'],
    optionalAnchors: ['SUPPORTING_DOCUMENTS', 'LEGAL_DEMAND'],
    futureReady: true
  },
  {
    domain: 'CHEXSYSTEMS',
    documentKinds: ['DISPUTE_LETTER'],
    label: 'ChexSystems dispute',
    description: 'Future-ready bank-reporting domain using the same static preservation, field binding, and entity-block contracts.',
    requiredFields: ['client.name', 'client.addressLines', 'letter.date'],
    optionalFields: ['client.dob', 'client.ssnMasked', 'letter.round'],
    requiredEntities: ['chexsystems_items'],
    optionalEntities: ['supporting_documents', 'custom_items'],
    requiredAnchors: ['SIGNATURE'],
    optionalAnchors: ['SUPPORTING_DOCUMENTS', 'LEGAL_DEMAND'],
    futureReady: true
  }
];

export function domainForDocumentKind(kind: TemplateDocumentKind): TemplateDomainKind {
  if (kind === 'LATE_PAYMENT_LETTER') return 'LATE_PAYMENT_LETTER';
  if (kind === 'AFFIDAVIT') return 'AFFIDAVIT';
  if (kind === 'FTC') return 'FTC_REPORT';
  if (kind === 'DISPUTE_LETTER') return 'DISPUTE_LETTER';
  if (kind === 'FCRA') return 'FCRA_ATTACHMENT';
  return 'CUSTOM';
}

export function managerTemplateDomain(domain: TemplateDomainKind) {
  return MANAGER_TEMPLATE_DOMAIN_REGISTRY.find((contract) => contract.domain === domain) || null;
}

export function managerTemplateDomainForKind(kind: TemplateDocumentKind) {
  return managerTemplateDomain(domainForDocumentKind(kind));
}
