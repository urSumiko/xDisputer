import type { ClientTemplateRuntimeContext } from '../../lib/client-template-runtime';
import ClientGeneratedFilesReviewPanel from './ClientGeneratedFilesReviewPanel';
import ClientGenerationActionBar from './ClientGenerationActionBar';
import ClientManagerTemplatePreview from './ClientManagerTemplatePreview';
import ClientOutputLimitCard from './ClientOutputLimitCard';
import ClientReviewPacketScopePanel from './ClientReviewPacketScopePanel';
import ClientSourceMappingCard from './ClientSourceMappingCard';
import ClientTemplateAssignmentCard from './ClientTemplateAssignmentCard';

export default function ClientTemplateRuntimeDashboard({ context }: { context: ClientTemplateRuntimeContext }) {
  return <section className="client-template-runtime" data-client-template-runtime="true" data-client-can-generate={context.canGenerate ? 'true' : 'false'}>
    <header className="client-template-runtime-header">
      <p className="eyebrow">Client template runtime</p>
      <h2>Manager-approved reusable template flow</h2>
      <span>Assignment, source mapping, dynamic rules, review scope, output limits, and files are resolved together.</span>
    </header>
    <div className="client-template-runtime-grid">
      <ClientTemplateAssignmentCard assignment={context.assignment} />
      <ClientOutputLimitCard outputLimit={context.outputLimit} />
      <ClientSourceMappingCard sourceData={context.sourceData} />
      <ClientManagerTemplatePreview templateAsset={context.templateAsset} dynamicRules={context.dynamicRules} />
      <ClientReviewPacketScopePanel packetScope={context.packetScope} />
      <ClientGeneratedFilesReviewPanel context={context} />
    </div>
    <ClientGenerationActionBar context={context} />
  </section>;
}
