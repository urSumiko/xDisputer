import ConsoleNavLink from '../../../components/ConsoleNavLink';
import ConsoleShell from '../../../components/console/ConsoleShell';
import type { ConsoleNavItem } from '../../../components/console/ConsoleShell';
import { listMasterAccountDirectory, type AccountDirectoryRow } from '../../../lib/saas/account-directory';
import { listEntitlementLimits, type EntitlementLimitMap } from '../../../lib/saas/entitlement-limits';
import { requireRole } from '../../../lib/saas/session';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ManagerReportRow = AccountDirectoryRow & {
  assignedCount: number;
  seatLimit: number | null;
  defaultOutputLimit: number | null;
};

type DisputerReportRow = AccountDirectoryRow & {
  managerName: string;
  outputLimit: number | null;
  outputUsedToday: number;
  outputRemainingToday: number | null;
};

const REPORT_PAGE_SIZE = 25;

const masterReportNavItems: ConsoleNavItem[] = [
  { href: '/master', label: 'Monitoring' },
  { href: '/master/accounts', label: 'Accounts' },
  { href: '/master/reports', label: 'Reports', active: true },
  { href: '/master/audit', label: 'Audit log' },
  { href: '/master/system', label: 'System health' },
  { href: '/master/recovery', label: 'Recovery ledger' }
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanQuery(params: Record<string, string | string[] | undefined>) {
  return (firstParam(params.q) || '').trim().slice(0, 120);
}

function dateText(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function statusText(value?: string | null) {
  if (value === 'pending_manager_assignment') return 'Waiting';
  if (value === 'pending_manager_approval') return 'Pending';
  if (value === 'active') return 'Active';
  if (value === 'suspended') return 'Suspended';
  if (value === 'disabled') return 'Disabled';
  return value || 'Pending';
}

function nameOf(account: AccountDirectoryRow | undefined, fallback: string) {
  return account?.full_name || account?.email || fallback;
}

function managerMap(managers: AccountDirectoryRow[]) {
  return new Map(managers.map((manager) => [manager.id, manager]));
}

function searchableValues(account: AccountDirectoryRow, manager?: AccountDirectoryRow) {
  return [account.full_name, account.email, account.role, account.account_status, account.manager_invite_code, manager?.full_name, manager?.email]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

function filterByQuery<T extends AccountDirectoryRow>(rows: T[], query: string, managersById?: Map<string, AccountDirectoryRow>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => searchableValues(row, managersById?.get(row.manager_id || '')).some((value) => value.includes(needle)));
}

function sortByUpdated<T extends AccountDirectoryRow>(rows: T[]) {
  return [...rows].sort((left, right) => Date.parse(right.updated_at || '') - Date.parse(left.updated_at || ''));
}

function managerRows(managers: AccountDirectoryRow[], entitlements: EntitlementLimitMap): ManagerReportRow[] {
  return managers.map((manager) => ({
    ...manager,
    assignedCount: entitlements[manager.id]?.current_clients || 0,
    seatLimit: entitlements[manager.id]?.max_clients ?? null,
    defaultOutputLimit: entitlements[manager.id]?.default_client_output_limit ?? null
  })).sort((left, right) => right.assignedCount - left.assignedCount || nameOf(left, 'Manager').localeCompare(nameOf(right, 'Manager')));
}

function disputerRows(disputers: AccountDirectoryRow[], managersById: Map<string, AccountDirectoryRow>, entitlements: EntitlementLimitMap): DisputerReportRow[] {
  return sortByUpdated(disputers).map((disputer) => {
    const entitlement = entitlements[disputer.id];
    return {
      ...disputer,
      managerName: disputer.manager_id ? nameOf(managersById.get(disputer.manager_id), 'Assigned manager') : 'Unassigned',
      outputLimit: entitlement?.effective_output_limit ?? null,
      outputUsedToday: entitlement?.output_used_today || 0,
      outputRemainingToday: entitlement?.output_remaining_today ?? null
    };
  });
}

function summaryValue(label: string, value: string | number, helper: string) {
  return <article><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>;
}

function SearchBar({ query }: { query: string }) {
  return <form action="/master/reports" method="get" className="master-people-report-search"><label><span>Search reports</span><input name="q" type="search" placeholder="Manager, Disputer, email, status, or invite code" defaultValue={query} /></label><button type="submit" className="admin-action-button primary">Search</button><ConsoleNavLink href="/master/reports" className="admin-action-button">Reset</ConsoleNavLink></form>;
}

function ManagerTable({ rows }: { rows: ManagerReportRow[] }) {
  return <section className="master-people-report-panel"><header><div><p>Manager report</p><h2>Manager capacity and assignments</h2></div><ConsoleNavLink href="/master/accounts?view=managers" className="admin-action-button">Open managers</ConsoleNavLink></header><div className="master-people-report-table-scroll"><table className="manager-report-table master-people-report-table"><thead><tr><th>Manager</th><th>Assigned Disputers</th><th>Default outputs/day</th><th>Status</th><th>Invite</th><th>Updated</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td><strong>{nameOf(row, 'Manager')}</strong><small>{row.email || 'No email'}</small></td><td>{row.assignedCount}/{row.seatLimit ?? 'No cap'}</td><td>{row.defaultOutputLimit ?? 'Needs Master limit'}</td><td>{statusText(row.account_status)}</td><td>{row.manager_invite_code || 'Not created'}</td><td>{dateText(row.updated_at)}</td></tr>) : <tr><td colSpan={6}>No manager records match this report.</td></tr>}</tbody></table></div></section>;
}

function DisputerTable({ rows }: { rows: DisputerReportRow[] }) {
  return <section className="master-people-report-panel"><header><div><p>Disputer report</p><h2>Disputer assignment and output limits</h2></div><ConsoleNavLink href="/master/accounts?view=clients" className="admin-action-button">Open Disputers</ConsoleNavLink></header><div className="master-people-report-table-scroll"><table className="manager-report-table master-people-report-table"><thead><tr><th>Disputer</th><th>Boss / Manager</th><th>Status</th><th>Output limit</th><th>Used today</th><th>Remaining</th><th>Updated</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td><strong>{nameOf(row, 'Disputer')}</strong><small>{row.email || 'No email'}</small></td><td>{row.managerName}</td><td>{statusText(row.account_status)}</td><td>{row.outputLimit ?? 'Default / unset'}</td><td>{row.outputUsedToday}</td><td>{row.outputRemainingToday ?? '—'}</td><td>{dateText(row.updated_at)}</td></tr>) : <tr><td colSpan={7}>No Disputer records match this report.</td></tr>}</tbody></table></div></section>;
}

function ReportSummary({ managers, disputers }: { managers: ManagerReportRow[]; disputers: DisputerReportRow[] }) {
  const activeManagers = managers.filter((row) => row.account_status === 'active').length;
  const activeDisputers = disputers.filter((row) => row.account_status === 'active').length;
  const unassigned = disputers.filter((row) => !row.manager_id).length;
  const blocked = disputers.filter((row) => row.account_status === 'disabled' || row.account_status === 'suspended').length;
  const outputsToday = disputers.reduce((sum, row) => sum + row.outputUsedToday, 0);
  return <section className="master-people-report-summary" aria-label="Manager and Disputer report summary">
    {summaryValue('Managers', managers.length, `${activeManagers} active`)}
    {summaryValue('Disputers', disputers.length, `${activeDisputers} active`)}
    {summaryValue('Unassigned', unassigned, 'Need boss assignment')}
    {summaryValue('Blocked', blocked, 'Disabled or suspended')}
    {summaryValue('Outputs today', outputsToday, 'Tracked from usage rows')}
  </section>;
}

export default async function MasterReportsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const query = cleanQuery(params);
  const { user, profile, supabase } = await requireRole('master');
  const [managerDirectory, disputerDirectory] = await Promise.all([
    listMasterAccountDirectory(supabase, { view: 'managers', page: 1, pageSize: REPORT_PAGE_SIZE }),
    listMasterAccountDirectory(supabase, { view: 'clients', page: 1, pageSize: REPORT_PAGE_SIZE })
  ]);
  const managersById = managerMap(managerDirectory.accounts);
  const filteredManagers = filterByQuery(managerDirectory.accounts, query);
  const filteredDisputers = filterByQuery(disputerDirectory.accounts, query, managersById);
  const entitlementIds = Array.from(new Set([...filteredManagers, ...filteredDisputers].map((row) => row.id).filter(Boolean)));
  const entitlementResult = await listEntitlementLimits(supabase, entitlementIds);
  const managers = managerRows(filteredManagers, entitlementResult.entitlements);
  const disputers = disputerRows(filteredDisputers, managersById, entitlementResult.entitlements);
  const errorMessage = managerDirectory.errorMessage || disputerDirectory.errorMessage || entitlementResult.errorMessage;

  return <ConsoleShell role="master" mode="operations" email={profile?.email || user.email || 'Master account'} accountName={profile?.full_name || user.user_metadata?.full_name as string | null | undefined} accountLabel="Master account" brandSubtitle="Master reports" sidebarSectionTitle="Operations" navItems={masterReportNavItems} navAriaLabel="Master reports navigation" activeNavUsesConsoleLink header={{ eyebrow: 'Master report', title: 'Manager and Disputer reports.', description: 'Capacity, boss assignment, output limits, and access status for manager and Disputer accounts.' }}>
    {errorMessage ? <section className="admin-monitor-card"><div className="admin-monitor-empty">Could not load one report dataset: {errorMessage}</div></section> : null}
    <section className="admin-monitor-card native-operation-card master-people-report-workbench" data-master-people-report="manager-disputer">
      <SearchBar query={query} />
      <ReportSummary managers={managers} disputers={disputers} />
      <div className="master-people-report-grid">
        <ManagerTable rows={managers} />
        <DisputerTable rows={disputers} />
      </div>
    </section>
  </ConsoleShell>;
}
