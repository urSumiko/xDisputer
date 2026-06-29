import ConsoleNavLink from '../../components/ConsoleNavLink';
import ConsoleShell from '../../components/console/ConsoleShell';
import MasterKpiGrid from '../../src/features/master-console/components/MasterKpiGrid';
import { redirect } from 'next/navigation';
import { getMasterAccountSummary, listMasterAttentionQueue, type AccountDirectoryRow } from '../../lib/saas/account-directory';
import { requireRole } from '../../lib/saas/session';

type PageProps = { searchParams?: Promise<{ panel?: string | string[]; control?: string | string[]; message?: string | string[]; view?: string | string[] }> };

function stringParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function formatDate(value: string | null | undefined) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date); }

function StatusList({ accounts }: { accounts: AccountDirectoryRow[] }) {
  if (!accounts.length) return <div className="admin-monitor-empty">No accounts need attention right now.</div>;
  return <div className="dashboard-snapshot-list master-monitor-list">{accounts.slice(0, 5).map((account) => <article key={account.id} className="master-monitor-item"><div><strong>{account.full_name || account.email || 'Unnamed account'}</strong><span>{account.email || 'Account record'} • Updated {formatDate(account.updated_at)}</span></div><span className={`admin-status-badge ${account.account_status || 'pending'}`}>{account.account_status || 'pending'}</span></article>)}</div>;
}

function SnapshotFooter({ count, total, href }: { count: number; total: number; href: string }) {
  return <div className="dashboard-snapshot-footer"><span>Showing 1-{Math.min(count, total)} of {total}</span><ConsoleNavLink className="dashboard-card-link" href={href}>View all</ConsoleNavLink></div>;
}

const masterNavItems = [
  { href: '/master', label: 'Monitoring', active: true },
  { href: '/master/accounts', label: 'All accounts' },
  { href: '/master/reports', label: 'Reports' },
  { href: '/master/audit', label: 'Audit log' },
  { href: '/master/system', label: 'System health' }
];

export default async function MasterConsoleHome({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const rawPanel = stringParam(params.panel);
  const rawView = stringParam(params.view);
  if (rawPanel === 'access' || rawPanel === 'managers' || rawPanel === 'clients') {
    const view = rawPanel === 'managers' ? 'managers' : rawPanel === 'clients' ? 'clients' : rawView;
    redirect(view ? `/master/accounts?view=${encodeURIComponent(view)}` : '/master/accounts');
  }

  const controlStatus = stringParam(params.control);
  const controlMessage = stringParam(params.message);
  const { user, profile, supabase } = await requireRole('master');
  const [summaryResult, attentionResult] = await Promise.all([getMasterAccountSummary(supabase), listMasterAttentionQueue(supabase, 5)]);
  const summary = summaryResult.summary;
  const queryError = summaryResult.errorMessage || attentionResult.errorMessage;
  const attention = attentionResult.accounts;
  const attentionTotal = attentionResult.total || summary.pending + summary.blocked;
  const coverageRate = summary.clients ? Math.round((summary.linked / summary.clients) * 100) : 0;
  const email = profile?.email || user.email || 'Master account';

  return <ConsoleShell
    role="master"
    mode="operations"
    email={email}
    accountLabel="Master account"
    brandSubtitle="Master console"
    sidebarSectionTitle="Operations"
    navItems={masterNavItems}
    switchTarget="/admin"
    switchTargetLabel="Manager console"
    navAriaLabel="Master navigation"
    activeNavUsesConsoleLink
    header={{ eyebrow: 'Master operations', title: 'Manager command center.', description: 'Compact account RPC reads keep this dashboard fast while disputer directories stay paginated.' }}
  >
    {controlStatus && <section className={`admin-monitor-card admin-feedback-card ${controlStatus === 'ok' ? 'success' : 'error'}`}><strong>{controlStatus === 'ok' ? 'Action completed' : 'Action failed'}</strong><span>{controlStatus === 'ok' ? 'The console has refreshed with the latest account state.' : controlMessage || 'Unknown error.'}</span></section>}
    {queryError ? <section className="admin-monitor-card"><div className="admin-monitor-empty">Could not load account records: {queryError}</div></section> : <><MasterKpiGrid summary={summary} attentionTotal={attentionTotal} /><section className="admin-power-grid"><article className="admin-monitor-card native-operation-card dashboard-snapshot-card"><div className="admin-monitor-card-header"><div><p>Monitoring</p><h2>Attention queue</h2></div><ConsoleNavLink className="dashboard-card-link" href="/master/accounts?view=pending">View pending</ConsoleNavLink></div><StatusList accounts={attention} /><SnapshotFooter count={attention.length} total={attentionTotal} href="/master/accounts?view=pending" /></article><article className="admin-monitor-card native-operation-card dashboard-snapshot-card"><div className="admin-monitor-card-header"><div><p>Coverage</p><h2>Disputer-manager assignment</h2></div><ConsoleNavLink className="dashboard-card-link" href="/master/accounts?view=clients">View disputers</ConsoleNavLink></div><div className="dashboard-snapshot-list"><div className="admin-power-list"><span>Linked disputers: {summary.linked}</span><span>Unassigned disputers: {summary.unassigned}</span><span>Managers available: {summary.managers}</span><span>Coverage rate: {coverageRate}%</span></div></div><SnapshotFooter count={4} total={4} href="/master/accounts?view=clients" /></article></section></>}
  </ConsoleShell>;
}
