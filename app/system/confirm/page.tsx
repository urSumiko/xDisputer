import { requireRole } from '../../../lib/saas/session';
import { confirmOperationalSetup } from '../../../lib/saas/operational-confirmation';

function statusText(status: string) {
  if (status === 'pass') return 'PASS';
  if (status === 'warn') return 'WARN';
  return 'FAIL';
}

export default async function SystemConfirmPage() {
  await requireRole('master');
  const report = await confirmOperationalSetup();

  return (
    <main className="admin-monitor-page native-console system-health-page">
      <aside className="admin-monitor-sidebar native-console-sidebar">
        <div className="admin-monitor-brand">
          <span>xD</span>
          <div><strong>xDisputer</strong><small>System confirm</small></div>
        </div>

        <div className="admin-sidebar-section-title">Automation</div>
        <nav aria-label="System confirmation navigation">
          <a className="active" href="/system/confirm">Auto confirm</a>
          <a href="/system/templates">Template registry</a>
          <a href="/system/health">System health</a>
          <a href="/master?panel=reports">Master reports</a>
        </nav>
      </aside>

      <section className="admin-monitor-main native-console-main">
        <header className="admin-monitor-header native-command-hero master-compact-hero">
          <div>
            <p>Automated confirmation</p>
            <h1>{statusText(report.summary.status)} — setup check.</h1>
            <span>
              {report.summary.passed} passed, {report.summary.warned} warning(s), {report.summary.failed} failed.
            </span>
          </div>
        </header>

        <section className="admin-power-grid">
          {report.groups.map((group) => (
            <article key={group.name} className="admin-monitor-card native-operation-card">
              <div className="admin-monitor-card-header">
                <div><p>Confirmation group</p><h2>{group.name}</h2></div>
                <span>{group.checks.length} checks</span>
              </div>

              <div className="admin-power-list">
                {group.checks.map((check) => (
                  <span key={`${group.name}-${check.name}`}>
                    <strong>{statusText(check.status)} — {check.name}</strong><br />
                    {check.message}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
