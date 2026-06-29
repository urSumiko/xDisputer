import ConsoleShell from './console/ConsoleShell';
import type { ConsoleNavItem } from './console/ConsoleShell';
import { readableAuditEventType, type AccessAuditEvent } from '../lib/saas/access-audit';
import { displayAccountRoleBadge, replaceClientUserTerms } from '../lib/saas/display-terminology';

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
function auditText(value: string) { return replaceClientUserTerms(value); }
function roleBadge(value: string | null | undefined) { return displayAccountRoleBadge(value || 'event'); }

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
    { href: '/admin?panel=intake', label: 'Disputer intake' },
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
    <header className="admin-monitor-header native-command-hero minimal-report-hero"><div><p>{isMaster ? 'Master audit' : 'Manager audit'}</p><h1>Access activity.</h1><span>Minimal access history focused on who changed access, which disputer account was affected, and what happened.</span></div></header>
    {errorMessage ? <section className="admin-monitor-card"><div className="admin-monitor-empty">Could not load audit events: {errorMessage}</div></section> : <><section className="minimal-report-summary" aria-label="Access audit summary"><article><span>Events</span><strong>{events.length}</strong><small>Recent access changes</small></article><article><span>Approvals</span><strong>{approvals}</strong><small>Granted or restored</small></article><article className={restrictions ? 'attention' : 'complete'}><span>Restrictions</span><strong>{restrictions}</strong><small>{restrictions ? 'Review context' : 'None recent'}</small></article><article><span>Latest</span><strong>{latest ? formatDate(latest.created_at) : '—'}</strong><small>Most recent event</small></article></section><section className="admin-monitor-card native-operation-card minimal-activity-card"><div className="admin-monitor-card-header compact-card-header"><div><p>Audit stream</p><h2>Recent access events</h2></div><span>{events.length} events</span></div>{visibleEvents.length ? <div className="minimal-activity-list audit-event-list" role="list">{visibleEvents.map((event) => <article key={event.id} className="minimal-activity-row audit-event-row" role="listitem"><div><strong>{auditText(readableAuditEventType(event.event_type))}</strong><span>{auditText(event.event_detail || 'Access event')} · {formatDate(event.created_at)}</span></div><small>{event.actor_email || 'System'} → {event.target_email || 'Workspace'}</small><em className="admin-status-badge active">{roleBadge(event.target_role || event.actor_role || 'event')}</em></article>)}</div> : <div className="admin-monitor-empty">No access audit events are available yet.</div>}</section></>}
  </ConsoleShell>;
}
