import { dynamicFieldRegistry, type DynamicCanonicalFieldKey } from '../dynamic-template/field-registry';
import { normalizeTemplateAnchorText, type DocxStructureMap } from '../dynamic-template-intelligence';
import type { TemplateDomainKind } from './template-domain-registry';
import { managerTemplateDomain } from './template-domain-registry';

export type TemplateFieldBindingStatus = 'mapped' | 'missing' | 'optional' | 'needs-review';

export type TemplateFieldBindingDraft = {
  domain: TemplateDomainKind;
  fieldKey: DynamicCanonicalFieldKey;
  sourcePath: string;
  placeholderText: string | null;
  paragraphIndex: number | null;
  runIndex: number | null;
  required: boolean;
  bindingStatus: TemplateFieldBindingStatus;
  confidence: number;
  reason: string;
};

function findPlaceholder(structure: DocxStructureMap, aliases: string[]) {
  for (const paragraph of structure.paragraphs) {
    const normalized = normalizeTemplateAnchorText(paragraph.text);
    for (const alias of aliases) {
      const aliasVariants = [alias, `{{${alias}}}`, `[[${alias}]]`, `«${alias}»`].map(normalizeTemplateAnchorText);
      if (aliasVariants.some((candidate) => normalized.includes(candidate))) {
        return { paragraphIndex: paragraph.index, placeholderText: alias, confidence: 0.96, reason: `Placeholder alias ${alias} found in paragraph ${paragraph.index + 1}.` };
      }
    }
  }
  return null;
}

export function resolveTemplateFieldBindings(structure: DocxStructureMap, domain: TemplateDomainKind): TemplateFieldBindingDraft[] {
  const contract = managerTemplateDomain(domain);
  const requiredFields = new Set(contract?.requiredFields || []);
  const optionalFields = new Set(contract?.optionalFields || []);
  const wanted = Array.from(new Set(Array.from(requiredFields).concat(Array.from(optionalFields))));

  return wanted.map((fieldKey) => {
    const definition = dynamicFieldRegistry.find((field) => field.key === fieldKey);
    const match = definition ? findPlaceholder(structure, definition.aliases) : null;
    const required = requiredFields.has(fieldKey);
    if (match) {
      return {
        domain,
        fieldKey,
        sourcePath: definition?.dataPath || fieldKey,
        placeholderText: match.placeholderText,
        paragraphIndex: match.paragraphIndex,
        runIndex: null,
        required,
        bindingStatus: 'mapped',
        confidence: match.confidence,
        reason: match.reason
      } satisfies TemplateFieldBindingDraft;
    }
    return {
      domain,
      fieldKey,
      sourcePath: definition?.dataPath || fieldKey,
      placeholderText: null,
      paragraphIndex: null,
      runIndex: null,
      required,
      bindingStatus: required ? 'needs-review' : 'optional',
      confidence: required ? 0 : 0.4,
      reason: required ? 'Required field is not represented by an explicit placeholder. The manager can map it or allow canonical fallback insertion.' : 'Optional field is not explicitly mapped.'
    } satisfies TemplateFieldBindingDraft;
  });
}

export function missingRequiredFieldBindings(bindings: TemplateFieldBindingDraft[]) {
  return bindings.filter((binding) => binding.required && binding.bindingStatus !== 'mapped');
}
