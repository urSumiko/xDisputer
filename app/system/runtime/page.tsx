import { requireRole } from '../../../lib/saas/session';
import { confirmRuntimeBridge } from '../../../lib/saas/runtime-confirmation';

function label(status: string) {
  if (status === 'pass') return 'PASS';
  if (status === 'warn') return 'WARN';
  return 'FAIL';
}

export default async function RuntimeBridgePage() {
  await requireRole('master');
  const report = await confirmRuntimeBridge();

  return (
    <main className="admin-monitor-page native-console system-runtime-page">
      <aside className="admin-monitor-sidebar native-console-sidebar">
        <div className="admin-monitor-brand">
          <span>xD</span>
          <div><strong>xDisputer</strong><small>Runtime bridge</small></div>
        </div>

        <div className="admin-sidebar-section-title">Runtime</div>
        <nav aria-label="Runtime bridge navigation">
          <a className="active" href="/system/runtime">Runtime bridge</a>
          <a href="/system/templates">Template registry</a>
          <a href="/system/confirm">Auto confirm</a>
          <a href="/system/health">System health</a>
          <a href="/master?panel=reports">Master reports</a>
        </nav>
      </aside>

      <section className="admin-monitor-main native-console-main">
        <header className="admin-monitor-header native-command-hero master-compact-hero">
          <div>
            <p>Runtime bridge</p>
            <h1>{label(report.summary.status)} — Supabase + Vercel wiring.</h1>
            <span>
              {report.summary.passed} passed, {report.summary.warned} warning(s), {report.summary.failed} failed.
            </span>
          </div>
        </header>

        <section className="admin-power-grid">
          {report.groups.map((group) => (
            <article key={group.name} className="admin-monitor-card native-operation-card">
              <div className="admin-monitor-card-header">
                <div><p>Runtime group</p><h2>{group.name}</h2></div>
                <span>{group.checks.length} checks</span>
              </div>

              <div className="admin-power-list">
                {group.checks.map((check) => (
                  <span key={`${group.name}-${check.name}`}>
                    <strong>{label(check.status)} — {check.name}</strong><br />
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
