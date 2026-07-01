import ConsoleNavLink from '../../../components/ConsoleNavLink';
import ConsoleShell from '../../../components/console/ConsoleShell';
import {
  directoryQueryString,
  getMasterAccountSummary,
  listMasterAccountDirectory,
  normalizeDirectoryParams,
  type DirectoryView
} from '../../../lib/saas/account-directory';
import { listEntitlementLimits } from '../../../lib/saas/entitlement-limits';
import MasterAccountTable, { type AssignedDisputerPreview } from '../MasterAccountTableV2';
import { requireRole } from '../../../lib/saas/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
type SupabaseClient = Awaited<ReturnType<typeof requireRole>>['supabase'];

type AssignedRow = AssignedDisputerPreview & { manager_id: string | null };

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function viewTitle(view: string) {
  if (view === 'managers') return 'Manager accounts';
  if (view === 'clients') return 'Disputer accounts';
  if (view === 'pending') return 'Pending / unassigned disputers';
  if (view === 'blocked') return 'Disabled / suspended accounts';
  return 'Account directory';
}

function viewDescription(view: string) {
  if (view === 'managers') return 'Set manager seats, output caps, and inspect each manager’s assigned Disputers from one compact control.';
  if (view === 'clients') return 'Assign boss managers, set Disputer output caps, and review access state without duplicated account headers.';
  if (view === 'pending') return 'Find Disputers who need manager assignment or approval and keep access control focused.';
  if (view === 'blocked') return 'Review accounts that cannot use the platform and take only the needed account action.';
  return 'Edit manager limits, boss assignments, and daily Disputer output limits from the Master account.';
}

function bossOptionsFromManagers(accounts: Array<{ id: string; full_name?: string | null; email?: string | null }>) {
  return accounts.map((account) => ({ id: account.id, label: account.full_name || account.email || 'Manager account', email: account.email || null }));
}

function DirectoryFilter({ view, query }: { view: string; query: string }) {
  return <form action="/master/accounts" method="get" className="directory-filter-form master-directory-filter-compact" data-layout-zone="dataset-toolbar"><input type="hidden" name="view" value={view} /><label><span>Search</span><input name="q" type="search" placeholder="Email, name, role, status, manager, or invite code" defaultValue={query} /></label><button className="admin-action-button primary" type="submit">Search</button><ConsoleNavLink className="admin-action-button" href={`/master/accounts${directoryQueryString({ view })}`}>Reset</ConsoleNavLink></form>;
}

function Pager({ view, query, page, pageSize, total }: { view: string; query: string; page: number; pageSize: number; total: number }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const previous = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  return <div className="directory-pager master-directory-pager-compact" data-layout-zone="dataset-pagination"><span>Page {page} of {totalPages}</span><div><ConsoleNavLink className={`admin-action-button ${page <= 1 ? 'disabled' : ''}`} href={`/master/accounts${directoryQueryString({ view, q: query, page: previous, pageSize })}`}>Previous</ConsoleNavLink><ConsoleNavLink className={`admin-action-button ${page >= totalPages ? 'disabled' : ''}`} href={`/master/accounts${directoryQueryString({ view, q: query, page: next, pageSize })}`}>Next</ConsoleNavLink></div></div>;
}

const masterAccountNavItems = [
  { href: '/master', label: 'Monitoring' },
  { href: '/master/accounts', label: 'All accounts', active: true },
  { href: '/master/reports', label: 'Reports' },
  { href: '/master/audit', label: 'Audit log' },
  { href: '/master/system', label: 'System health' }
];

function managerIdsFrom(accounts: Array<{ id: string; role: string | null }>) {
  return accounts.filter((account) => account.role === 'manager' || account.role === 'admin').map((account) => account.id).filter(Boolean);
}

async function listAssignedDisputersByManager(supabase: SupabaseClient, managerIds: string[]) {
  const ids = Array.from(new Set(managerIds.filter(Boolean)));
  if (!ids.length) return {} as Record<string, AssignedDisputerPreview[]>;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,account_status,updated_at,manager_id')
    .eq('role', 'client')
    .in('manager_id', ids)
    .in('account_status', ['active', 'pending_manager_approval'])
    .order('updated_at', { ascending: false });

  if (error || !Array.isArray(data)) return {} as Record<string, AssignedDisputerPreview[]>;

  return (data as AssignedRow[]).reduce<Record<string, AssignedDisputerPreview[]>>((map, row) => {
    const managerId = row.manager_id || '';
    if (!managerId) return map;
    map[managerId] = [...(map[managerId] || []), { id: row.id, email: row.email, full_name: row.full_name, account_status: row.account_status, updated_at: row.updated_at }];
    return map;
  }, {});
}

export default async function MasterAccountsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const directoryParams = normalizeDirectoryParams(params);
  const selectedView = ['managers', 'clients', 'pending', 'blocked', 'all'].includes(directoryParams.view) ? directoryParams.view as DirectoryView : 'overview';
  const controlStatus = stringParam(params.control);
  const controlMessage = stringParam(params.message);
  const { user, profile, supabase } = await requireRole('master');
  const needsBossOptions = selectedView === 'clients' || selectedView === 'pending' || selectedView === 'all';

  const [{ summary, errorMessage: summaryError }, directory, managerDirectory] = await Promise.all([
    getMasterAccountSummary(supabase),
    selectedView === 'overview' ? Promise.resolve({ accounts: [], total: 0, page: 1, pageSize: directoryParams.pageSize, errorMessage: null }) : listMasterAccountDirectory(supabase, { view: selectedView, query: directoryParams.query, page: directoryParams.page, pageSize: directoryParams.pageSize }),
    needsBossOptions ? listMasterAccountDirectory(supabase, { view: 'managers', page: 1, pageSize: 25 }) : Promise.resolve({ accounts: [], total: 0, page: 1, pageSize: 25, errorMessage: null })
  ]);

  const managerIds = managerIdsFrom(directory.accounts);
  const [entitlementResult, assignedDisputersByManager] = selectedView === 'overview'
    ? [{ entitlements: {}, errorMessage: null }, {} as Record<string, AssignedDisputerPreview[]>]
    : await Promise.all([
      listEntitlementLimits(supabase, directory.accounts.map((account) => account.id)),
      listAssignedDisputersByManager(supabase, managerIds)
    ]);
  const headerTitle = selectedView === 'overview' ? 'Account workflow.' : `${viewTitle(selectedView)}.`;
  const headerDescription = viewDescription(selectedView);
  const email = profile?.email || user.email || 'Master account';
  const bossOptions = bossOptionsFromManagers(managerDirectory.accounts);

  return <ConsoleShell
    role="master"
    mode="operations"
    email={email}
    accountLabel="Master account"
    brandSubtitle="Accounts"
    sidebarSectionTitle="Operations"
    navItems={masterAccountNavItems}
    switchTarget="/admin"
    switchTargetLabel="Manager console"
    navAriaLabel="Master navigation"
    activeNavUsesConsoleLink
    header={{ eyebrow: 'Master account directory', title: headerTitle, description: headerDescription }}
  >
    {selectedView !== 'overview' && <div className="single-header-dataset-action"><ConsoleNavLink className="directory-header-action" href="/master/accounts">Account directory</ConsoleNavLink></div>}
    {controlStatus && <section className={`admin-monitor-card admin-feedback-card ${controlStatus === 'ok' ? 'success' : 'error'}`}><strong>{controlStatus === 'ok' ? 'Limit saved' : 'Limit save failed'}</strong><span>{controlMessage || (controlStatus === 'ok' ? 'Master-set limits were saved and synced.' : 'The limit update did not complete.')}</span></section>}
    {(summaryError || directory.errorMessage || managerDirectory.errorMessage || entitlementResult.errorMessage) && <section className="admin-monitor-card"><div className="admin-monitor-empty">{summaryError || directory.errorMessage || managerDirectory.errorMessage || entitlementResult.errorMessage}</div></section>}
    {selectedView === 'overview' ? <section className="progressive-dataset-grid access-workflow-grid"><ConsoleNavLink className="progressive-dataset-card access-workflow-card" href="/master/accounts?view=managers"><p>Manager limits</p><h2>Managers</h2><span>{summary.managers} manager(s)</span><strong>Set Disputer-seat limits and inspect assigned Disputers.</strong></ConsoleNavLink><ConsoleNavLink className="progressive-dataset-card access-workflow-card" href="/master/accounts?view=clients"><p>Disputer limits</p><h2>Disputers</h2><span>{summary.clients} disputer(s)</span><strong>Assign boss managers and set output caps.</strong></ConsoleNavLink><ConsoleNavLink className="progressive-dataset-card access-workflow-card" href="/master/accounts?view=pending"><p>Pending</p><h2>Pending / unassigned</h2><span>{summary.pending} pending</span><strong>Find Disputers who need manager assignment or approval.</strong></ConsoleNavLink><ConsoleNavLink className="progressive-dataset-card access-workflow-card" href="/master/accounts?view=blocked"><p>Blocked</p><h2>Disabled / suspended</h2><span>{summary.blocked} blocked</span><strong>Review accounts that cannot use the platform.</strong></ConsoleNavLink></section> : <section className="master-access-stack single-header-dataset master-directory-compact-shell"><article className="admin-monitor-card native-operation-card master-directory-card-compact" data-layout-contract="dataset-card"><DirectoryFilter view={selectedView} query={directoryParams.query} /><MasterAccountTable accounts={directory.accounts} currentUserId={user.id} emptyText="No accounts match this account dataset." entitlements={entitlementResult.entitlements} bossOptions={bossOptions} assignedDisputersByManager={assignedDisputersByManager} /><Pager view={selectedView} query={directoryParams.query} page={directory.page} pageSize={directory.pageSize} total={directory.total} /></article></section>}
  </ConsoleShell>;
}
