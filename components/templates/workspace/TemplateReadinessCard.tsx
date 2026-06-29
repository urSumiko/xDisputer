import { readinessLabel, type TemplateWorkspaceContract } from '../../../lib/templates/workspace/template-workspace-contract';

export default function TemplateReadinessCard({ contract, summary, action }: { contract: TemplateWorkspaceContract; summary: string; action?: { href: string; label: string; reason: string } }) {
  const statusClass = contract.readiness === 'ready' ? 'ready' : contract.readiness === 'blocked' ? 'blocked' : 'attention';
  return <section className="admin-monitor-card template-workspace-readiness" data-template-readiness={contract.readiness} data-template-sync={contract.library.syncStatus}>
    <div className="template-workspace-readiness-copy">
      <p className="eyebrow">Dynamic template readiness</p>
      <strong>{readinessLabel(contract.readiness)}</strong>
      <span>{summary}</span>
    </div>
    <div className="template-workspace-readiness-grid" aria-label="Template workspace readiness metrics">
      <span><b>{contract.library.templatesCount}</b><small>Templates</small></span>
      <span><b>{contract.studio.mappingsCount}</b><small>Mapped fields</small></span>
      <span><b>{contract.studio.unmappedVariablesCount}</b><small>Unmapped</small></span>
      <span><b>{contract.engine.blockers.length}</b><small>Issues</small></span>
    </div>
    {action ? <a className={`template-workspace-next-action ${statusClass}`} href={action.href}><span>{action.label}</span><small>{action.reason}</small></a> : null}
  </section>;
}
