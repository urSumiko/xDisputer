import type { ClientTemplateRuntimeContext } from '../../lib/client-template-runtime';

export default function ClientGenerationActionBar({ context }: { context: ClientTemplateRuntimeContext }) {
  return <form className="client-template-action-bar" action="/api/client-template-runtime/generate" method="post" data-client-generation-action-bar="true">
    <div><p className="eyebrow">Final generation gate</p><strong>{context.canGenerate ? 'Ready to generate' : 'Needs attention'}</strong><span>{context.issues[0] || 'Manager template, source data, rules, review scope, and limit are connected.'}</span></div>
    <button type="submit" disabled={!context.canGenerate}>{context.canGenerate ? 'Generate with manager template' : 'Generation locked'}</button>
  </form>;
}
