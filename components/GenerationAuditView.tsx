import ConsoleNavLink from './ConsoleNavLink';
import type { GenerationReportRow, GenerationReportSummary } from '../lib/saas/generation-reports';

type Scope = 'master' | 'manager';

type Props = {
  scope: Scope;
  rows: GenerationReportRow[];
  summary: GenerationReportSummary;
  errorMessage?: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function statusLabel(value: string | null | undefined) {
  if (value === 'generated') return 'Generated';
  if (value === 'downloaded') return 'Downloaded';
  if (value === 'failed') return 'Failed';
  return value || 'Unknown';
}

function nav(scope: Scope) {
  if (scope === 'master') {
    return <nav aria-label="Master audit navigation">
      <ConsoleNavLink href="/master">Monitoring</ConsoleNavLink>
      <ConsoleNavLink href="/master/accounts">Accounts</ConsoleNavLink>
      <ConsoleNavLink href="/master/reports">Reports</ConsoleNavLink>
      <ConsoleNavLink className="active" href="/master/audit">Audit</ConsoleNavLink>
      <ConsoleNavLink href="/master/system">System</ConsoleNavLink>
    </nav>;
  }

  return <nav aria-label="Manager audit navigation">
    <ConsoleNavLink href="/admin">Monitoring</ConsoleNavLink>
    <ConsoleNavLink href="/admin/access">Access</ConsoleNavLink>
    <ConsoleNavLink href="/admin?panel=intake">Intake</ConsoleNavLink>
    <ConsoleNavLink href="/admin/reports">Reports</ConsoleNavLink>
    <ConsoleNavLink className="active" href="/admin/audit">Audit</ConsoleNavLink>
  </nav>;
}

export default function GenerationAuditView({ scope, rows, summary, errorMessage }: Props) {
  const latest = rows[0];
  const visibleRows = rows.slice(0, 24);

  return <main className={`admin-monitor-page native-console ${scope === 'master' ? 'master-ops-console' : 'manager-ops-console'}`}>
    <aside className="admin-monitor-sidebar native-console-sidebar">
      <div className="admin-monitor-brand"><span>xD</span><div><strong>xDisputer</strong><small>{scope === 'master' ? 'Master audit' : 'Manager audit'}</small></div></div>
      <div className="admin-sidebar-section-title">Operations</div>
      {nav(scope)}
    </aside>

    <section className="admin-monitor-main native-console-main">
      <header className="admin-monitor-header native-command-hero minimal-report-hero">
        <div>
          <p>{scope === 'master' ? 'Master audit' : 'Manager audit'}</p>
          <h1>Operational events.</h1>
          <span>Concise read-only event stream for generated package activity. Use Reports for deeper filtering and export.</span>
        </div>
      </header>

      {errorMessage ? <section className="admin-monitor-card"><div className="admin-monitor-empty">Could not load audit events: {errorMessage}</div></section> : <>
        <section className="minimal-report-summary" aria-label="Audit summary">
          <article><span>Events</span><strong>{summary.total}</strong><small>Recent generation records</small></article>
          <article className={summary.failed ? 'attention' : 'complete'}><span>Failures</span><strong>{summary.failed}</strong><small>{summary.failed ? 'Review needed' : 'Clear'}</small></article>
          <article><span>Generated</span><strong>{summary.generated}</strong><small>Successful package events</small></article>
          <article><span>Latest</span><strong>{latest ? formatDate(latest.created_at) : '—'}</strong><small>Most recent event</small></article>
        </section>

        <section className="admin-monitor-card native-operation-card minimal-activity-card">
          <div className="admin-monitor-card-header compact-card-header">
            <div><p>Audit stream</p><h2>Recent events</h2></div>
            <ConsoleNavLink className="dashboard-card-link" href={scope === 'master' ? '/master/reports' : '/admin/reports'}>Open reports</ConsoleNavLink>
          </div>
          {visibleRows.length ? <div className="minimal-activity-list audit-event-list" role="list">
            {visibleRows.map((row) => <article key={row.run_id} className="minimal-activity-row audit-event-row" role="listitem">
              <div>
                <strong>{statusLabel(row.output_status)} package event</strong>
                <span>{row.client_name || row.owner_email || 'Client'} · {row.round_label || 'Round not set'} · {formatDate(row.created_at)}</span>
              </div>
              {scope === 'master' && <small>{row.manager_email || 'No manager'}</small>}
              <em className={`admin-status-badge ${row.output_status || 'unknown'}`}>{statusLabel(row.output_status)}</em>
            </article>)}
          </div> : <div className="admin-monitor-empty">No audit events are available yet.</div>}
        </section>
      </>}
    </section>
  </main>;
}
