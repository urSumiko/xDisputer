import type { ClientCanonicalSourceData } from '../../lib/client-template-runtime';

export default function ClientSourceMappingCard({ sourceData }: { sourceData: ClientCanonicalSourceData }) {
  return <article className="client-template-runtime-card" data-client-source-mapping-card="true" data-source-status={sourceData.sourceStatus}>
    <p className="eyebrow">Source data mapping</p>
    <strong>{sourceData.sourceStatus === 'ready' ? 'Canonical fields ready' : 'Source data needs review'}</strong>
    <span>{sourceData.missingRequiredFields.length ? `Missing: ${sourceData.missingRequiredFields.join(', ')}` : 'Client source data is ready for manager-approved template fields.'}</span>
  </article>;
}
