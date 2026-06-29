import ConsoleNavLink from './ConsoleNavLink';
import ConsoleShell from './console/ConsoleShell';
import type { ConsoleNavItem } from './console/ConsoleShell';
import type { GenerationReportFilters, GenerationReportRow, GenerationReportSummary } from '../lib/saas/generation-reports';

type Scope = 'master' | 'manager';

type Props = {
  scope: Scope;
  accountEmail?: string | null;
  action: string;
  exportHref: string;
  filters: GenerationReportFilters;
  activeCount: number;
  rows: GenerationReportRow[];
  summary: GenerationReportSummary;
  title: string;
  eyebrow: string;
  description: string;
  errorMessage?: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function percent(value: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function topLabel(items: Array<{ label: string; count: number }>, fallback: string) {
  return items[0] ? `${items[0].label} · ${items[0].count}` : fallback;
}

function statusLabel(value: string | null | undefined) {
  if (value === 'generated') return 'Generated';
  if (value === 'downloaded') return 'Downloaded';
  if (value === 'failed') return 'Failed';
  return value || 'Unknown';
}

function reportNavItems(scope: Scope): ConsoleNavItem[] {
  if (scope === 'master') return [
    { href: '/master', label: 'Monitoring' },
    { href: '/master/accounts', label: 'Accounts' },
    { href: '/master/reports', label: 'Reports', active: true },
    { href: '/master/audit', label: 'Audit log' },
    { href: '/master/system', label: 'System health' },
    { href: '/master/recovery', label: 'Recovery ledger' }
  ];
  return [
    { href: '/admin', label: 'Monitoring' },
    { href: '/admin/access', label: 'Access control' },
    { href: '/admin/lifecycle', label: 'Client lifecycle' },
    { href: '/admin/output-queue', label: 'Output queue' },
    { href: '/admin/reports', label: 'Reports', active: true },
    { href: '/admin/audit', label: 'Audit log' },
    { href: '/manager-workspace', label: 'Switch mode', kind: 'workspace-switch' }
  ];
}

function ReportMetricRibbon({ summary }: { summary: GenerationReportSummary }) {
  const successful = summary.generated + summary.downloaded;
  return <section className="report-workbench-ribbon" aria-label="Generation report summary">
    <article><span>Runs</span><strong>{summary.total}</strong><small>{summary.downloaded} downloaded</small></article>
    <article><span>Done</span><strong>{percent(successful, summary.total)}</strong><small>{successful} successful</small></article>
    <article className={summary.failed ? 'attention' : 'complete'}><span>Failures</span><strong>{summary.failed}</strong><small>{summary.failed ? 'Needs review' : 'No failures'}</small></article>
    <article className="report-workbench-wide"><span>Top round</span><strong>{topLabel(summary.byRound, 'No activity')}</strong><small>Highest-volume filing round</small></article>
    <article className="report-workbench-wide"><span>Top client</span><strong>{topLabel(summary.byClient, 'No client activity')}</strong><small>Most recent high-activity account</small></article>
    <article className="report-workbench-wide"><span>State</span><strong>{topLabel(summary.byStatus, 'No status yet')}</strong><small>Dominant output status</small></article>
  </section>;
}

function ReportFilterForm({ action, exportHref, filters, activeCount }: Pick<Props, 'action' | 'exportHref' | 'filters' | 'activeCount'>) {
  return <form action={action} method="get" className="report-workbench-filter-form" aria-label="Generation report filters">
    <div className="report-workbench-section-heading"><div><p>Filters</p><h2>Refine activity</h2></div><span>{activeCount} active</span></div>
    <label className="report-filter-search"><span>Search</span><input name="query" type="search" placeholder="Client, round, or status" defaultValue={filters.query || ''} /></label>
    <label><span>Period</span><select name="period" defaultValue={filters.period || '30d'}><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="all">All time</option></select></label>
    <label><span>Status</span><select name="status" defaultValue={filters.status || ''}><option value="">All</option><option value="generated">Generated</option><option value="downloaded">Downloaded</option><option value="failed">Failed</option></select></label>
    <div className="report-workbench-actions"><button type="submit" className="admin-action-button primary">Apply</button><ConsoleNavLink className="admin-action-button" href={action}>Reset</ConsoleNavLink><a className="admin-action-button" href={exportHref}>Export</a></div>
  </form>;
}

function ActivityStream({ rows, scope }: { rows: GenerationReportRow[]; scope: Scope }) {
  return <section className="report-workbench-activity" aria-label="Recent generation activity">
    <div className="report-workbench-section-heading"><div><p>Activity</p><h2>Recent generation events</h2></div><span>{rows.length} total</span></div>
    {rows.length ? <div className="report-workbench-event-list" role="list" tabIndex={0} aria-label="Scrollable generation report activity">
      {rows.map((row) => <article key={row.run_id} className="report-workbench-event" role="listitem">
        <div><strong>{row.client_name || row.owner_email || 'Client activity'}</strong><span>{row.round_label || 'Round not set'} · {formatDate(row.created_at)}</span></div>
        {scope === 'master' && <small>{row.manager_email || 'No manager'}</small>}
        <em className={`admin-status-badge ${row.output_status || 'unknown'}`}>{statusLabel(row.output_status)}</em>
      </article>)}
    </div> : <div className="admin-monitor-empty">No generation activity matches the current filters.</div>}
  </section>;
}

function ReportWorkbench({ action, exportHref, filters, activeCount, rows, summary, scope }: Pick<Props, 'action' | 'exportHref' | 'filters' | 'activeCount' | 'rows' | 'summary'> & { scope: Scope }) {
  return <section className="admin-monitor-card native-operation-card report-workbench-card" data-report-workbench="filters-activity-merged">
    <ReportMetricRibbon summary={summary} />
    <div className="report-workbench-grid">
      <ReportFilterForm action={action} exportHref={exportHref} filters={filters} activeCount={activeCount} />
      <ActivityStream rows={rows} scope={scope} />
    </div>
  </section>;
}

export default function GenerationReportView({ scope, accountEmail, action, exportHref, filters, activeCount, rows, summary, title, eyebrow, description, errorMessage }: Props) {
  const isMaster = scope === 'master';
  return <ConsoleShell role={scope} mode="operations" email={accountEmail} accountLabel={isMaster ? 'Master account' : 'Manager account'} brandSubtitle={isMaster ? 'Master reports' : 'Manager reports'} sidebarSectionTitle="Operations" navItems={reportNavItems(scope)} switchTarget={isMaster ? '/admin' : '/manager-workspace'} switchTargetLabel={isMaster ? 'Manager console' : 'Manager workspace'} navAriaLabel={isMaster ? 'Master reports navigation' : 'Manager reports navigation'} activeNavUsesConsoleLink header={{ eyebrow, title, description }}>
    {errorMessage ? <section className="admin-monitor-card"><div className="admin-monitor-empty">Could not load generation report: {errorMessage}</div></section> : <ReportWorkbench action={action} exportHref={exportHref} filters={filters} activeCount={activeCount} rows={rows} summary={summary} scope={scope} />}
  </ConsoleShell>;
}
