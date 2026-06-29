import type { DynamicTemplateRule } from '../templates/intelligence';
import type { AppliedClientTemplateRules } from './client-template-types';
import { readCanonicalValue } from './client-template-source-mapping';

export function applyManagerRulesToClientData(input: { rules: DynamicTemplateRule[]; canonicalData: Record<string, unknown> }): AppliedClientTemplateRules {
  const preserved: Array<Record<string, unknown>> = [];
  const injected: Array<Record<string, unknown>> = [];
  const issues: string[] = [];
  const warnings: string[] = [];

  for (const rule of [...input.rules].sort((a, b) => a.priority - b.priority)) {
    if (!rule.enabled) continue;
    if (rule.validationState === 'blocked') {
      issues.push(rule.validationReason || `Manager rule is blocked: ${rule.ruleKey}`);
      continue;
    }
    if (rule.preserve || rule.ruleType === 'preserve-static-text' || rule.ruleType === 'declaration-rule') {
      preserved.push({ ruleKey: rule.ruleKey, sourceText: rule.sourceText, ruleType: rule.ruleType, reason: 'Manager rule preserves this content.' });
      continue;
    }
    if (rule.ruleType === 'canonical-field-map' || rule.ruleType === 'replace-variable') {
      const value = readCanonicalValue(input.canonicalData, rule.canonicalField);
      if ((value === null || value === undefined || value === '') && rule.required) {
        issues.push(`Missing required canonical field: ${rule.canonicalField || rule.ruleKey}`);
        continue;
      }
      injected.push({ ruleKey: rule.ruleKey, token: rule.outputToken, canonicalField: rule.canonicalField, value });
      continue;
    }
    if (rule.ruleType === 'table-layout') {
      warnings.push(`Table layout requires renderer validation: ${rule.ruleKey}`);
      preserved.push({ ruleKey: rule.ruleKey, sourceText: rule.sourceText, ruleType: rule.ruleType, reason: 'Table structure is preserved while rows can render dynamically.' });
      continue;
    }
    if (rule.ruleType === 'blocker-rule') {
      issues.push(rule.validationReason || `Blocked by manager rule: ${rule.ruleKey}`);
      continue;
    }
    warnings.push(`Manager rule needs review in generation preview: ${rule.ruleKey}`);
  }

  return { preserved, injected, issues, warnings, ready: issues.length === 0 };
}
