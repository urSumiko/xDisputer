import ConsoleNavLink from '../ConsoleNavLink';
import type { ConsolePanelManifest } from '../../lib/console/contracts/navigation-manifest';

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return <article className="admin-monitor-card native-operation-card console-transformation-block">
    <div className="admin-monitor-card-header"><div><p>{title}</p><h2>{items.length} wired item{items.length === 1 ? '' : 's'}</h2></div></div>
    <div className="admin-power-list">{items.map((item) => <span key={item}>{item}</span>)}</div>
  </article>;
}

export default function ConsoleTransformationPanel({ panel, relatedPanels }: { panel: ConsolePanelManifest; relatedPanels: ConsolePanelManifest[] }) {
  return <div className="console-transformation-panel" data-console-panel-id={panel.id} data-console-panel-domain={panel.domain} data-console-panel-capability={panel.capability}>
    <section className="admin-monitor-card native-operation-card console-transformation-summary">
      <div className="admin-monitor-card-header"><div><p>{panel.capability}</p><h2>{panel.label}</h2></div><span className="admin-status-badge active">{panel.status}</span></div>
      <p>{panel.purpose}</p>
      <div className="admin-power-list"><span><strong>Who:</strong> {panel.fiveW.who}</span><span><strong>What:</strong> {panel.fiveW.what}</span><span><strong>When:</strong> {panel.fiveW.when}</span><span><strong>Where:</strong> {panel.fiveW.where}</span><span><strong>Why:</strong> {panel.fiveW.why}</span></div>
    </section>

    <section className="admin-power-grid" aria-label={`${panel.label} implementation contract`}>
      <ListBlock title="How it works" items={panel.how} />
      <ListBlock title="What-if handling" items={panel.whatIf} />
      <ListBlock title="If / else routing" items={panel.ifElse} />
      <ListBlock title="Wired processes" items={panel.wiredProcesses} />
      <ListBlock title="Integration points" items={panel.integrationPoints} />
      <ListBlock title="Data contracts" items={panel.dataContracts} />
      <ListBlock title="Verification" items={panel.verification} />
      <ListBlock title="Not responsible for" items={panel.notResponsibleFor} />
    </section>

    <section className="admin-monitor-card native-operation-card console-transformation-route-map">
      <div className="admin-monitor-card-header"><div><p>Panel family</p><h2>Related navigation</h2></div></div>
      <div className="dashboard-snapshot-list manager-monitor-list">
        {relatedPanels.map((related) => <article key={related.id} className="manager-monitor-item"><div><strong>{related.label}</strong><span>{related.capability}</span></div><ConsoleNavLink className="dashboard-card-link" href={related.href}>{related.href === panel.href ? 'Current' : 'Open'}</ConsoleNavLink></article>)}
      </div>
    </section>
  </div>;
}
