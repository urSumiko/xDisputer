import type { TemplateContract, TemplateDocumentKind, TemplateFieldContract } from './template-contracts';

export type TemplateGovernanceRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
export type TemplateGovernanceStatus = 'READY' | 'NEEDS_REVIEW' | 'BLOCKED';

export type TemplateIntentSlot =
  | 'CLIENT_IDENTITY'
  | 'CLIENT_ADDRESS'
  | 'DOCUMENT_DATE'
  | 'BUREAU_ROUTING'
  | 'ACCOUNT_DETAILS'
  | 'AFFIDAVIT_JURISDICTION'
  | 'FTC_DETAILS'
  | 'STATIC_APPENDIX';

export type TemplateGovernanceIssue = {
  code: string;
  severity: 'info' | 'warning' | 'blocker';
  message: string;
  why: string;
  fix: string;
};

export type TemplateGovernanceResult = {
  version: 1;
  kind: TemplateDocumentKind;
  status: TemplateGovernanceStatus;
  risk: TemplateGovernanceRisk;
  confidence: number;
  detectedSlots: TemplateIntentSlot[];
  missingSlots: TemplateIntentSlot[];
  requiredFields: string[];
  optionalFields: string[];
  customFields: string[];
  loopFields: string[];
  issues: TemplateGovernanceIssue[];
  whatIfs: TemplateGovernanceIssue[];
  storagePolicy: {
    useLatestActiveOnly: boolean;
    keepRollbackVersions: number;
    archiveOlderVersions: boolean;
    deleteArchivedStorageWhenSafe: boolean;
  };
};

export type SourceCompletenessResult = {
  version: 1;
  status: TemplateGovernanceStatus;
  confidence: number;
  missing: string[];
  warnings: string[];
  accountCount: number;
};

const INTENT_FIELDS: Record<TemplateIntentSlot, string[]> = {
  CLIENT_IDENTITY: ['consumer_name', 'client_name', 'name', 'full_name'],
  CLIENT_ADDRESS: ['address', 'consumer_address', 'client_address', 'mailing_address', 'address_inline', 'address_line_1'],
  DOCUMENT_DATE: ['current_date', 'today', 'generated_date', 'date', 'letter_date', 'document_date'],
  BUREAU_ROUTING: ['bureau', 'credit_bureau', 'bureau_full_name', 'bureau_name', 'bureau_address', 'bureau_address_line_1'],
  ACCOUNT_DETAILS: ['account_lines', 'accounts', 'affected_accounts', 'ftc_accounts', 'dispute_accounts'],
  AFFIDAVIT_JURISDICTION: ['affidavit_state', 'affidavit_county'],
  FTC_DETAILS: ['ftc_report_number', 'ftc_report_date', 'ftc_statement', 'report_number', 'report_date', 'statement'],
  STATIC_APPENDIX: []
};

const REQUIRED_INTENTS: Record<TemplateDocumentKind, TemplateIntentSlot[]> = {
  DISPUTE_LETTER: ['CLIENT_IDENTITY', 'CLIENT_ADDRESS', 'DOCUMENT_DATE', 'BUREAU_ROUTING', 'ACCOUNT_DETAILS'],
  LATE_PAYMENT_LETTER: ['CLIENT_IDENTITY', 'CLIENT_ADDRESS', 'DOCUMENT_DATE', 'BUREAU_ROUTING', 'ACCOUNT_DETAILS'],
  AFFIDAVIT: ['CLIENT_IDENTITY', 'CLIENT_ADDRESS', 'DOCUMENT_DATE', 'AFFIDAVIT_JURISDICTION', 'ACCOUNT_DETAILS'],
  FTC: ['CLIENT_IDENTITY', 'CLIENT_ADDRESS', 'FTC_DETAILS'],
  FCRA: ['STATIC_APPENDIX'],
  ATTACHMENT: ['STATIC_APPENDIX']
};

const SOFT_INTENTS = new Set<TemplateIntentSlot>(['FTC_DETAILS', 'STATIC_APPENDIX']);

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function fieldKeys(contract: TemplateContract) {
  return unique([
    ...(contract.tags || []),
    ...(contract.loops || []),
    ...(contract.fields || []).map((field) => field.key),
    ...(contract.customFields || []).map((field) => field.key)
  ]);
}

function hasIntent(keys: Set<string>, intent: TemplateIntentSlot, contract: TemplateContract) {
  if (intent === 'STATIC_APPENDIX') return contract.mode === 'STATIC';
  return INTENT_FIELDS[intent].some((key) => keys.has(key));
}

function issue(input: TemplateGovernanceIssue): TemplateGovernanceIssue {
  return input;
}

function scoreFrom(blockers: number, warnings: number, detected: number, required: number) {
  if (blockers > 0) return Math.max(25, 65 - blockers * 15 - warnings * 4);
  if (!required) return 100;
  const base = Math.round((detected / required) * 100);
  return Math.max(50, Math.min(100, base - warnings * 5));
}

function riskFrom(status: TemplateGovernanceStatus, confidence: number): TemplateGovernanceRisk {
  if (status === 'BLOCKED') return 'BLOCKED';
  if (confidence >= 92) return 'LOW';
  if (confidence >= 75) return 'MEDIUM';
  return 'HIGH';
}

export function buildTemplateGovernance(contract: TemplateContract): TemplateGovernanceResult {
  const keys = new Set(fieldKeys(contract));
  const requiredIntents = REQUIRED_INTENTS[contract.kind] || [];
  const detectedSlots = requiredIntents.filter((intent) => hasIntent(keys, intent, contract));
  const missingSlots = requiredIntents.filter((intent) => !detectedSlots.includes(intent));
  const issues: TemplateGovernanceIssue[] = [];
  const whatIfs: TemplateGovernanceIssue[] = [];

  missingSlots.forEach((intent) => {
    const severity = SOFT_INTENTS.has(intent) ? 'warning' : 'blocker';
    issues.push(issue({
      code: `MISSING_${intent}`,
      severity,
      message: `${intent.replace(/_/g, ' ').toLowerCase()} was not detected in this template contract.`,
      why: 'Consistent output requires stable semantic slots even when the visual template design changes.',
      fix: `Add one of these placeholders: ${(INTENT_FIELDS[intent] || []).join(', ') || 'none required for static files'}.`
    }));
  });

  if (contract.mode === 'LEGACY_HIGHLIGHTED' || contract.mode === 'REFERENCE_LAYOUT') {
    whatIfs.push(issue({
      code: 'LEGACY_LAYOUT_CAN_CHANGE',
      severity: 'warning',
      message: 'The template can still render, but layout-only detection is less reliable than explicit placeholders.',
      why: 'If wording or sections move, the system needs semantic tags to know intent instead of guessing from layout.',
      fix: 'Prefer explicit {{client_name}}, {{address}}, {{bureau_name}}, and {{#accounts}} style tags for production templates.'
    }));
  }

  if (contract.customFields.length) {
    whatIfs.push(issue({
      code: 'CUSTOM_FIELDS_REQUIRE_SOURCE_DATA',
      severity: 'warning',
      message: `${contract.customFields.length} custom field(s) were detected.`,
      why: 'Custom fields can preserve dynamic templates, but generation must verify that Source Data provides each required custom value.',
      fix: 'Add custom field inputs to Source Data or mark the field optional in the template contract policy.'
    }));
  }

  whatIfs.push(issue({
    code: 'LATEST_ACTIVE_TEMPLATE_ONLY',
    severity: 'info',
    message: 'Generation should always use the newest active template version for the owner, round, and template type.',
    why: 'This prevents old file versions from contradicting the current business logic.',
    fix: 'Archive previous versions during upload and resolve active templates by owner + round + type.'
  }));

  const blockerCount = issues.filter((item) => item.severity === 'blocker').length;
  const warningCount = issues.filter((item) => item.severity === 'warning').length + whatIfs.filter((item) => item.severity === 'warning').length;
  const status: TemplateGovernanceStatus = blockerCount ? 'BLOCKED' : warningCount ? 'NEEDS_REVIEW' : 'READY';
  const confidence = scoreFrom(blockerCount, warningCount, detectedSlots.length, requiredIntents.length);

  return {
    version: 1,
    kind: contract.kind,
    status,
    risk: riskFrom(status, confidence),
    confidence,
    detectedSlots,
    missingSlots,
    requiredFields: unique(contract.fields.filter((field: TemplateFieldContract) => field.required).map((field) => field.key)),
    optionalFields: unique(contract.fields.filter((field: TemplateFieldContract) => !field.required).map((field) => field.key)),
    customFields: unique(contract.customFields.map((field) => field.key)),
    loopFields: unique(contract.loops),
    issues,
    whatIfs,
    storagePolicy: {
      useLatestActiveOnly: true,
      keepRollbackVersions: 1,
      archiveOlderVersions: true,
      deleteArchivedStorageWhenSafe: true
    }
  };
}

export function evaluateSourceCompleteness(input: {
  clientName?: string | null;
  addressLines?: string[];
  accountItems?: Array<{ name?: string | null; accountName?: string | null; accountNumber?: string | null; number?: string | null }>;
  customFields?: Record<string, string | null | undefined>;
  requiredCustomFields?: string[];
}): SourceCompletenessResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  const accountItems = input.accountItems || [];

  if (!input.clientName?.trim()) missing.push('client.name');
  if (!(input.addressLines || []).some((line) => line.trim())) missing.push('client.address');
  if (!accountItems.length) missing.push('accounts[]');

  accountItems.forEach((item, index) => {
    if (!(item.name || item.accountName)?.trim()) missing.push(`accounts[${index}].name`);
    if (!(item.accountNumber || item.number)?.trim()) missing.push(`accounts[${index}].number`);
  });

  (input.requiredCustomFields || []).forEach((key) => {
    if (!input.customFields?.[key]?.trim()) missing.push(`customFields.${key}`);
  });

  if (accountItems.length > 50) warnings.push('Large account packet detected. Use strict review before final PDF assembly.');

  const status: TemplateGovernanceStatus = missing.length ? 'BLOCKED' : warnings.length ? 'NEEDS_REVIEW' : 'READY';
  const confidence = missing.length ? Math.max(30, 100 - missing.length * 12) : warnings.length ? 90 : 100;

  return { version: 1, status, confidence, missing, warnings, accountCount: accountItems.length };
}

export function auditRenderedText(input: {
  text: string;
  clientName?: string | null;
  accountNumbers?: string[];
  accountNames?: string[];
}) {
  const text = input.text || '';
  const unresolved = Array.from(text.matchAll(/\{\{\s*[^}]+\s*\}\}/g)).map((match) => match[0]);
  const missingClientName = Boolean(input.clientName?.trim() && !text.toLowerCase().includes(input.clientName.trim().toLowerCase()));
  const missingAccountNumbers = (input.accountNumbers || []).filter((value) => value && !text.includes(value));
  const missingAccountNames = (input.accountNames || []).filter((value) => value && !text.toLowerCase().includes(value.toLowerCase()));
  const blockers = [
    ...unresolved.map((value) => `Unresolved placeholder: ${value}`),
    ...(missingClientName ? ['Client name missing from rendered output.'] : []),
    ...missingAccountNumbers.map((value) => `Account number missing: ${value}`),
    ...missingAccountNames.map((value) => `Account name missing: ${value}`)
  ];

  return {
    version: 1,
    status: blockers.length ? 'BLOCKED' as const : 'READY' as const,
    blockers,
    unresolved,
    missingAccountNumbers,
    missingAccountNames,
    missingClientName
  };
}
