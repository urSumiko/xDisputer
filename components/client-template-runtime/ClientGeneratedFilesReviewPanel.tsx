import type { ClientTemplateRuntimeContext } from '../../lib/client-template-runtime';

export default function ClientGeneratedFilesReviewPanel({ context }: { context: ClientTemplateRuntimeContext }) {
  return <article className="client-template-runtime-card" data-client-generated-files-review-panel="true">
    <p className="eyebrow">Output review</p>
    <strong>{context.generatedFiles.length ? `${context.generatedFiles.length} file(s)` : 'No output yet'}</strong>
    <span>Result files stay tied to manager, client, template, round, and event scope.</span>
  </article>;
}
