export type TemplateAnchorKind =
  | 'CLIENT_INFO'
  | 'DISPUTE_ACCOUNTS'
  | 'FRAUDULENT_ACCOUNTS'
  | 'HARD_INQUIRIES'
  | 'LATE_PAYMENTS'
  | 'SUPPORTING_DOCUMENTS'
  | 'LEGAL_DEMAND'
  | 'SIGNATURE'
  | 'CUSTOM_SECTION';

export type AnchorAliasRule = {
  kind: TemplateAnchorKind;
  required: boolean;
  canAutoCreate: boolean;
  confidenceFloor: number;
  aliases: string[];
  negativeAliases?: string[];
};

export const TEMPLATE_ANCHOR_ALIAS_REGISTRY: AnchorAliasRule[] = [
  {
    kind: 'CLIENT_INFO',
    required: true,
    canAutoCreate: false,
    confidenceFloor: 0.7,
    aliases: ['DOB:', 'SSN:', 'CONSUMER NAME', 'CLIENT NAME', 'ADDRESS']
  },
  {
    kind: 'FRAUDULENT_ACCOUNTS',
    required: true,
    canAutoCreate: true,
    confidenceFloor: 0.72,
    aliases: [
      'FRAUDULENT ACCOUNTS FOR IMMEDIATE BLOCKING AND DELETION',
      'FRAUDULENT ACCOUNTS',
      'DISPUTED ACCOUNTS',
      'DISPUTE ACCOUNTS',
      'ACCOUNTS FOR DELETION',
      'ACCOUNTS TO BLOCK',
      'ACCOUNTS IDENTIFIED BELOW',
      'IDENTITY THEFT ACCOUNTS',
      'UNAUTHORIZED ACCOUNTS',
      'TRADELINES TO DELETE',
      'TRADLINES TO DELETE',
      'ACCOUNT NAME:',
      'ACCOUNT NUMBER:'
    ],
    negativeAliases: ['SUPPORTING DOCUMENTS', 'SINCERELY', 'CC:', 'LEGAL DEMAND', 'NOTICE OF LIABILITY']
  },
  {
    kind: 'DISPUTE_ACCOUNTS',
    required: true,
    canAutoCreate: true,
    confidenceFloor: 0.72,
    aliases: [
      'DISPUTED ACCOUNTS',
      'DISPUTE ACCOUNTS',
      'ACCOUNTS IN DISPUTE',
      'NEGATIVE ACCOUNTS',
      'UNVERIFIED ACCOUNTS',
      'INACCURATE ACCOUNTS',
      'ACCOUNT NAME:',
      'ACCOUNT NUMBER:'
    ],
    negativeAliases: ['SUPPORTING DOCUMENTS', 'SINCERELY', 'CC:', 'LEGAL DEMAND']
  },
  {
    kind: 'HARD_INQUIRIES',
    required: false,
    canAutoCreate: true,
    confidenceFloor: 0.68,
    aliases: ['HARD INQUIRIES', 'HARD CREDIT INQUIRIES', 'INQUIRIES', 'INQUIRY NAME:', 'INQUIRY DATE:']
  },
  {
    kind: 'LATE_PAYMENTS',
    required: false,
    canAutoCreate: true,
    confidenceFloor: 0.68,
    aliases: ['LATE PAYMENTS', 'LATE PAYMENT ACCOUNTS', 'PAYMENT HISTORY', 'LATE PAYMENT ITEMS']
  },
  {
    kind: 'SUPPORTING_DOCUMENTS',
    required: false,
    canAutoCreate: true,
    confidenceFloor: 0.68,
    aliases: ['SUPPORTING DOCUMENTS ENCLOSED', 'SUPPORTING DOCUMENTS', 'ENCLOSURES', 'DOCUMENTS ENCLOSED']
  },
  {
    kind: 'LEGAL_DEMAND',
    required: false,
    canAutoCreate: false,
    confidenceFloor: 0.7,
    aliases: ['LEGAL DEMAND', 'NOTICE OF DUTY', 'REQUIRED ACTIONS', 'NOTICE OF LIABILITY', 'INTENT TO ENFORCE RIGHTS']
  },
  {
    kind: 'SIGNATURE',
    required: true,
    canAutoCreate: true,
    confidenceFloor: 0.7,
    aliases: ['SINCERELY', 'RESPECTFULLY', 'I DECLARE UNDER PENALTY OF PERJURY', 'REGARDS', 'THANK YOU']
  }
];

export function normalizeTemplateAnchorText(value: string) {
  return value.replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function anchorAliases(kind: TemplateAnchorKind) {
  return TEMPLATE_ANCHOR_ALIAS_REGISTRY.find((rule) => rule.kind === kind) || null;
}

export function anchorPolicy(kind: TemplateAnchorKind) {
  return anchorAliases(kind) || { kind, required: false, canAutoCreate: false, confidenceFloor: 0.75, aliases: [] };
}

export function aliasMatches(text: string, alias: string) {
  const source = normalizeTemplateAnchorText(text);
  const target = normalizeTemplateAnchorText(alias);
  return source === target || source.includes(target) || target.includes(source);
}

export function tokenSimilarity(a: string, b: string) {
  const left = new Set(normalizeTemplateAnchorText(a).split(/\W+/).filter(Boolean));
  const right = new Set(normalizeTemplateAnchorText(b).split(/\W+/).filter(Boolean));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  Array.from(left).forEach((token) => {
    if (right.has(token)) overlap += 1;
  });
  return overlap / Math.max(left.size, right.size);
}
