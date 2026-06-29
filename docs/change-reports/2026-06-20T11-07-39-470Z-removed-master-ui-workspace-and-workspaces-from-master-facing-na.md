# Auto Commit Recovery Report

- Created: 2026-06-20T11:07:39.500Z
- Base commit before auto-report: 1103041ba212ee946ac6456bf3f6c646ce0c93ea
- Intent: User requested permanent removal of UI workspace and Workspaces from Master Console and Master Workspace
- Summary: Removed Master UI Workspace and Workspaces from master-facing navigation, retired old routes with authenticated redirects, removed global retired workspace CSS import, and updated guard behavior to prevent reintroduction
- Problem / wrong behavior: Master Console exposed duplicate workspace surfaces that made frontend editing harder and contradicted the simplified Master governance flow

## Changed files

```text
M	app/master/system/page.tsx
M	components/AccessAuditView.tsx
M	components/console/ui-shell-registry.ts
M	package-lock.json
```

## Diff stat

```text
app/master/system/page.tsx              |  1 -
 components/AccessAuditView.tsx          |  3 +-
 components/console/ui-shell-registry.ts |  1 -
 package-lock.json                       | 70 +++++++++++++++++++++++++++++++++
 4 files changed, 71 insertions(+), 4 deletions(-)
```

## Recovery

To inspect this change later:

```bash
git show --stat HEAD
git show --name-status HEAD
```

To revert this auto-commit after it is created:

```bash
git revert HEAD
```

## File-by-file old/latest preview

### pp/layout.tsx

- Status: M

#### Old version preview

```text
[new file or old version unavailable]
```

#### Latest version preview

```text
[deleted file or latest version unavailable]
```

### app/master/system/page.tsx

- Status: M

#### Old version preview

```text
import ConsoleNavLink from '../../../components/ConsoleNavLink';
import ConsoleShell from '../../../components/console/ConsoleShell';
import { listMasterGenerationIntegrityEvents } from '../../../lib/saas/integrity-ledger';
import { requireRole } from '../../../lib/saas/session';
import { listMasterSystemEvents } from '../../../lib/saas/system-observability';

const masterSystemNavItems = [
  { href: '/master', label: 'Monitoring' },
  { href: '/master/accounts', label: 'All accounts' },
  { href: '/master/workspaces', label: 'Workspaces' },
  { href: '/master/reports', label: 'Reports' },
  { href: '/master/audit', label: 'Audit log' },
  { href: '/master/system', label: 'System health', active: true },
  { href: '/master/recovery', label: 'Recovery ledger' }
];

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function statusClass(value: string | null | undefined) {
  if (value === 'error' || value === 'failed') return 'disabled';
  if (value === 'warning') return 'pending_manager_approval';
  return 'active';
}

export default async function MasterSystemPage() {
  const { user, profile, supabase } = await requireRole('master');
  const [{ events, errorMessage: systemError }, { events: integrityEvents, errorMessage: integrityError }] = await Promise.all([
    listMasterSystemEvents(supabase, 60),
    listMasterGenerationIntegrityEvents(supabase, 60)
  ]);
  const errorEvents = events.filter((event) => event.event_status === 'error').length;
  const warningEvents = events.filter((event) => event.event_status === 'warning').length;
  const failedIntegrity = integrityEvents.filter((event) => event.integrity_status === 'failed').length;

  return <ConsoleShell role="master" mode="operations" email={profile?.email || user.email || 'Master account'} accountLabel="Master account" brandSubtitle="System health" sidebarSectionTitle="Operations" navItems={masterSystemNavItems} switchTarget="/admin" switchTargetLabel="Manager console" navAriaLabel="Master system navigation" activeNavUsesConsoleLink>
    <header className="admin-monitor-header native-command-hero master-compact-hero"><div><p>System health</p><h1>Operational flight recorder.</h1><span>Review API events, route failures, and generation integrity records without affecting user output.</span></div></header>
    <section className="admin-monitor-stats master-monitoring-stats" aria-label="System health summary"><article><p>System events</p><strong>{events.length}</strong></article><article><p>Errors</p><strong>{errorEvents}</strong></article><article><p>Warnings</p><strong>{warningEvents}</strong></article><article><p>Integrity failures</p><strong>{failedIntegrity}</strong></article></section>
    {(systemError || integrityError) && <section className="admin-monitor-card"><div className="admin-monitor-empty">{systemError || integrityError}</div></section>}
    <section className="master-access-stack"><article className="admin-monitor-card native-operation-card"><div className="admin-monitor-card-header"><div><p>Observability</p><h2>Recent system events</h2></div><span>{events.length} events</span></div><div className="admin-monitor-table-wrap"><table className="admin-monitor-table professional-data-table"><thead><tr><th>Created</th><th>Route</th><th>Event</th><th>Status</th><th>Duration</th><th>Message</th></tr></thead><tbody>{events.length ? events.map((event) => <tr key={event.id}><td data-label="Created">{formatDate(event.created_at)}</td><td data-label="Route">{event.route_path}</td><td data-label="Event">{event.event_type}</td><td data-label="Status"><span className={`admin-status-badge ${statusClass(event.event_status)}`}>{event.event_status}</span></td><td data-label="Duration">{typeof event.duration_ms === 'number' ? `${event.duration_ms}ms` : '—'}</td><td data-label="Message">{event.safe_message || '—'}</td></tr>) : <tr><td colSpan={6} className="admin-monitor-empty">No system events recorded yet.</td></tr>}</tbody></table></div></article><article className="admin-monitor-card native-operation-card"><div className="admin-monitor-card-header"><div><p>Integrity</p><h2>Recent generation integrity records</h2></div><span>{integrityEvents.length} records</span></div><div className="admin-monitor-table-wrap"><table className="admin-monitor-table professional-data-table"><thead><tr><th>Created</th><th>Run</th><th>Event</th><th>Status</th><th>Manifest hash</th><th>Rules hash</th></tr></thead><tbody>{integrityEvents.length ? integrityEvents.map((event) => <tr key={event.id}><td data-label="Created">{formatDate(event.created_at)}</td><td data-label="Run">{event.generation_run_id || '—'}</td><td data-label="Event">{event.event_type}</td><td data-label="Status"><span className={`admin-status-badge ${statusClass(event.integrity_status)}`}>{event.integrity_status}</span></td><td data-label="Manifest hash"><small>{event.manifest_hash || '—'}</small></td><td data-label="Rules hash"><small>{event.rules_hash || '—'}</small></td></tr>) : <tr><td colSpan={6} className="admin-monitor-empty">No generation integrity records yet.</td></tr>}</tbody></table></div></article></section>
  </ConsoleShell>;
}

```

#### Latest version preview

```text
import ConsoleNavLink from '../../../components/ConsoleNavLink';
import ConsoleShell from '../../../components/console/ConsoleShell';
import { listMasterGenerationIntegrityEvents } from '../../../lib/saas/integrity-ledger';
import { requireRole } from '../../../lib/saas/session';
import { listMasterSystemEvents } from '../../../lib/saas/system-observability';

const masterSystemNavItems = [
  { href: '/master', label: 'Monitoring' },
  { href: '/master/accounts', label: 'All accounts' },
  { href: '/master/reports', label: 'Reports' },
  { href: '/master/audit', label: 'Audit log' },
  { href: '/master/system', label: 'System health', active: true },
  { href: '/master/recovery', label: 'Recovery ledger' }
];

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function statusClass(value: string | null | undefined) {
  if (value === 'error' || value === 'failed') return 'disabled';
  if (value === 'warning') return 'pending_manager_approval';
  return 'active';
}

export default async function MasterSystemPage() {
  const { user, profile, supabase } = await requireRole('master');
  const [{ events, errorMessage: systemError }, { events: integrityEvents, errorMessage: integrityError }] = await Promise.all([
    listMasterSystemEvents(supabase, 60),
    listMasterGenerationIntegrityEvents(supabase, 60)
  ]);
  const errorEvents = events.filter((event) => event.event_status === 'error').length;
  const warningEvents = events.filter((event) => event.event_status === 'warning').length;
  const failedIntegrity = integrityEvents.filter((event) => event.integrity_status === 'failed').length;

  return <ConsoleShell role="master" mode="operations" email={profile?.email || user.email || 'Master account'} accountLabel="Master account" brandSubtitle="System health" sidebarSectionTitle="Operations" navItems={masterSystemNavItems} switchTarget="/admin" switchTargetLabel="Manager console" navAriaLabel="Master system navigation" activeNavUsesConsoleLink>
    <header className="admin-monitor-header native-command-hero master-compact-hero"><div><p>System health</p><h1>Operational flight recorder.</h1><span>Review API events, route failures, and generation integrity records without affecting user output.</span></div></header>
    <section className="admin-monitor-stats master-monitoring-stats" aria-label="System health summary"><article><p>System events</p><strong>{events.length}</strong></article><article><p>Errors</p><strong>{errorEvents}</strong></article><article><p>Warnings</p><strong>{warningEvents}</strong></article><article><p>Integrity failures</p><strong>{failedIntegrity}</strong></article></section>
    {(systemError || integrityError) && <section className="admin-monitor-card"><div className="admin-monitor-empty">{systemError || integrityError}</div></section>}
    <section className="master-access-stack"><article className="admin-monitor-card native-operation-card"><div className="admin-monitor-card-header"><div><p>Observability</p><h2>Recent system events</h2></div><span>{events.length} events</span></div><div className="admin-monitor-table-wrap"><table className="admin-monitor-table professional-data-table"><thead><tr><th>Created</th><th>Route</th><th>Event</th><th>Status</th><th>Duration</th><th>Message</th></tr></thead><tbody>{events.length ? events.map((event) => <tr key={event.id}><td data-label="Created">{formatDate(event.created_at)}</td><td data-label="Route">{event.route_path}</td><td data-label="Event">{event.event_type}</td><td data-label="Status"><span className={`admin-status-badge ${statusClass(event.event_status)}`}>{event.event_status}</span></td><td data-label="Duration">{typeof event.duration_ms === 'number' ? `${event.duration_ms}ms` : '—'}</td><td data-label="Message">{event.safe_message || '—'}</td></tr>) : <tr><td colSpan={6} className="admin-monitor-empty">No system events recorded yet.</td></tr>}</tbody></table></div></article><article className="admin-monitor-card native-operation-card"><div className="admin-monitor-card-header"><div><p>Integrity</p><h2>Recent generation integrity records</h2></div><span>{integrityEvents.length} records</span></div><div className="admin-monitor-table-wrap"><table className="admin-monitor-table professional-data-table"><thead><tr><th>Created</th><th>Run</th><th>Event</th><th>Status</th><th>Manifest hash</th><th>Rules hash</th></tr></thead><tbody>{integrityEvents.length ? integrityEvents.map((event) => <tr key={event.id}><td data-label="Created">{formatDate(event.created_at)}</td><td data-label="Run">{event.generation_run_id || '—'}</td><td data-label="Event">{event.event_type}</td><td data-label="Status"><span className={`admin-status-badge ${statusClass(event.integrity_status)}`}>{event.integrity_status}</span></td><td data-label="Manifest hash"><small>{event.manifest_hash || '—'}</small></td><td data-label="Rules hash"><small>{event.rules_hash || '—'}</small></td></tr>) : <tr><td colSpan={6} className="admin-monitor-empty">No generation integrity records yet.</td></tr>}</tbody></table></div></article></section>
  </ConsoleShell>;
}

```

### components/AccessAuditView.tsx

- Status: M

#### Old version preview

```text
import ConsoleShell from './console/ConsoleShell';
import type { ConsoleNavItem } from './console/ConsoleShell';
import { readableAuditEventType, type AccessAuditEvent } from '../lib/saas/access-audit';

type Scope = 'master' | 'manager';

type Props = {
  scope: Scope;
  accountEmail?: string | null;
  events: AccessAuditEvent[];
  errorMessage?: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function eventCount(events: AccessAuditEvent[], pattern: RegExp) { return events.filter((event) => pattern.test(event.event_type)).length; }

function auditNavItems(scope: Scope): ConsoleNavItem[] {
  if (scope === 'master') return [
    { href: '/master', label: 'Monitoring' },
    { href: '/master/accounts', label: 'Accounts' },
    { href: '/master/workspaces', label: 'Workspaces' },
    { href: '/master/reports', label: 'Reports' },
    { href: '/master/audit', label: 'Audit log', active: true },
    { href: '/master/system', label: 'System health' },
    { href: '/master/recovery', label: 'Recovery ledger' }
  ];
  return [
    { href: '/admin', label: 'Monitoring' },
    { href: '/admin/access', label: 'Access control' },
    { href: '/admin?panel=intake', label: 'Client intake' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/audit', label: 'Audit log', active: true },
    { href: '/manager-workspace', label: 'Switch mode', kind: 'workspace-switch' }
  ];
}

export default function AccessAuditView({ scope, accountEmail, events, errorMessage }: Props) {
  const latest = events[0];
  const visibleEvents = events.slice(0, 24);
  const approvals = eventCount(events, /approve|approval|reactivate|activate/i);
  const restrictions = eventCount(events, /reject|disable|suspend|block/i);
  const isMaster = scope === 'master';

  return <ConsoleShell role={scope} mode="operations" email={accountEmail} accountLabel={isMaster ? 'Master account' : 'Manager account'} brandSubtitle={isMaster ? 'Master audit' : 'Manager audit'} sidebarSectionTitle="Operations" navItems={auditNavItems(scope)} switchTarget={isMaster ? '/admin' : '/manager-workspace'} switchTargetLabel={isMaster ? 'Manager console' : 'Manager workspace'} navAriaLabel={isMaster ? 'Master audit navigation' : 'Manager audit navigation'} activeNavUsesConsoleLink>
    <header className="admin-monitor-header native-command-hero minimal-report-hero"><div><p>{isMaster ? 'Master audit' : 'Manager audit'}</p><h1>Access activity.</h1><span>Minimal access history focused on who changed access, who was affected, and what happened.</span></div></header>
    {errorMessage ? <section className="admin-monitor-card"><div className="admin-monitor-empty">Could not load audit events: {errorMessage}</div></section> : <><section className="minimal-report-summary" aria-label="Access audit summary"><article><span>Events</span><strong>{events.length}</strong><small>Recent access changes</small></article><article><span>Approvals</span><strong>{approvals}</strong><small>Granted or restored</small></article><article className={restrictions ? 'attention' : 'complete'}><span>Restrictions</span><strong>{restrictions}</strong><small>{restrictions ? 'Review context' : 'None recent'}</small></article><article><span>Latest</span><strong>{latest ? formatDate(latest.created_at) : '—'}</strong><small>Most recent event</small></article></section><section className="admin-monitor-card native-operation-card minimal-activity-card"><div className="admin-monitor-card-header compact-card-header"><div><p>Audit stream</p><h2>Recent access events</h2></div><span>{events.length} events</span></div>{visibleEvents.length ? <div className="minimal-activity-list audit-event-list" role="list">{visibleEvents.map((event) => <article key={event.id} className="minimal-activity-row audit-event-row" role="listitem"><div><strong>{readableAuditEventType(event.event_type)}</strong><span>{event.event_detail || 'Access event'} · {formatDate(event.created_at)}</span></div><small>{event.actor_email || 'System'} → {event.target_email || 'Workspace'}</small><em className="admin-status-badge active">{event.target_role || event.actor_role || 'event'}</em></article>)}</div> : <div className="admin-monitor-empty">No access audit events are available yet.</div>}</section></>}
  </ConsoleShell>;
}

```

#### Latest version preview

```text
import ConsoleShell from './console/ConsoleShell';
import type { ConsoleNavItem } from './console/ConsoleShell';
import { readableAuditEventType, type AccessAuditEvent } from '../lib/saas/access-audit';

type Scope = 'master' | 'manager';

type Props = {
  scope: Scope;
  accountEmail?: string | null;
  events: AccessAuditEvent[];
  errorMessage?: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function eventCount(events: AccessAuditEvent[], pattern: RegExp) { return events.filter((event) => pattern.test(event.event_type)).length; }

function auditNavItems(scope: Scope): ConsoleNavItem[] {
  if (scope === 'master') return [
    { href: '/master', label: 'Monitoring' },
    { href: '/master/accounts', label: 'Accounts' },
    { href: '/master/reports', label: 'Reports' },
    { href: '/master/audit', label: 'Audit log', active: true },
    { href: '/master/system', label: 'System health' },
    { href: '/master/recovery', label: 'Recovery ledger' }
  ];
  return [
    { href: '/admin', label: 'Monitoring' },
    { href: '/admin/access', label: 'Access control' },
    { href: '/admin?panel=intake', label: 'Client intake' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/audit', label: 'Audit log', active: true },
    { href: '/manager-workspace', label: 'Switch mode', kind: 'workspace-switch' }
  ];
}

export default function AccessAuditView({ scope, accountEmail, events, errorMessage }: Props) {
  const latest = events[0];
  const visibleEvents = events.slice(0, 24);
  const approvals = eventCount(events, /approve|approval|reactivate|activate/i);
  const restrictions = eventCount(events, /reject|disable|suspend|block/i);
  const isMaster = scope === 'master';

  return <ConsoleShell role={scope} mode="operations" email={accountEmail} accountLabel={isMaster ? 'Master account' : 'Manager account'} brandSubtitle={isMaster ? 'Master audit' : 'Manager audit'} sidebarSectionTitle="Operations" navItems={auditNavItems(scope)} switchTarget={isMaster ? '/admin' : '/manager-workspace'} switchTargetLabel={isMaster ? 'Manager console' : 'Manager workspace'} navAriaLabel={isMaster ? 'Master audit navigation' : 'Manager audit navigation'} activeNavUsesConsoleLink>
    <header className="admin-monitor-header native-command-hero minimal-report-hero"><div><p>{isMaster ? 'Master audit' : 'Manager audit'}</p><h1>Access activity.</h1><span>Minimal access history focused on who changed access, who was affected, and what happened.</span></div></header>
    {errorMessage ? <section className="admin-monitor-card"><div className="admin-monitor-empty">Could not load audit events: {errorMessage}</div></section> : <><section className="minimal-report-summary" aria-label="Access audit summary"><article><span>Events</span><strong>{events.length}</strong><small>Recent access changes</small></article><article><span>Approvals</span><strong>{approvals}</strong><small>Granted or restored</small></article><article className={restrictions ? 'attention' : 'complete'}><span>Restrictions</span><strong>{restrictions}</strong><small>{restrictions ? 'Review context' : 'None recent'}</small></article><article><span>Latest</span><strong>{latest ? formatDate(latest.created_at) : '—'}</strong><small>Most recent event</small></article></section><section className="admin-monitor-card native-operation-card minimal-activity-card"><div className="admin-monitor-card-header compact-card-header"><div><p>Audit stream</p><h2>Recent access events</h2></div><span>{events.length} events</span></div>{visibleEvents.length ? <div className="minimal-activity-list audit-event-list" role="list">{visibleEvents.map((event) => <article key={event.id} className="minimal-activity-row audit-event-row" role="listitem"><div><strong>{readableAuditEventType(event.event_type)}</strong><span>{event.event_detail || 'Access event'} · {formatDate(event.created_at)}</span></div><small>{event.actor_email || 'System'} → {event.target_email || 'Account'}</small><em className="admin-status-badge active">{event.target_role || event.actor_role || 'event'}</em></article>)}</div> : <div className="admin-monitor-empty">No access audit events are available yet.</div>}</section></>}
  </ConsoleShell>;
}

```

### components/console/ui-shell-registry.ts

- Status: M

#### Old version preview

```text
export type UiShellRouteExpectation = {
  path: string;
  role: 'manager' | 'master';
  mode: 'operations' | 'workspace';
  owner: string;
};

export const UI_SHELL_ROUTE_EXPECTATIONS: UiShellRouteExpectation[] = [
  { path: '/admin', role: 'manager', mode: 'operations', owner: 'components/ManagerConsoleShell.tsx' },
  { path: '/manager-workspace', role: 'manager', mode: 'workspace', owner: 'components/ManagerConsoleShell.tsx' },
  { path: '/admin/access', role: 'manager', mode: 'operations', owner: 'app/admin/access/page.tsx' },
  { path: '/admin/clients', role: 'manager', mode: 'operations', owner: 'app/admin/clients/page.tsx' },
  { path: '/admin/reports', role: 'manager', mode: 'operations', owner: 'components/GenerationReportView.tsx' },
  { path: '/admin/audit', role: 'manager', mode: 'operations', owner: 'components/AccessAuditView.tsx' },
  { path: '/master', role: 'master', mode: 'operations', owner: 'app/master/MasterConsoleHome.tsx' },
  { path: '/master/accounts', role: 'master', mode: 'operations', owner: 'app/master/accounts/page.tsx' },
  { path: '/master/workspaces', role: 'master', mode: 'operations', owner: 'app/master/workspaces/page.tsx' },
  { path: '/master/reports', role: 'master', mode: 'operations', owner: 'components/GenerationReportView.tsx' },
  { path: '/master/audit', role: 'master', mode: 'operations', owner: 'components/AccessAuditView.tsx' },
  { path: '/master/system', role: 'master', mode: 'operations', owner: 'app/master/system/page.tsx' },
  { path: '/master/recovery', role: 'master', mode: 'operations', owner: 'app/master/recovery/page.tsx' }
];

export const UI_SHELL_FORBIDDEN_SOURCE_PATTERNS = [
  '<aside className="admin-monitor-sidebar',
  '<section className="admin-monitor-main',
  'className="admin-monitor-account"',
  '<ManagerWorkspaceSwitch',
  '<WorkspaceSwitchAnchor',
  'data-manager-switch-visible-slot="plain-nav-button"'
];

export const UI_SHELL_CANONICAL_COMPONENTS = {
  shell: 'components/console/ConsoleShell.tsx',
  sidebar: 'components/console/ConsoleShell.tsx',
  header: 'components/console/ConsoleHeader.tsx',
  accountMenu: 'components/console/AccountMenu.tsx',
  renderDebugger: 'components/console/RenderDebugger.tsx',
  templateExecution: 'lib/template-execution/template-execution-orchestrator.ts'
} as const;

export const UI_SHELL_RUNTIME_SIGNALS = {
  renderDebuggerStore: '__xdisputerDebug',
  templateExecutionStore: '__xdisputerTemplateExecution',
  templateExecutionEvent: 'xdisputer:template-execution'
} as const;

```

#### Latest version preview

```text
export type UiShellRouteExpectation = {
  path: string;
  role: 'manager' | 'master';
  mode: 'operations' | 'workspace';
  owner: string;
};

export const UI_SHELL_ROUTE_EXPECTATIONS: UiShellRouteExpectation[] = [
  { path: '/admin', role: 'manager', mode: 'operations', owner: 'components/ManagerConsoleShell.tsx' },
  { path: '/manager-workspace', role: 'manager', mode: 'workspace', owner: 'components/ManagerConsoleShell.tsx' },
  { path: '/admin/access', role: 'manager', mode: 'operations', owner: 'app/admin/access/page.tsx' },
  { path: '/admin/clients', role: 'manager', mode: 'operations', owner: 'app/admin/clients/page.tsx' },
  { path: '/admin/reports', role: 'manager', mode: 'operations', owner: 'components/GenerationReportView.tsx' },
  { path: '/admin/audit', role: 'manager', mode: 'operations', owner: 'components/AccessAuditView.tsx' },
  { path: '/master', role: 'master', mode: 'operations', owner: 'app/master/MasterConsoleHome.tsx' },
  { path: '/master/accounts', role: 'master', mode: 'operations', owner: 'app/master/accounts/page.tsx' },
  { path: '/master/reports', role: 'master', mode: 'operations', owner: 'components/GenerationReportView.tsx' },
  { path: '/master/audit', role: 'master', mode: 'operations', owner: 'components/AccessAuditView.tsx' },
  { path: '/master/system', role: 'master', mode: 'operations', owner: 'app/master/system/page.tsx' },
  { path: '/master/recovery', role: 'master', mode: 'operations', owner: 'app/master/recovery/page.tsx' }
];

export const UI_SHELL_FORBIDDEN_SOURCE_PATTERNS = [
  '<aside className="admin-monitor-sidebar',
  '<section className="admin-monitor-main',
  'className="admin-monitor-account"',
  '<ManagerWorkspaceSwitch',
  '<WorkspaceSwitchAnchor',
  'data-manager-switch-visible-slot="plain-nav-button"'
];

export const UI_SHELL_CANONICAL_COMPONENTS = {
  shell: 'components/console/ConsoleShell.tsx',
  sidebar: 'components/console/ConsoleShell.tsx',
  header: 'components/console/ConsoleHeader.tsx',
  accountMenu: 'components/console/AccountMenu.tsx',
  renderDebugger: 'components/console/RenderDebugger.tsx',
  templateExecution: 'lib/template-execution/template-execution-orchestrator.ts'
} as const;

export const UI_SHELL_RUNTIME_SIGNALS = {
  renderDebuggerStore: '__xdisputerDebug',
  templateExecutionStore: '__xdisputerTemplateExecution',
  templateExecutionEvent: 'xdisputer:template-execution'
} as const;

```

### package-lock.json

- Status: M

#### Old version preview

```text
{
  "name": "letter-generator",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "letter-generator",
      "version": "1.0.0",
      "dependencies": {
        "@supabase/ssr": "^0.12.0",
        "@supabase/supabase-js": "^2.108.1",
        "docx-preview": "^0.3.6",
        "docxtemplater": "^3.68.7",
        "html2canvas": "^1.4.1",
        "jszip": "^3.10.1",
        "next": "^16.2.6",
        "pdf-lib": "^1.17.1",
        "pdfjs-dist": "^5.4.296",
        "pizzip": "^3.2.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
      },
      "devDependencies": {
        "@types/node": "^22.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "typescript": "^5.7.0"
      }
    },
    "node_modules/@emnapi/runtime": {
      "version": "1.10.0",
      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.10.0.tgz",
      "integrity": "sha512-ewvYlk86xUoGI0zQRNq/mC+16R1QeDlKQy21Ki3oSYXNgLb45GV1P6A0M+/s6nyCuNDqe5VpaY84BzXGwVbwFA==",
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@img/colour": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@img/colour/-/colour-1.1.0.tgz",
      "integrity": "sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==",
      "license": "MIT",
      "optional": true,
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@img/sharp-darwin-arm64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.34.5.tgz",
      "integrity": "sha512-imtQ3WMJXbMY4fxb/Ndp6HBTNVtWCUI0WdobyheGf5+ad6xX8VIDO8u2xE4qc/fr08CKG/7dDseFtn6M6g/r3w==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-arm64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-darwin-x64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.34.5.tgz",
      "integrity": "sha512-YNEFAF/4KQ/PeW0N+r+aVVsoIY0/qxxikF2SWdp+NRkmMB7y9LBZAVqQ4yhGCm/H3H270OSykqmQMKLBhBJDEw==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-x64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-arm64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.2.4.tgz",
      "integrity": "sha512-zqjjo7RatFfFoP0MkQ51jfuFZBnVE2pRiaydKJ1G/rHZvnsrHAOcQALIi9sA5co5xenQdTugCvtb1cuf78Vf4g==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-x64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.2.4.tgz",
      "integrity": "sha512-1IOd5xfVhlGwX+zXv2N93k0yMONvUlANylbJw1eTah8K/Jtpi15KC+WSiaX/nBmbm2HxRM1gZ0nSdjSsrZbGKg==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
... clipped 1475 line(s) ...
```

#### Latest version preview

```text
{
  "name": "letter-generator",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "letter-generator",
      "version": "1.0.0",
      "dependencies": {
        "@dnd-kit/core": "^6.3.1",
        "@dnd-kit/modifiers": "^9.0.0",
        "@dnd-kit/sortable": "^10.0.0",
        "@supabase/ssr": "^0.12.0",
        "@supabase/supabase-js": "^2.108.1",
        "docx-preview": "^0.3.6",
        "docxtemplater": "^3.68.7",
        "html2canvas": "^1.4.1",
        "jszip": "^3.10.1",
        "next": "^16.2.6",
        "pdf-lib": "^1.17.1",
        "pdfjs-dist": "^5.4.296",
        "pizzip": "^3.2.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
      },
      "devDependencies": {
        "@types/node": "^22.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "typescript": "^5.7.0"
      }
    },
    "node_modules/@dnd-kit/accessibility": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/@dnd-kit/accessibility/-/accessibility-3.1.1.tgz",
      "integrity": "sha512-2P+YgaXF+gRsIihwwY1gCsQSYnu9Zyj2py8kY5fFvUM1qm2WA2u639R6YNVfU4GWr+ZM5mqEsfHZZLoRONbemw==",
      "license": "MIT",
      "dependencies": {
        "tslib": "^2.0.0"
      },
      "peerDependencies": {
        "react": ">=16.8.0"
      }
    },
    "node_modules/@dnd-kit/core": {
      "version": "6.3.1",
      "resolved": "https://registry.npmjs.org/@dnd-kit/core/-/core-6.3.1.tgz",
      "integrity": "sha512-xkGBRQQab4RLwgXxoqETICr6S5JlogafbhNsidmrkVv2YRs5MLwpjoF2qpiGjQt8S9AoxtIV603s0GIUpY5eYQ==",
      "license": "MIT",
      "dependencies": {
        "@dnd-kit/accessibility": "^3.1.1",
        "@dnd-kit/utilities": "^3.2.2",
        "tslib": "^2.0.0"
      },
      "peerDependencies": {
        "react": ">=16.8.0",
        "react-dom": ">=16.8.0"
      }
    },
    "node_modules/@dnd-kit/modifiers": {
      "version": "9.0.0",
      "resolved": "https://registry.npmjs.org/@dnd-kit/modifiers/-/modifiers-9.0.0.tgz",
      "integrity": "sha512-ybiLc66qRGuZoC20wdSSG6pDXFikui/dCNGthxv4Ndy8ylErY0N3KVxY2bgo7AWwIbxDmXDg3ylAFmnrjcbVvw==",
      "license": "MIT",
      "dependencies": {
        "@dnd-kit/utilities": "^3.2.2",
        "tslib": "^2.0.0"
      },
      "peerDependencies": {
        "@dnd-kit/core": "^6.3.0",
        "react": ">=16.8.0"
      }
    },
    "node_modules/@dnd-kit/sortable": {
      "version": "10.0.0",
      "resolved": "https://registry.npmjs.org/@dnd-kit/sortable/-/sortable-10.0.0.tgz",
      "integrity": "sha512-+xqhmIIzvAYMGfBYYnbKuNicfSsk4RksY2XdmJhT+HAC01nix6fHCztU68jooFiMUB01Ky3F0FyOvhG/BZrWkg==",
      "license": "MIT",
      "dependencies": {
        "@dnd-kit/utilities": "^3.2.2",
        "tslib": "^2.0.0"
      },
      "peerDependencies": {
        "@dnd-kit/core": "^6.3.0",
        "react": ">=16.8.0"
      }
    },
    "node_modules/@dnd-kit/utilities": {
      "version": "3.2.2",
      "resolved": "https://registry.npmjs.org/@dnd-kit/utilities/-/utilities-3.2.2.tgz",
      "integrity": "sha512-+MKAJEOfaBe5SmV6t34p80MMKhjvUz0vRrvVJbPT0WElzaOJ/1xs+D+KDv+tD/NE5ujfrChEcshd4fLn0wpiqg==",
      "license": "MIT",
      "dependencies": {
        "tslib": "^2.0.0"
      },
      "peerDependencies": {
        "react": ">=16.8.0"
      }
    },
    "node_modules/@emnapi/runtime": {
      "version": "1.10.0",
      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.10.0.tgz",
      "integrity": "sha512-ewvYlk86xUoGI0zQRNq/mC+16R1QeDlKQy21Ki3oSYXNgLb45GV1P6A0M+/s6nyCuNDqe5VpaY84BzXGwVbwFA==",
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@img/colour": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@img/colour/-/colour-1.1.0.tgz",
      "integrity": "sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==",
      "license": "MIT",
      "optional": true,
      "engines": {
        "node": ">=18"
      }
    },
... clipped 1545 line(s) ...
```

