import TableFlyout from '../../components/TableFlyout';
import type { ManagedAccount } from '../../lib/saas/account-management';
import type { EntitlementLimitMap, EntitlementLimitRow } from '../../lib/saas/entitlement-limits';
import { displayAccountRole, displayAccountRoleLower } from '../../lib/saas/display-terminology';

export type BossOption = { id: string; label: string; email: string | null };

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

function isManager(account: ManagedAccount) { return account.role === 'manager' || account.role === 'admin'; }
function canEditLimits(account: ManagedAccount) { return isManager(account); }
function positiveValue(value?: number | string | null) { const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN; return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }
function savedManagerLimits(limit?: EntitlementLimitRow) { return { maxClients: positiveValue(limit?.max_clients), defaultOutput: positiveValue(limit?.default_client_output_limit), active: limit?.current_clients || 0 }; }

function agreementSummary(account: ManagedAccount, limit?: EntitlementLimitRow) {
  if (isManager(account)) {
    const saved = savedManagerLimits(limit);
    return saved.maxClients === null || saved.defaultOutput === null ? `${saved.active} active · Needs Master limit` : `${saved.active}/${saved.maxClients} disputers · ${saved.defaultOutput} outputs/day`;
  }
  if (account.role === 'client') return account.manager_id ? 'Boss assigned' : 'Needs boss assignment';
  return 'Protected';
}

function roleLabel(account: ManagedAccount) {
  return displayAccountRoleLower(account.role);
}

function ControlForm({ profileId, intent, label, primary = false }: { profileId: string; intent: string; label: string; primary?: boolean }) {
  return <form action="/api/control/profile" method="post"><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="intent" value={intent} /><button type="submit" className={`admin-action-button ${primary ? 'primary' : ''}`}>{label}</button></form>;
}

function RotateInvite({ managerId }: { managerId: string }) {
  return <form action="/api/master/rotate-invite" method="post"><input type="hidden" name="managerId" value={managerId} /><button type="submit" className="admin-action-button">Rotate invite</button></form>;
}

function LinkBadge({ account }: { account: ManagedAccount }) {
  if (isManager(account)) return <span className="admin-relation-badge ready">Manager</span>;
  if (account.role === 'client' && account.manager_id) return <span className="admin-relation-badge linked">Linked</span>;
  if (account.role === 'client') return <span className="admin-relation-badge open">Unassigned</span>;
  return <span className="admin-relation-badge owner">Owner</span>;
}

function ManagerLimitSnapshot({ limit }: { limit?: EntitlementLimitRow }) {
  const saved = savedManagerLimits(limit);
  if (saved.maxClients === null || saved.defaultOutput === null) return <div className="limit-editor-help">No saved manager limits found yet. Enter both numbers and save once.</div>;
  return <div className="limit-editor-help"><strong>Saved limits:</strong> {saved.maxClients} Disputer seats · {saved.defaultOutput} default outputs per Disputer/day · {saved.active} active now.</div>;
}

function LimitForm({ account, limit, formId }: { account: ManagedAccount; limit?: EntitlementLimitRow; formId: string }) {
  if (!isManager(account)) return null;
  const saved = savedManagerLimits(limit);
  return <form id={formId} action="/api/master/entitlements" method="post" className="limit-editor-form flyout-form"><input type="hidden" name="mode" value="manager" /><input type="hidden" name="profileId" value={account.id} /><ManagerLimitSnapshot limit={limit} /><label><span>Disputer limit</span><input name="maxClients" type="number" min="1" required defaultValue={saved.maxClients ?? ''} placeholder="Required number" /></label><label><span>Default outputs per disputer/day</span><input name="defaultClientOutputLimit" type="number" min="1" required defaultValue={saved.defaultOutput ?? ''} placeholder="Required number" /></label><p className="limit-editor-help">Master sets this manager's total Disputer seats and the default daily output cap for every Disputer under this manager.</p></form>;
}

function BossAssignmentForm({ account, bossOptions }: { account: ManagedAccount; bossOptions: BossOption[] }) {
  if (account.role !== 'client') return null;
  return <form action="/api/master/assign-manager" method="post" className="boss-assignment-form flyout-form"><input type="hidden" name="clientId" value={account.id} /><label><span>Boss / manager</span><select name="managerId" defaultValue={account.manager_id || ''}><option value="" disabled>Choose manager boss</option>{bossOptions.map((boss) => <option key={boss.id} value={boss.id}>{boss.label}{boss.email ? ` · ${boss.email}` : ''}</option>)}</select></label><button type="submit" className="admin-action-button primary">Save boss</button></form>;
}

function ActionForms({ account, currentUserId }: { account: ManagedAccount; currentUserId: string }) {
  if (account.role === 'master') return <p className="flyout-muted">Master account is protected.</p>;
  if (account.id === currentUserId) return <p className="flyout-muted">Current signed-in account.</p>;
  const blocked = account.account_status === 'disabled' || account.account_status === 'suspended';
  return <div className="admin-actions-row flyout-actions">{account.role === 'client' && <ControlForm key="promote" profileId={account.id} intent="make_manager" label="Promote" primary />}{isManager(account) && <span key="manager-actions" className="flyout-action-group"><ControlForm profileId={account.id} intent="demote_client" label="Demote" /><RotateInvite managerId={account.id} /></span>}{blocked ? <ControlForm key="reactivate" profileId={account.id} intent="reactivate" label="Reactivate" primary /> : <span key="block-actions" className="flyout-action-group"><ControlForm profileId={account.id} intent="suspend" label="Suspend" /><ControlForm profileId={account.id} intent="disable" label="Disable" /></span>}{account.role === 'client' && account.manager_id && <ControlForm key="unlink" profileId={account.id} intent="clear_manager" label="Unlink" />}</div>;
}

function AccountTrigger({ account, limit }: { account: ManagedAccount; limit?: EntitlementLimitRow }) {
  return <span className="account-control-trigger-grid master-account-trigger-v3"><span className="account-control-identity master-account-identity"><strong>{account.full_name || account.email || `Unnamed ${displayAccountRoleLower(account.role)}`}</strong><small>{account.email || `${displayAccountRole(account.role)} account`}</small></span><span className="master-account-status-cluster"><span className={`admin-role-badge ${account.role}`}>{roleLabel(account)}</span><span className={`admin-status-badge ${account.account_status || 'pending'}`}>{statusText(account.account_status)}</span><LinkBadge account={account} /></span><span className="account-control-agreement master-account-limit"><strong>{agreementSummary(account, limit)}</strong><small>{isManager(account) ? 'master control' : account.role === 'client' ? 'boss assignment' : 'protected'}</small></span><span className="master-account-open">Open controls</span><span className="account-control-meta"><small>Invite</small><strong>{isManager(account) ? account.manager_invite_code || 'Not created' : '—'}</strong></span><span className="account-control-meta"><small>Updated</small><strong>{dateText(account.updated_at)}</strong></span></span>;
}

function AccountControlCard({ account, currentUserId, limit, bossOptions }: { account: ManagedAccount; currentUserId: string; limit?: EntitlementLimitRow; bossOptions: BossOption[] }) {
  const formId = `limit-form-${account.id}`;
  const managerAccount = isManager(account);
  const saveAction = canEditLimits(account) ? <button key={`save-limits-${account.id}`} type="submit" form={formId} className="admin-action-button primary flyout-save-button">Save limits</button> : null;

  return <TableFlyout eyebrow="Account controls" title={account.full_name || account.email || 'Account'} summary={agreementSummary(account, limit)} actionLabel="Open" triggerClassName="account-control-row-trigger master-account-row-v3" trigger={<AccountTrigger account={account} limit={limit} />} headerAction={saveAction}>
    <div className="account-control-flyout-content" data-account-control-flyout-content="key-safe-wrapper">
      {managerAccount && <section className="table-flyout-section"><LimitForm account={account} limit={limit} formId={formId} /></section>}
      {account.role === 'client' && <section className="table-flyout-section"><strong>Boss assignment</strong><BossAssignmentForm account={account} bossOptions={bossOptions} /></section>}
      <section className="table-flyout-section"><strong>Actions</strong><ActionForms account={account} currentUserId={currentUserId} /></section>
    </div>
  </TableFlyout>;
}

export default function MasterAccountTableV2({ accounts, currentUserId, emptyText, entitlements = {}, bossOptions = [] }: { accounts: ManagedAccount[]; currentUserId: string; emptyText: string; entitlements?: EntitlementLimitMap; bossOptions?: BossOption[] }) {
  if (!accounts.length) return <div className="admin-monitor-empty">{emptyText}</div>;
  return <div className="account-control-list master-account-list-v3">{accounts.map((item) => <AccountControlCard key={item.id} account={item} currentUserId={currentUserId} limit={entitlements[item.id]} bossOptions={bossOptions} />)}</div>;
}
