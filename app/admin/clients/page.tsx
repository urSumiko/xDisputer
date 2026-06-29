import ConsoleShell from '../../../components/console/ConsoleShell';
import { listManagedAccounts, type ManagedAccount } from '../../../lib/saas/account-management';
import { requireRole } from '../../../lib/saas/session';

type PageProps = {
  searchParams?: Promise<{
    filter?: string | string[];
    page?: string | string[];
  }>;
};

const managerClientNavItems = [
  { href: '/admin', label: 'Monitoring' },
  { href: '/admin/access', label: 'Access control' },
  { href: '/admin/clients', label: 'All clients', active: true },
  { href: '/admin?panel=intake', label: 'Client intake' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/audit', label: 'Audit log' },
  { href: '/manager-workspace', label: 'Switch mode', kind: 'workspace-switch' as const }
];

function stringParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function formatDate(value: string | null | undefined) { if (!value) return '—'; const date = new Date(value); if (Number.isNaN(date.getTime())) return '—'; return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date); }

function ControlForm({ profileId, intent, label }: { profileId: string; intent: string; label: string }) {
  return <form action="/api/control/profile" method="post"><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="intent" value={intent} /><button type="submit" className="admin-action-button">{label}</button></form>;
}

function applyFilter(clients: ManagedAccount[], filter: string | undefined) {
  if (filter === 'attention') return clients.filter((item) => item.account_status === 'disabled');
  if (filter === 'active') return clients.filter((item) => (item.account_status || 'active') === 'active');
  return clients;
}

export default async function ManagerClientsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const filter = stringParam(params.filter);
  const currentPage = Math.max(1, Number(stringParam(params.page) || '1') || 1);
  const pageSize = 20;
  const { user, profile, supabase } = await requireRole('manager');
  const { accounts: clients, errorMessage } = await listManagedAccounts(supabase, 'manager', user.id);
  const filtered = applyFilter(clients, filter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const basePath = `/admin/clients${filter ? `?filter=${filter}&` : '?'}`;

  return <ConsoleShell role="manager" mode="operations" email={profile?.email || user.email || 'Manager account'} accountLabel="Manager account" brandSubtitle="Manager clients" sidebarSectionTitle="Client table" navItems={managerClientNavItems} switchTarget="/manager-workspace" switchTargetLabel="Manager workspace" navAriaLabel="Manager client table navigation" activeNavUsesConsoleLink>
    <header className="admin-monitor-header native-command-hero manager-compact-hero"><div><p>Manager table</p><h1>Assigned clients.</h1><span>Full table view for large client sets, separated from dashboard snapshots.</span></div></header>
    <section className="admin-monitor-card native-operation-card">
      <div className="full-table-toolbar"><div><p className="eyebrow">Client records</p><h2>{filter === 'attention' ? 'Needs attention' : filter === 'active' ? 'Active clients' : 'All assigned clients'}</h2></div><a href="/admin?panel=monitoring">Back to monitoring</a></div>
      {errorMessage ? <div className="admin-monitor-empty">Could not load clients: {errorMessage}</div> : <div className="admin-monitor-table-wrap"><table className="admin-monitor-table"><thead><tr><th>Client</th><th>Status</th><th>Joined</th><th>Updated</th><th>Controls</th></tr></thead><tbody>{visible.length ? visible.map((item) => <tr key={item.id}><td><strong>{item.full_name || item.email || 'Unnamed client'}</strong><small>{item.email || 'Client account'}</small></td><td><span className={`admin-status-badge ${item.account_status || 'active'}`}>{item.account_status || 'active'}</span></td><td>{formatDate(item.created_at)}</td><td>{formatDate(item.updated_at)}</td><td><div className="admin-actions-row">{item.account_status === 'disabled' ? <ControlForm profileId={item.id} intent="activate" label="Activate" /> : <ControlForm profileId={item.id} intent="disable" label="Disable" />}</div></td></tr>) : <tr><td colSpan={5} className="admin-monitor-empty">No matching clients.</td></tr>}</tbody></table></div>}
      <div className="table-pagination"><a href={`${basePath}page=${Math.max(1, safePage - 1)}`}>Prev</a><span>Page {safePage} of {pageCount}</span><span>Showing {filtered.length ? start + 1 : 0}-{Math.min(start + pageSize, filtered.length)} of {filtered.length}</span><a href={`${basePath}page=${Math.min(pageCount, safePage + 1)}`}>Next</a></div>
    </section>
  </ConsoleShell>;
}
