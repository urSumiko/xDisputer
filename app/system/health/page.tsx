import { requireRole } from '../../../lib/saas/session';
import { getSystemHealthReport, type HealthStatus } from '../../../lib/saas/system-health';

function statusLabel(status: HealthStatus) {
  if (status === 'pass') return 'Pass';
  if (status === 'warn') return 'Warn';
  return 'Fail';
}

export default async function SystemHealthPage() {
  await requireRole('master');
  const report = await getSystemHealthReport();

  return (
    <main className="admin-monitor-page native-console system-health-page">
      <aside className="admin-monitor-sidebar native-console-sidebar">
        <div className="admin-monitor-brand">
          <span>xD</span>
          <div><strong>xDisputer</strong><small>System health</small></div>
        </div>

        <div className="admin-sidebar-section-title">Diagnostics</div>
        <nav aria-label="System health navigation">
          <a className="active" href="/system/health">Health report</a>
          <a href="/master?panel=monitoring">Master monitoring</a>
          <a href="/master?panel=access">Access control</a>
          <a href="/master?panel=reports">Reports</a>
          <a href="/api/system/health">JSON report</a>
        </nav>
      </aside>

      <section className="admin-monitor-main native-console-main">
        <header className="admin-monitor-header native-command-hero master-compact-hero">
          <div>
            <p>Control-plane diagnostics</p>
            <h1>System health report.</h1>
            <span>Verify environment, auth, database, RPC functions, and control routes before testing UI buttons.</span>
          </div>
        </header>

        <section className="admin-monitor-stats" aria-label="Health summary">
          <article><p>Status</p><strong>{statusLabel(report.summary.status)}</strong></article>
          <article><p>Pass</p><strong>{report.summary.pass}</strong></article>
          <article><p>Warn</p><strong>{report.summary.warn}</strong></article>
          <article><p>Fail</p><strong>{report.summary.fail}</strong></article>
        </section>

        <section className="system-health-grid">
          {report.groups.map((group) => (
            <article key={group.name} className="admin-monitor-card native-operation-card">
              <div className="admin-monitor-card-header">
                <div><p>Health group</p><h2>{group.name}</h2></div>
                <span>{group.checks.length} checks</span>
              </div>
              <div className="system-health-list">
                {group.checks.map((item) => (
                  <div key={`${group.name}-${item.name}`} className={`system-health-item ${item.status}`}>
                    <strong>{item.name}</strong>
                    <span>{item.message}</span>
                    <em>{statusLabel(item.status)}</em>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
