import TableFlyout from '../../../components/TableFlyout';
import ConsoleNavLink from '../../../components/ConsoleNavLink';
import ConsoleShell from '../../../components/console/ConsoleShell';
import {
  directoryQueryString,
  getManagerClientSummary,
  listManagerClientDirectory,
  normalizeDirectoryParams,
  type DirectoryView
} from '../../../lib/saas/account-directory';
import type { ManagedAccount } from '../../../lib/saas/account-management';
import { listEntitlementLimits, type EntitlementLimitMap, type EntitlementLimitRow } from '../../../lib/saas/entitlement-limits';
import { requireRole } from '../../../lib/saas/session';

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function formatDate(value: string | null | undefined) { if (!value) return '—'; const date = new Date(value); if (Number.isNaN(date.getTime())) return '—'; return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date); }
function statusText(value: string | null | undefined) { if (value === 'pending_manager_assignment') return 'Waiting'; if (value === 'pending_manager_approval') return 'Pending'; if (value === 'active') return 'Active'; if (value === 'suspended') return 'Suspended'; if (value === 'disabled') return 'Disabled'; return value || 'Pending'; }
function viewTitle(view: string) { if (view === 'pending') return 'Pending approval'; if (view === 'active') return 'Active disputers'; if (view === 'blocked') return 'Disabled / suspended'; return 'Access Control'; }
function viewDescription(view: string) { if (view === 'pending') return 'Review disputers waiting for manager approval. Master-set disputer limits remain enforced by Supabase.'; if (view === 'active') return 'Review active disputers and their daily output usage under the master-set agreement limit.'; if (view === 'blocked') return 'Review disabled or suspended disputer accounts without exposing unnecessary account data.'; return 'Approve disputers, monitor capacity, and review daily output usage from one compact control page.'; }
function formatLimit(value: number | null | undefined) { return typeof value === 'number' ? String(value) : 'Default'; }
function usageLabel(entitlement?: EntitlementLimitRow) { return `${entitlement?.output_used_today || 0}/${formatLimit(entitlement?.effective_output_limit)} outputs today`; }

const managerAccessNavItems = [
  { href: '/admin', label: 'Monitoring' },
  { href: '/admin/access', label: 'Access Control', active: true },
  { href: '/admin?panel=intake', label: 'Disputer intake' },
  { href: '/admin?panel=review', label: 'Review queue' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/audit', label: 'Audit log' },
  { href: '/manager-workspace', label: 'Switch mode', kind: 'workspace-switch' as const }
];

function ControlForm({ profileId, intent, label, primary = false }: { profileId: string; intent: string; label: string; primary?: boolean }) { return <form action="/api/control/profile" method="post"><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="intent" value={intent} /><button type="submit" className={`admin-action-button ${primary ? 'primary' : ''}`}>{label}</button></form>; }
function DisputerControls({ account }: { account: ManagedAccount }) { return <div className="admin-actions-row flyout-actions">{account.account_status === 'pending_manager_approval' && <><ControlForm profileId={account.id} intent="approve" label="Approve" primary /><ControlForm profileId={account.id} intent="reject" label="Reject" /></>}{account.account_status === 'active' && <ControlForm profileId={account.id} intent="disable" label="Disable" />}{(account.account_status === 'disabled' || account.account_status === 'suspended') && <ControlForm profileId={account.id} intent="activate" label="Reactivate" primary />}</div>; }
function DisputerTrigger({ account, entitlement }: { account: ManagedAccount; entitlement?: EntitlementLimitRow }) { return <span className="account-control-trigger-grid manager-client-trigger-grid"><span className="account-control-identity"><strong>{account.full_name || account.email || 'Unnamed disputer'}</strong><small>{account.email || 'Disputer account'}</small></span><span className={`admin-status-badge ${account.account_status || 'pending'}`}>{statusText(account.account_status)}</span><span className="account-control-agreement"><strong>{usageLabel(entitlement)}</strong><small>Open controls</small></span><span className="account-control-meta"><small>Joined</small><strong>{formatDate(account.created_at)}</strong></span><span className="account-control-meta"><small>Updated</small><strong>{formatDate(account.updated_at)}</strong></span></span>; }
function DisputerFlyout({ account, entitlement }: { account: ManagedAccount; entitlement?: EntitlementLimitRow }) { return <TableFlyout eyebrow="Disputer account" title={account.full_name || account.email || 'Disputer'} summary={usageLabel(entitlement)} actionLabel="Details" triggerClassName="account-control-row-trigger" trigger={<DisputerTrigger account={account} entitlement={entitlement} />}><section className="table-flyout-section"><strong>Daily output usage</strong><div className="manager-limit-usage"><strong>{usageLabel(entitlement)}</strong><small>Master-set entitlement</small></div></section><section className="table-flyout-section"><strong>Account actions</strong><DisputerControls account={account} /></section></TableFlyout>; }
function DirectoryFilter({ view, query }: { view: string; query: string }) { return <form action="/admin/access" method="get" className="directory-filter-form"><input type="hidden" name="view" value={view} /><label><span>Search</span><input name="q" type="search" placeholder="Disputer email, name, status, or manager" defaultValue={query} /></label><button className="admin-action-button primary" type="submit">Search</button><ConsoleNavLink className="admin-action-button" href={`/admin/access${directoryQueryString({ view })}`}>Reset</ConsoleNavLink></form>; }
function Pager({ view, query, page, pageSize, total }: { view: string; query: string; page: number; pageSize: number; total: number }) { const totalPages = Math.max(1, Math.ceil(total / pageSize)); const previous = Math.max(1, page - 1); const next = Math.min(totalPages, page + 1); return <div className="directory-pager"><span>Page {page} of {totalPages}</span><div><ConsoleNavLink className={`admin-action-button ${page <= 1 ? 'disabled' : ''}`} href={`/admin/access${directoryQueryString({ view, q: query, page: previous, pageSize })}`}>Previous</ConsoleNavLink><ConsoleNavLink className={`admin-action-button ${page >= totalPages ? 'disabled' : ''}`} href={`/admin/access${directoryQueryString({ view, q: query, page: next, pageSize })}`}>Next</ConsoleNavLink></div></div>; }
function DisputerList({ accounts, entitlements }: { accounts: ManagedAccount[]; entitlements: EntitlementLimitMap }) { if (!accounts.length) return <div className="admin-monitor-empty">No workspace disputers match this dataset.</div>; return <div className="account-control-list">{accounts.map((item) => <DisputerFlyout key={item.id} account={item} entitlement={entitlements[item.id]} />)}</div>; }

export default async function AdminAccessPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const directoryParams = normalizeDirectoryParams(params);
  const selectedView = ['pending', 'active', 'blocked', 'all'].includes(directoryParams.view) ? directoryParams.view as DirectoryView : 'overview';
  const { user, profile, supabase } = await requireRole('manager');
  const [{ summary, errorMessage: summaryError }, directory] = await Promise.all([
    getManagerClientSummary(supabase),
    selectedView === 'overview' ? Promise.resolve({ accounts: [], total: 0, page: 1, pageSize: directoryParams.pageSize, errorMessage: null }) : listManagerClientDirectory(supabase, { view: selectedView, query: directoryParams.query, page: directoryParams.page, pageSize: directoryParams.pageSize })
  ]);
  const entitlementResult = selectedView === 'overview' ? await listEntitlementLimits(supabase, [user.id]) : await listEntitlementLimits(supabase, [user.id, ...directory.accounts.map((account) => account.id)]);
  const managerEntitlement = entitlementResult.entitlements[user.id];
  const headerTitle = selectedView === 'overview' ? 'Access Control' : `${viewTitle(selectedView)}.`;
  const headerDescription = selectedView === 'overview' ? 'Disputer limits are controlled by the master account. Managers see capacity and daily usage in compact records.' : viewDescription(selectedView);

  return <ConsoleShell role="manager" mode="operations" email={profile?.email || user.email || 'Manager account'} accountLabel="Manager account" brandSubtitle="Manager console" sidebarSectionTitle="Operations" navItems={managerAccessNavItems} switchTarget="/manager-workspace" switchTargetLabel="Manager workspace" navAriaLabel="Manager access navigation" activeNavUsesConsoleLink header={{ eyebrow: 'Manager console', title: headerTitle, description: headerDescription }}>
    {(summaryError || directory.errorMessage || entitlementResult.errorMessage) && <section className="admin-monitor-card"><div className="admin-monitor-empty">{summaryError || directory.errorMessage || entitlementResult.errorMessage}</div></section>}
    <section className="minimal-report-summary manager-entitlement-summary" aria-label="Manager entitlement summary"><article><span>Disputer seats</span><strong>{managerEntitlement?.current_clients || summary.active}/{formatLimit(managerEntitlement?.max_clients)}</strong><small>Master agreement</small></article><article><span>Default outputs</span><strong>{formatLimit(managerEntitlement?.default_client_output_limit)}</strong><small>Per disputer per day</small></article><article><span>Active disputers</span><strong>{summary.active}</strong><small>Approved accounts</small></article><article><span>Pending</span><strong>{summary.pending}</strong><small>Waiting approval</small></article></section>
    {selectedView === 'overview' ? <section className="progressive-dataset-grid access-workflow-grid"><ConsoleNavLink className="progressive-dataset-card access-workflow-card" href="/admin/access?view=pending"><p>Access Control</p><h2>Pending approval</h2><span>{summary.pending} pending</span><strong>Review disputers waiting for manager approval.</strong></ConsoleNavLink><ConsoleNavLink className="progressive-dataset-card access-workflow-card" href="/admin/access?view=active"><p>Disputer usage</p><h2>Active disputers</h2><span>{summary.active} active</span><strong>Review daily output usage under the master-set limit.</strong></ConsoleNavLink><ConsoleNavLink className="progressive-dataset-card access-workflow-card" href="/admin/access?view=blocked"><p>Access Control</p><h2>Disabled / suspended</h2><span>{summary.blocked} blocked</span><strong>Review blocked disputer accounts.</strong></ConsoleNavLink><ConsoleNavLink className="progressive-dataset-card access-workflow-card" href="/admin/audit"><p>Audit</p><h2>Access history</h2><span>Events</span><strong>Review approval and account-control history.</strong></ConsoleNavLink></section> : <section className="admin-dataset-stack single-header-dataset"><section className="admin-monitor-card native-operation-card"><DirectoryFilter view={selectedView} query={directoryParams.query} /><DisputerList accounts={directory.accounts} entitlements={entitlementResult.entitlements} /><Pager view={selectedView} query={directoryParams.query} page={directory.page} pageSize={directory.pageSize} total={directory.total} /></section></section>}
  </ConsoleShell>;
}
