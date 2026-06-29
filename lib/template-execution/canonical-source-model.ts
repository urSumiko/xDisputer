import { bureauInfo, type Bureau, type LetterRoute, type ParsedSource } from '../letter-engine';
import type { Round } from '../reference-store';
import type { TemplateDocumentKind } from '../template-contracts';
import { profileForDocumentKind, type DynamicCanonicalFieldKey } from '../dynamic-template/field-registry';
import type { DynamicRenderPlanValue } from '../dynamic-template/mapping-engine';
import type { MappedAppendixContext, MappedAppendixKind } from '../supplemental-template-renderer';

function nonEmpty(value: unknown) {
  return typeof value === 'string'
    ? value.trim().length > 0
    : Array.isArray(value)
      ? value.length > 0
      : Boolean(value);
}

function normalizedTemplateFields(parsed: ParsedSource) {
  const fields = { ...(parsed.templateFields || {}) } as Record<string, string>;
  const ftcStatement = fields.ftcStatement || fields.ftc_statement || '';
  return { ...fields, ftcStatement, ftc_statement: ftcStatement };
}

function routeAccountRows(route: LetterRoute | null | undefined) {
  return (route?.items || []).map((item, index) => {
    const lines = item.displayText.split('\n').map((line) => line.trim()).filter(Boolean);
    const accountName = (lines.find((line) => /^(?:Account|Creditor|Furnisher|Company)\s+Name\s*:/i.test(line)) || '').replace(/^(?:Account|Creditor|Furnisher|Company)\s+Name\s*:\s*/i, '');
    const accountNumber = (lines.find((line) => /^Account\s+Number\s*:/i.test(line)) || '').replace(/^Account\s+Number\s*:\s*/i, '');
    return {
      index: String(index + 1),
      number: String(index + 1),
      display_text: item.displayText,
      account_line: [accountName, accountNumber].filter(Boolean).join(' — ') || item.displayText,
      account_name: accountName,
      account_number: accountNumber
    };
  });
}

function hardInquiryRows(route: LetterRoute | null | undefined) {
  return (route?.items || [])
    .filter((item) => item.type === 'HARD_INQUIRY')
    .map((item, index) => ({
      index: String(index + 1),
      number: String(index + 1),
      inquiry_line: item.displayText,
      display_text: item.displayText
    }));
}

function ftcRows(parsed: ParsedSource) {
  return (parsed.ftcAccounts || []).map((item, index) => ({
    index: String(index + 1),
    number: String(index + 1),
    account_name: item.accountName,
    account_number: item.accountNumber,
    fraud_began: item.fraudBegan,
    date_discovered: item.dateDiscovered,
    fraudulent_amount: item.fraudulentAmount,
    display_text: [
      item.accountName ? `Account Name: ${item.accountName}` : '',
      item.accountNumber ? `Account Number: ${item.accountNumber}` : '',
      item.dateDiscovered ? `Date Discovered: ${item.dateDiscovered}` : '',
      item.fraudulentAmount ? `Fraudulent Amount: ${item.fraudulentAmount}` : ''
    ].filter(Boolean).join('\n')
  }));
}

function bureauName(route?: LetterRoute | null) {
  return route?.bureau ? bureauInfo[route.bureau].name : '';
}

function bureauAddress(route?: LetterRoute | null) {
  return route?.bureau ? bureauInfo[route.bureau].address.split('\n') : [];
}

export class CanonicalSourceModel {
  readonly parsed: ParsedSource;
  readonly templateFields: Record<string, string>;

  constructor(parsed: ParsedSource) {
    this.parsed = parsed;
    this.templateFields = normalizedTemplateFields(parsed);
  }

  valueForField(input: {
    key: DynamicCanonicalFieldKey;
    route?: LetterRoute | null;
    round: Round;
    documentDate: string;
  }): DynamicRenderPlanValue {
    const { key, route, round, documentDate } = input;
    const parsed = this.parsed;

    switch (key) {
      case 'client.name':
        return { canonicalKey: key, value: parsed.name, available: nonEmpty(parsed.name), source: 'parsed.name' };
      case 'client.addressLines':
        return { canonicalKey: key, value: parsed.address, available: nonEmpty(parsed.address), source: 'parsed.address' };
      case 'client.dob':
        return { canonicalKey: key, value: parsed.dob, available: nonEmpty(parsed.dob), source: 'parsed.dob' };
      case 'client.ssnMasked':
        return { canonicalKey: key, value: parsed.ssn, available: nonEmpty(parsed.ssn), source: 'parsed.ssn' };
      case 'client.email':
        return { canonicalKey: key, value: parsed.email, available: nonEmpty(parsed.email), source: 'parsed.email' };
      case 'client.phone':
        return { canonicalKey: key, value: parsed.phone, available: nonEmpty(parsed.phone), source: 'parsed.phone' };
      case 'letter.date':
        return { canonicalKey: key, value: documentDate, available: nonEmpty(documentDate), source: 'documentDate' };
      case 'letter.round':
        return { canonicalKey: key, value: round, available: nonEmpty(round), source: 'round' };
      case 'bureau.name':
        return { canonicalKey: key, value: bureauName(route), available: nonEmpty(bureauName(route)), source: 'route.bureau.name' };
      case 'bureau.addressLines':
        return { canonicalKey: key, value: bureauAddress(route), available: nonEmpty(bureauAddress(route)), source: 'route.bureau.address' };
      case 'accounts.dispute': {
        const rows = route?.type === 'DISPUTE' ? routeAccountRows(route) : [];
        return { canonicalKey: key, value: rows, available: rows.length > 0, source: 'route.items[DISPUTE_ACCOUNT]' };
      }
      case 'accounts.latePayments': {
        const rows = route?.type === 'LATE_PAYMENT' ? routeAccountRows(route) : [];
        return { canonicalKey: key, value: rows, available: rows.length > 0, source: 'route.items[LATE_PAYMENT]' };
      }
      case 'accounts.ftcAffected': {
        const rows = ftcRows(parsed);
        return { canonicalKey: key, value: rows, available: rows.length > 0, source: 'parsed.ftcAccounts' };
      }
      case 'inquiries.hard': {
        const rows = hardInquiryRows(route);
        return { canonicalKey: key, value: rows, available: rows.length > 0, source: 'route.items[HARD_INQUIRY]' };
      }
      case 'affidavit.state':
        return { canonicalKey: key, value: parsed.affidavitState, available: nonEmpty(parsed.affidavitState), source: 'parsed.affidavitState' };
      case 'affidavit.county':
        return { canonicalKey: key, value: parsed.affidavitCounty, available: nonEmpty(parsed.affidavitCounty), source: 'parsed.affidavitCounty' };
      case 'ftc.reportNumber':
        return { canonicalKey: key, value: parsed.ftcReportNumber, available: nonEmpty(parsed.ftcReportNumber), source: 'parsed.ftcReportNumber' };
      case 'ftc.reportDate':
        return { canonicalKey: key, value: parsed.ftcReportDate, available: nonEmpty(parsed.ftcReportDate), source: 'parsed.ftcReportDate' };
      case 'ftc.statement':
        return { canonicalKey: key, value: this.templateFields.ftcStatement || '', available: nonEmpty(this.templateFields.ftcStatement), source: 'parsed.templateFields.ftcStatement' };
      case 'conditional.hasDisputeAccounts':
        return { canonicalKey: key, value: route?.type === 'DISPUTE' && route.items.length > 0, available: true, source: 'route.items.length > 0' };
      case 'conditional.hasLatePayments':
        return { canonicalKey: key, value: route?.type === 'LATE_PAYMENT' && route.items.length > 0, available: true, source: 'route.items.length > 0' };
      case 'conditional.hasHardInquiries':
        return { canonicalKey: key, value: hardInquiryRows(route).length > 0, available: true, source: 'route.items[HARD_INQUIRY].length > 0' };
      case 'conditional.hasFtcAccounts':
        return { canonicalKey: key, value: ftcRows(parsed).length > 0, available: true, source: 'parsed.ftcAccounts.length > 0' };
    }
  }

  valueMap(input: { kind: TemplateDocumentKind; route?: LetterRoute | null; round: Round; documentDate: string }) {
    const profile = profileForDocumentKind(input.kind);
    const keys = Array.from(new Set([...profile.requiredFields, ...profile.optionalFields]));
    return new Map(keys.map((key) => [key, this.valueForField({ key, route: input.route, round: input.round, documentDate: input.documentDate })]));
  }

  legacyDisputeValues(route: LetterRoute, documentDate: string) {
    const disputeItems = route.items.filter((item) => item.type !== 'HARD_INQUIRY').map((item) => item.displayText);
    const hardInquiryItems = route.items.filter((item) => item.type === 'HARD_INQUIRY').map((item) => item.displayText);
    return {
      consumerName: this.parsed.name,
      addressLines: this.parsed.address.length ? this.parsed.address : ['N/A'],
      dob: this.parsed.dob,
      ssn: this.parsed.ssn,
      letterDate: documentDate,
      bureauName: bureauInfo[route.bureau].name,
      bureauAddressLines: bureauInfo[route.bureau].address.split('\n'),
      disputeItems,
      hardInquiryItems,
      fraudItems: route.items.map((item) => item.displayText)
    };
  }

  legacyLateValues(route: LetterRoute, documentDate: string) {
    return {
      consumerName: this.parsed.name,
      addressLines: this.parsed.address.length ? this.parsed.address : ['N/A'],
      dob: this.parsed.dob,
      ssn: this.parsed.ssn,
      letterDate: documentDate,
      bureauName: bureauInfo[route.bureau].name,
      bureauAddressLines: bureauInfo[route.bureau].address.split('\n'),
      latePaymentItems: route.items.map((item) => item.displayText)
    };
  }

  appendixContext(input: { kind: MappedAppendixKind; bureau: Bureau; round: Round; documentDate: string }): MappedAppendixContext {
    return {
      kind: input.kind,
      bureau: input.bureau,
      round: input.round,
      documentDate: input.documentDate,
      recipientName: bureauInfo[input.bureau].name,
      recipientAddressLines: bureauInfo[input.bureau].address.split('\n'),
      source: this.parsed
    };
  }
}

export function createCanonicalSourceModel(parsed: ParsedSource) {
  return new CanonicalSourceModel(parsed);
}
