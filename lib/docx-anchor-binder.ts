import { anchorPolicy, type TemplateAnchorKind } from './dynamic-template-intelligence';

export type DocxAnchorCategory = 'FRAUDULENT_ACCOUNTS' | 'HARD_INQUIRIES' | 'LATE_PAYMENTS' | 'CLIENT_INFO';

export type DocxAnchorBinding = {
  category: DocxAnchorCategory;
  label: string;
  required: boolean;
  inventWhenMissing: boolean;
  confidenceFloor: number;
  aliases: string[];
};

function binding(category: DocxAnchorCategory, label: string): DocxAnchorBinding {
  const policy = anchorPolicy(category as TemplateAnchorKind);
  return {
    category,
    label,
    required: policy.required,
    inventWhenMissing: policy.canAutoCreate,
    confidenceFloor: policy.confidenceFloor,
    aliases: policy.aliases
  };
}

export const DOCX_ANCHOR_BINDINGS: DocxAnchorBinding[] = [
  binding('CLIENT_INFO', 'Client information'),
  binding('FRAUDULENT_ACCOUNTS', 'Fraudulent accounts / disputed accounts insertion zone'),
  binding('HARD_INQUIRIES', 'Hard inquiries'),
  binding('LATE_PAYMENTS', 'Late payments')
];

export function anchorBinding(category: DocxAnchorCategory) {
  return DOCX_ANCHOR_BINDINGS.find((item) => item.category === category);
}

export function anchorLabel(category: DocxAnchorCategory) {
  return anchorBinding(category)?.label || category;
}

export function shouldInventAnchor(category: DocxAnchorCategory) {
  return Boolean(anchorBinding(category)?.inventWhenMissing);
}

export function anchorConfidenceFloor(category: DocxAnchorCategory) {
  return anchorBinding(category)?.confidenceFloor || 0.75;
}

export function anchorAliasCandidates(category: DocxAnchorCategory) {
  return anchorBinding(category)?.aliases || [];
}
