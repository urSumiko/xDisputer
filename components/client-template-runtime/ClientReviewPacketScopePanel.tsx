import type { ClientReviewPacketScope } from '../../lib/client-template-runtime';

export default function ClientReviewPacketScopePanel({ packetScope }: { packetScope: ClientReviewPacketScope }) {
  const required = Array.isArray(packetScope.packetScope.requiredSections) ? packetScope.packetScope.requiredSections.map(String) : [];
  return <article className="client-template-runtime-card wide" data-client-review-packet-scope-panel="true" data-review-status={packetScope.reviewStatus}>
    <p className="eyebrow">Review packet scope</p>
    <strong>{packetScope.reviewStatus}</strong>
    <span>{required.length ? required.join(' - ') : 'The review packet will show source data, template, attachments, and result review steps.'}</span>
  </article>;
}
