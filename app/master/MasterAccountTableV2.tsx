import TableFlyout from '../../components/TableFlyout';
import type { ManagedAccount } from '../../lib/saas/account-management';
import type { EntitlementLimitMap, EntitlementLimitRow } from '../../lib/saas/entitlement-limits';
import { displayAccountRole, displayAccountRoleLower } from '../../lib/saas/display-terminology';

export type BossOption = { id: string; label: string; email: string | null };
export type AssignedDisputerPreview = { id: string; email: string | null; full_name: string | null; account_status: string | null; updated_at: string | null };

type AssignedDisputersByManager = Record<string, AssignedDisputerPreview[]>;

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
function activeAssignedCount(account: ManagedAccount, limit: EntitlementLimitRow | undefined, assigned: AssignedDisputerPreview[]) { return isManager(account) ? Math.max(assigned.length, savedManagerLimits(limit).active) : 0; }

function agreementSummary(account: ManagedAccount, limit?: EntitlementLimitRow, assigned: AssignedDisputerPreview[] = []) {
  if (isManager(account)) {
    const saved = savedManagerLimits(limit);
    const live = Math.max(assigned.length, saved.active);
    return saved.maxClients === null || saved.defaultOutput === null ? `${live} live active · Needs Master limit` : `${live}/${saved.maxClients} live · ${saved.defaultOutput} outputs/day`;
  }
  if (account.role === 'client') return account.manager_id ? 'Boss assigned' : 'Needs boss assignment';
  return 'Protected';
}

function roleLabel(account: ManagedAccount) { return displayAccountRoleLower(account.role); }
function clientSearchHref(account: AssignedDisputerPreview) { return `/master/accounts?view=clients&q=${encodeURIComponent(account.email || account.full_name || account.id)}`; }

function ControlForm({ profileId, intent, label, primary = false, compact = false }: { profileId: string; intent: string; label: string; primary?: boolean; compact?: boolean }) {
  return <form action="/api/control/profile" method="post"><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="intent" value={intent} /><button type="submit" className={`admin-action-button ${primary ? 'primary' : ''} ${compact ? 'compact-action' : ''}`}>{label}</button></form>;
}

function RotateInvite({ managerId }: { managerId: string }) {
  return <form action="/api/master/rotate-invite" method="post"><input type="hidden" name="managerId" value={managerId} /><button type="submit" className="admin-action-button compact-action">Rotate invite</button></form>;
}

function LinkBadge({ account }: { account: ManagedAccount }) {
  if (isManager(account)) return <span className="admin-relation-badge ready">Manager</span>;
  if (account.role === 'client' && account.manager_id) return <span className="admin-relation-badge linked">Linked</span>;
  if (account.role === 'client') return <span className="admin-relation-badge open">Unassigned</span>;
  return <span className="admin-relation-badge owner">Owner</span>;
}

function ManagerLimitSnapshot({ limit, assigned }: { limit?: EntitlementLimitRow; assigned: AssignedDisputerPreview[] }) {
  const saved = savedManagerLimits(limit);
  const live = Math.max(assigned.length, saved.active);
  if (saved.maxClients === null || saved.defaultOutput === null) return <div className="limit-editor-help compact-limit-note">No saved manager limits yet. Enter both numbers and save once. Live assigned Disputers: {live}.</div>;
  return <div className="limit-editor-help compact-limit-note"><strong>Saved:</strong> {saved.maxClients} seats · {saved.defaultOutput} outputs/Disputer/day · {live} live assigned.</div>;
}

function LimitForm({ account, limit, formId, assigned }: { account: ManagedAccount; limit?: EntitlementLimitRow; formId: string; assigned: AssignedDisputerPreview[] }) {
  if (!isManager(account)) return null;
  const saved = savedManagerLimits(limit);
  return <form id={formId} action="/api/master/entitlements" method="post" className="limit-editor-form flyout-form compact-limit-form"><input type="hidden" name="mode" value="manager" /><input type="hidden" name="profileId" value={account.id} /><ManagerLimitSnapshot limit={limit} assigned={assigned} /><div className="compact-limit-grid"><label><span>Disputer seats</span><input name="maxClients" type="number" min="1" required defaultValue={saved.maxClients ?? ''} placeholder="Required" /></label><label><span>Outputs/day</span><input name="defaultClientOutputLimit" type="number" min="1" required defaultValue={saved.defaultOutput ?? ''} placeholder="Required" /></label></div></form>;
}

function BossAssignmentForm({ account, bossOptions }: { account: ManagedAccount; bossOptions: BossOption[] }) {
  if (account.role !== 'client') return null;
  return <form action="/api/master/assign-manager" method="post" className="boss-assignment-form flyout-form compact-boss-form"><input type="hidden" name="clientId" value={account.id} /><label><span>Boss / Manager</span><select name="managerId" defaultValue={account.manager_id || ''}><option value="" disabled>Choose manager boss</option>{bossOptions.map((boss) => <option key={boss.id} value={boss.id}>{boss.label}{boss.email ? ` · ${boss.email}` : ''}</option>)}</select></label><button type="submit" className="admin-action-button primary compact-action">Save boss</button></form>;
}

function AssignedDisputersPanel({ assigned }: { assigned: AssignedDisputerPreview[] }) {
  return <section className="table-flyout-section manager-assigned-disputers-panel"><header><div><strong>Manager’s assigned Disputers</strong><span>{assigned.length} live assignment{assigned.length === 1 ? '' : 's'}</span></div></header>{assigned.length ? <div className="manager-assigned-disputer-list">{assigned.map((disputer) => <article key={disputer.id} className="manager-assigned-disputer-row"><div><strong>{disputer.full_name || disputer.email || 'Unnamed Disputer'}</strong><span>{disputer.email || 'No email'} · {statusText(disputer.account_status)} · Updated {dateText(disputer.updated_at)}</span></div><div className="manager-assigned-disputer-actions"><a className="admin-action-button compact-action" href={clientSearchHref(disputer)}>Open</a><ControlForm profileId={disputer.id} intent="clear_manager" label="Unlink" compact /></div></article>)}</div> : <p className="flyout-muted">No live assigned Disputers were found for this manager.</p>}</section>;
}

function ManagerDemotionAction({ account, limit, assigned }: { account: ManagedAccount; limit?: EntitlementLimitRow; assigned: AssignedDisputerPreview[] }) {
  const active = activeAssignedCount(account, limit, assigned);
  if (active > 0) return <span className="flyout-action-group compact-action-group"><button type="button" className="admin-action-button compact-action" disabled>Demote locked</button><span className="flyout-muted">{active} active assigned Disputer{active === 1 ? '' : 's'}. Unlink or reassign first.</span></span>;
  return <ControlForm profileId={account.id} intent="demote_client" label="Demote" compact />;
}

function ActionForms({ account, currentUserId, limit, assigned }: { account: ManagedAccount; currentUserId: string; limit?: EntitlementLimitRow; assigned: AssignedDisputerPreview[] }) {
  if (account.role === 'master') return <p className="flyout-muted">Master account is protected.</p>;
  if (account.id === currentUserId) return <p className="flyout-muted">Current signed-in account.</p>;
  const blocked = account.account_status === 'disabled' || account.account_status === 'suspended';
  return <div className="admin-actions-row flyout-actions compact-flyout-actions">{account.role === 'client' && <ControlForm key="promote" profileId={account.id} intent="make_manager" label="Promote" primary compact />}{isManager(account) && <span key="manager-actions" className="flyout-action-group compact-action-group"><ManagerDemotionAction account={account} limit={limit} assigned={assigned} /><RotateInvite managerId={account.id} /></span>}{blocked ? <ControlForm key="reactivate" profileId={account.id} intent="reactivate" label="Reactivate" primary compact /> : <span key="block-actions" className="flyout-action-group compact-action-group"><ControlForm profileId={account.id} intent="suspend" label="Suspend" compact /><ControlForm profileId={account.id} intent="disable" label="Disable" compact /></span>}{account.role === 'client' && account.manager_id && <ControlForm key="unlink" profileId={account.id} intent="clear_manager" label="Unlink" compact />}</div>;
}

function AccountTrigger({ account, limit, assigned }: { account: ManagedAccount; limit?: EntitlementLimitRow; assigned: AssignedDisputerPreview[] }) {
  const saved = savedManagerLimits(limit);
  const live = activeAssignedCount(account, limit, assigned);
  return <span className="account-control-trigger-grid master-account-trigger-v3 compact-master-account-trigger"><span className="account-control-identity master-account-identity"><strong>{account.full_name || account.email || `Unnamed ${displayAccountRoleLower(account.role)}`}</strong><small>{account.email || `${displayAccountRole(account.role)} account`}</small></span><span className="master-account-status-cluster compact-status-cluster"><span className={`admin-role-badge ${account.role}`}>{roleLabel(account)}</span><span className={`admin-status-badge ${account.account_status || 'pending'}`}>{statusText(account.account_status)}</span><LinkBadge account={account} /></span><span className="account-control-agreement master-account-limit compact-master-limit"><strong>{agreementSummary(account, limit, assigned)}</strong><small>{isManager(account) ? `${live} assigned · ${saved.maxClients ?? 'no'} seat cap` : account.role === 'client' ? 'boss assignment' : 'protected'}</small></span><span className="account-control-meta compact-meta"><small>Invite</small><strong>{isManager(account) ? account.manager_invite_code || 'Not created' : '—'}</strong></span><span className="account-control-meta compact-meta"><small>Updated</small><strong>{dateText(account.updated_at)}</strong></span><span className="master-account-open compact-open-button">Open</span></span>;
}

function AccountControlCard({ account, currentUserId, limit, bossOptions, assigned }: { account: ManagedAccount; currentUserId: string; limit?: EntitlementLimitRow; bossOptions: BossOption[]; assigned: AssignedDisputerPreview[] }) {
  const formId = `limit-form-${account.id}`;
  const managerAccount = isManager(account);
  const saveAction = canEditLimits(account) ? <button key={`save-limits-${account.id}`} type="submit" form={formId} className="admin-action-button primary flyout-save-button compact-action">Save limits</button> : null;

  return <TableFlyout eyebrow="Account controls" title={account.full_name || account.email || 'Account'} summary={agreementSummary(account, limit, assigned)} actionLabel="Open" triggerClassName="account-control-row-trigger master-account-row-v3 compact-master-account-row" trigger={<AccountTrigger account={account} limit={limit} assigned={assigned} />} headerAction={saveAction}>
    <div className="account-control-flyout-content compact-account-flyout" data-account-control-flyout-content="key-safe-wrapper">
      {managerAccount && <section className="table-flyout-section compact-limit-section"><LimitForm account={account} limit={limit} formId={formId} assigned={assigned} /></section>}
      {managerAccount && <AssignedDisputersPanel assigned={assigned} />}
      {account.role === 'client' && <section className="table-flyout-section"><strong>Boss assignment</strong><BossAssignmentForm account={account} bossOptions={bossOptions} /></section>}
      <section className="table-flyout-section compact-actions-section"><strong>Actions</strong><ActionForms account={account} currentUserId={currentUserId} limit={limit} assigned={assigned} /></section>
    </div>
  </TableFlyout>;
}

export default function MasterAccountTableV2({ accounts, currentUserId, emptyText, entitlements = {}, bossOptions = [], assignedDisputersByManager = {} }: { accounts: ManagedAccount[]; currentUserId: string; emptyText: string; entitlements?: EntitlementLimitMap; bossOptions?: BossOption[]; assignedDisputersByManager?: AssignedDisputersByManager }) {
  if (!accounts.length) return <div className="admin-monitor-empty">{emptyText}</div>;
  return <div className="account-control-list master-account-list-v3 compact-master-account-list">{accounts.map((item) => <AccountControlCard key={item.id} account={item} currentUserId={currentUserId} limit={entitlements[item.id]} bossOptions={bossOptions} assigned={assignedDisputersByManager[item.id] || []} />)}</div>;
}
