import type { TemplateAnchorKind } from './anchor-alias-registry';

export type TemplateInsertionMode = 'replace-detected-items' | 'insert-after-heading' | 'insert-before-next-section' | 'append-before-signature';

export type TemplateManagerRule = {
  id?: string;
  templateAssetId?: string;
  templateFamilyKey?: string | null;
  anchorKind: TemplateAnchorKind;
  anchorLabel?: string;
  insertMode: TemplateInsertionMode;
  paragraphIndex?: number | null;
  paragraphFingerprint?: string | null;
  matchedText?: string | null;
  confidence?: number;
  source?: 'manager-rule' | 'system-default' | 'migration';
  appliesToFutureVersions?: boolean;
  ruleStatus?: 'active' | 'disabled' | 'superseded';
};

export function activeManagerRules(rules: TemplateManagerRule[] = []) {
  return rules.filter((rule) => (rule.ruleStatus || 'active') === 'active');
}

export function managerRuleForAnchor(rules: TemplateManagerRule[] = [], anchorKind: TemplateAnchorKind) {
  return activeManagerRules(rules).find((rule) => rule.anchorKind === anchorKind) || null;
}

export function paragraphFingerprint(text: string) {
  let hash = 0;
  const normalized = text.replace(/\s+/g, ' ').trim().toUpperCase();
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }
  return `p-${Math.abs(hash).toString(16)}`;
}
