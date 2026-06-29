import type { DynamicTemplateRule } from '../../lib/templates/intelligence';

export default function ClientManagerTemplatePreview({ templateAsset, dynamicRules }: { templateAsset: Record<string, unknown> | null; dynamicRules: DynamicTemplateRule[] }) {
  return <article className="client-template-runtime-card wide" data-client-manager-template-preview="true">
    <p className="eyebrow">Manager template preview</p>
    <strong>{templateAsset ? String(templateAsset.original_filename || 'Manager-approved template') : 'No active manager template'}</strong>
    <span>{dynamicRules.length} manager rule(s) are connected to this client runtime.</span>
  </article>;
}
