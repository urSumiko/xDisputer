import ConsoleNavLink from '../../components/ConsoleNavLink';
import ManagerConsoleShell from '../../components/ManagerConsoleShell';
import ManagerPayrollSettingsEditor from '../../components/manager/ManagerPayrollSettingsEditor';
import ManagerReportControls from '../../components/manager/ManagerReportControls';
import ManagerConsoleRealtimeRefreshMount from '../../components/manager/ManagerConsoleRealtimeRefreshMount';
import ManagerKpiGrid from '../../src/features/manager-console/components/ManagerKpiGrid';
import {
  emptyDirectoryResult,
  formatDate,
  money,
  outputUsage,
  statusText,
  stringParam,
  uniqueAccounts
} from '../../src/features/manager-console/admin-page-presenters';
import { headers } from 'next/headers';
import { ensureManagerInviteCode } from '../../lib/saas/account-management';
import {
  getManagerClientSummary,
  listManagerClientDirectory,
  type AccountDirectoryListResult,
  type AccountDirectoryRow
} from '../../lib/saas/account-directory';
import { listEntitlementLimits, type EntitlementLimitMap } from '../../lib/saas/entitlement-limits';
import {
  listManagerUserSettings,
  payrollAmount,
  type ManagerUserSetting,
  type ManagerUserSettingMap
} from '../../lib/saas/manager-user-settings';
import { requireRole } from '../../lib/saas/session';
import { managerOperationsNavItems, normalizeManagerOperationsPanel } from '../../lib/manager-console/manager-operations-panels';
import { formatReportDateRange, listManagerReportData, moneyText, parseManagerReportInput, type ManagerReportData, type ManagerReportType } from '../../lib/manager-console/manager-reporting';

type PageProps = {
  searchParams?: Promise<{ panel?: string | string[]; control?: string | string[]; message?: string | string[]; reportType?: string | string[]; from?: string | string[]; to?: string | string[] }>;
};

type ManagerOperationsPanel = ReturnType<typeof normalizeManagerOperationsPanel>;

const COMPACT_PAGE_SIZE = 8;
const PANEL_PAGE_SIZE = 25;

function emptySettings() {
  return { settings: {} as ManagerUserSettingMap, errorMessage: null as string | null };
}

function accountIds(accounts: AccountDirectoryRow[]) {
  return Array.from(new Set(accounts.map((account) => account.id).filter(Boolean)));
}

function employmentTypeFor(settings: ManagerUserSetting | undefined) {
  return settings?.employment_type === 'output_based' || settings?.is_regular === false ? 'output_based' : 'full_time';
}

function employmentTypeLabel(settings: ManagerUserSetting | undefined) {
  return employmentTypeFor(settings) === 'full_time' ? 'Full-time' : 'Per-output';
}

function accountsForPanel(activePanel: ManagerOperationsPanel, pending: AccountDirectoryListResult, active: AccountDirectoryListResult, blocked: AccountDirectoryListResult, all: AccountDirectoryListResult) {
  if (activePanel === 'access' || activePanel === 'reports') return all.accounts;
  if (activePanel === 'output_activity') return active.accounts;
  if (activePanel === 'requests') return uniqueAccounts(pending.accounts, blocked.accounts);
  return active.accounts;
}

function managerPanelHeader(activePanel: ManagerOperationsPanel, fallbackLabel?: string) {
  if (activePanel === 'access') return { title: 'Access Control', description: 'Manage Disputer account status, approval, and compact metadata from one focused stable view.' };
  if (activePanel === 'output_activity') return { title: 'Output Activity', description: 'Confirm generated output before it affects payday pay.' };
  if (activePanel === 'requests') return { title: 'Request', description: 'Review pending confirmations and invite requests.' };
  if (activePanel === 'reports') return { title: 'Report', description: 'Generate salary reports with output details from Monday-based PH work weeks.' };
  return { title: fallbackLabel || 'Monitoring', description: 'Monitor outputs and Disputer status from one clean panel.' };
}

function ControlForm({ profileId, intent, label, primary = false }: { profileId: string; intent: string; label: string; primary?: boolean }) {
  return <form action="/api/control/profile" method="post"><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="intent" value={intent} /><button type="submit" className={`admin-action-button ${primary ? 'primary' : ''}`}>{label}</button></form>;
}

function AccountStatusActions({ account }: { account: AccountDirectoryRow }) {
  return <div className="manager-console-actions-row manager-console-top-actions">{account.account_status === 'pending_manager_approval' && <><ControlForm profileId={account.id} intent="approve" label="Accept" primary /><ControlForm profileId={account.id} intent="reject" label="Reject" /></>}{account.account_status === 'active' && <><ControlForm profileId={account.id} intent="suspend" label="Pause" /><ControlForm profileId={account.id} intent="clear_manager" label="Unlink" /></>}{(account.account_status === 'disabled' || account.account_status === 'suspended') && <ControlForm profileId={account.id} intent="activate" label="Reactivate" primary />}</div>;
}

function ManagerAccountCard({ account, entitlements, settings }: { account: AccountDirectoryRow; entitlements: EntitlementLimitMap; settings: ManagerUserSettingMap }) {
  const setting = settings[account.id];
  const entitlement = entitlements[account.id];
  const outputActivityPay = payrollAmount(setting, entitlement?.output_used_today || 0);
  return <article className="manager-console-user-card" data-compact-account-record="true" data-output-used-today={entitlement?.output_used_today || 0} data-output-limit={entitlement?.effective_output_limit ?? 'default'}>
    <header className="manager-console-user-header-v2"><div><strong>{account.full_name || account.email || 'Unnamed Disputer'}</strong><span>{account.email || 'No email'} • Updated {formatDate(account.updated_at)}</span></div><div className="manager-console-status-actions"><AccountStatusActions account={account} /><span className={`admin-status-badge ${account.account_status || 'pending'}`}>{statusText(account.account_status)}</span></div></header>
    <div className="manager-console-user-metrics"><span>{outputUsage(entitlements, account.id)}</span><span>{employmentTypeLabel(setting)}</span><span>{employmentTypeFor(setting) === 'full_time' ? `Fixed salary ${money(outputActivityPay)}` : `Output estimate ${money(outputActivityPay)}`}</span></div>
    <ManagerPayrollSettingsEditor profileId={account.id} initialEmploymentType={employmentTypeFor(setting)} initialBaseSalary={setting?.base_salary || setting?.salary || 0} initialPerOutputRate={setting?.per_output_rate || setting?.rate || 0} initialNotes={setting?.notes || ''} />
  </article>;
}

function EmptyState({ children }: { children: string }) { return <div className="admin-monitor-empty manager-console-empty">{children}</div>; }
function MonitoringPanel({ summary, pending, active, entitlements }: { summary: Awaited<ReturnType<typeof getManagerClientSummary>>['summary']; pending: AccountDirectoryListResult; active: AccountDirectoryListResult; entitlements: EntitlementLimitMap }) { const outputToday = active.accounts.reduce((sum, account) => sum + (entitlements[account.id]?.output_used_today || 0), 0); return <><ManagerKpiGrid summary={summary} outputToday={outputToday} /><section className="manager-console-two-column"><article className="admin-monitor-card native-operation-card"><header className="manager-console-card-header"><div><p>Monitoring</p><h2>Active output status</h2></div><ConsoleNavLink className="dashboard-card-link" href="/admin/output-queue">Open queue</ConsoleNavLink></header>{active.accounts.length ? <div className="manager-console-compact-list">{active.accounts.map((account) => <div key={account.id}><strong>{account.full_name || account.email || 'Disputer'}</strong><span>{outputUsage(entitlements, account.id)}</span></div>)}</div> : <EmptyState>No active Disputers to monitor yet.</EmptyState>}</article><article className="admin-monitor-card native-operation-card"><header className="manager-console-card-header"><div><p>Request</p><h2>Pending confirmation</h2></div><ConsoleNavLink className="dashboard-card-link" href="/admin?panel=requests">Review</ConsoleNavLink></header>{pending.accounts.length ? <div className="manager-console-compact-list">{pending.accounts.map((account) => <div key={account.id}><strong>{account.full_name || account.email || 'Disputer'}</strong><span>{statusText(account.account_status)}</span></div>)}</div> : <EmptyState>No pending confirmations.</EmptyState>}</article></section></>; }
function AccessPanel({ accounts, entitlements, settings }: { accounts: AccountDirectoryRow[]; entitlements: EntitlementLimitMap; settings: ManagerUserSettingMap }) { return <section className="manager-console-stack account-record-compact-stack">{accounts.length ? accounts.map((account) => <ManagerAccountCard key={account.id} account={account} entitlements={entitlements} settings={settings} />) : <EmptyState>No Disputers are assigned to this manager workspace yet.</EmptyState>}</section>; }

function reportTypeLabel(type: ManagerReportType) {
  if (type === 'salary_outputs') return 'Salary';
  if (type === 'users') return 'Users';
  return 'Summary';
}

function reportExportHref(report: ManagerReportData) {
  const params = new URLSearchParams({ reportType: report.input.type, from: report.input.range.fromDate, to: report.input.range.toDate });
  return `/api/manager/report-export?${params.toString()}`;
}

function outputPay(totalPay: number, baseSalary: number) {
  return Math.max(0, totalPay - baseSalary);
}

function ReportTable({ report }: { report: ManagerReportData }) {
  if (report.input.type === 'salary_outputs') return <div className="manager-report-table-scroll"><table className="manager-report-table"><thead><tr><th>Disputer</th><th>Type</th><th>Daily cap</th><th>Base salary</th><th>Rate</th><th>Approved outputs</th><th>Pending</th><th>Returned</th><th>Output pay</th><th>Total pay</th></tr></thead><tbody>{report.users.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.email}</small></td><td>{row.employmentType}</td><td>{row.outputLimit ?? 'Needs Master cap'}</td><td>{moneyText(row.baseSalary)}</td><td>{moneyText(row.perOutputRate)}</td><td>{row.approvedOutputs}</td><td>{row.pendingOutputs}</td><td>{row.returnedOutputs}</td><td>{moneyText(outputPay(row.estimatedPay, row.baseSalary))}</td><td>{moneyText(row.estimatedPay)}</td></tr>)}</tbody></table></div>;
  if (report.input.type === 'users') return <div className="manager-report-table-scroll"><table className="manager-report-table"><thead><tr><th>Disputer</th><th>Status</th><th>Type</th><th>Daily cap</th><th>Outputs</th><th>Approved</th><th>Pending</th><th>Returned</th></tr></thead><tbody>{report.users.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.email}</small></td><td>{row.status}</td><td>{row.employmentType}</td><td>{row.outputLimit ?? 'Needs Master cap'}</td><td>{row.outputs}</td><td>{row.approvedOutputs}</td><td>{row.pendingOutputs}</td><td>{row.returnedOutputs}</td></tr>)}</tbody></table></div>;
  return <div className="manager-report-table-scroll"><table className="manager-report-table"><thead><tr><th>Disputer</th><th>Status</th><th>Outputs</th><th>Approved</th><th>Pending</th><th>Returned</th><th>Output pay</th><th>Total pay</th></tr></thead><tbody>{report.users.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.email}</small></td><td>{row.status}</td><td>{row.outputs}</td><td>{row.approvedOutputs}</td><td>{row.pendingOutputs}</td><td>{row.returnedOutputs}</td><td>{moneyText(outputPay(row.estimatedPay, row.baseSalary))}</td><td>{moneyText(row.estimatedPay)}</td></tr>)}</tbody></table></div>;
}

function ReportPanel({ report }: { report: ManagerReportData }) {
  const type = report.input.type;
  return <section className="admin-monitor-card native-operation-card manager-console-report manager-report-workspace">
    <header className="manager-console-card-header manager-report-header"><div><p>Report builder</p><h2>{reportTypeLabel(type)} report</h2><span>{formatReportDateRange(report.input.range)}</span></div></header>
    <ManagerReportControls reportType={type} fromDate={report.input.range.fromDate} toDate={report.input.range.toDate} exportHref={reportExportHref(report)} />
    {report.errorMessage && <div className="admin-monitor-empty">Report warning: {report.errorMessage}</div>}
    <div className="manager-report-kpis"><span><small>Disputers</small><strong>{report.totals.userCount}</strong></span><span><small>Outputs</small><strong>{report.totals.totalOutputItems}</strong></span><span><small>Approved</small><strong>{report.totals.approvedRows}</strong></span><span><small>Pending</small><strong>{report.totals.pendingRows}</strong></span><span><small>Returned</small><strong>{report.totals.returnedRows}</strong></span><span><small>Estimated pay</small><strong>{moneyText(report.totals.estimatedPayTotal)}</strong></span></div>
    <ReportTable report={report} />
  </section>;
}

function OutputActivityPanel({ accounts, entitlements, settings }: { accounts: AccountDirectoryRow[]; entitlements: EntitlementLimitMap; settings: ManagerUserSettingMap }) { const total = accounts.reduce((sum, account) => sum + payrollAmount(settings[account.id], entitlements[account.id]?.output_used_today || 0), 0); return <section className="admin-monitor-card native-operation-card manager-console-report"><header className="manager-console-card-header"><div><p>Output Activity</p><h2>Confirmed disputer output pay</h2></div><strong>{money(total)}</strong></header><div className="manager-console-stack account-record-compact-stack">{accounts.length ? accounts.map((account) => <ManagerAccountCard key={account.id} account={account} entitlements={entitlements} settings={settings} />) : <EmptyState>No active Disputers for output activity computation.</EmptyState>}</div></section>; }
function RequestsPanel({ pending, blocked, entitlements, settings }: { pending: AccountDirectoryListResult; blocked: AccountDirectoryListResult; entitlements: EntitlementLimitMap; settings: ManagerUserSettingMap }) { const requests = uniqueAccounts(pending.accounts, blocked.accounts); return <section className="manager-console-stack account-record-compact-stack">{requests.length ? requests.map((account) => <ManagerAccountCard key={account.id} account={account} entitlements={entitlements} settings={settings} />) : <EmptyState>No pending confirmations or blocked users.</EmptyState>}</section>; }

export default async function AdminPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const activePanel = normalizeManagerOperationsPanel(params.panel);
  const controlStatus = stringParam(params.control);
  const controlMessage = stringParam(params.message);
  const reportInput = parseManagerReportInput({ reportType: params.reportType, from: params.from, to: params.to });
  const { user, profile, supabase } = await requireRole('manager');

  let pendingPromise: Promise<AccountDirectoryListResult> = Promise.resolve(emptyDirectoryResult);
  let activePromise: Promise<AccountDirectoryListResult> = Promise.resolve(emptyDirectoryResult);
  let blockedPromise: Promise<AccountDirectoryListResult> = Promise.resolve(emptyDirectoryResult);
  let allPromise: Promise<AccountDirectoryListResult> = Promise.resolve(emptyDirectoryResult);
  let invitePromise: Promise<string> = Promise.resolve('');

  if (activePanel === 'monitoring') { pendingPromise = listManagerClientDirectory(supabase, { view: 'pending', page: 1, pageSize: COMPACT_PAGE_SIZE }); activePromise = listManagerClientDirectory(supabase, { view: 'active', page: 1, pageSize: COMPACT_PAGE_SIZE }); }
  else if (activePanel === 'access' || activePanel === 'reports') allPromise = listManagerClientDirectory(supabase, { view: 'all', page: 1, pageSize: PANEL_PAGE_SIZE });
  else if (activePanel === 'output_activity') activePromise = listManagerClientDirectory(supabase, { view: 'active', page: 1, pageSize: PANEL_PAGE_SIZE });
  else if (activePanel === 'requests') { pendingPromise = listManagerClientDirectory(supabase, { view: 'pending', page: 1, pageSize: COMPACT_PAGE_SIZE }); blockedPromise = listManagerClientDirectory(supabase, { view: 'blocked', page: 1, pageSize: COMPACT_PAGE_SIZE }); invitePromise = ensureManagerInviteCode(supabase, user.id); }

  const [summaryResult, pendingResult, activeResult, blockedResult, allResult, inviteCode, reportResult] = await Promise.all([getManagerClientSummary(supabase), pendingPromise, activePromise, blockedPromise, allPromise, invitePromise, activePanel === 'reports' ? listManagerReportData(supabase, user.id, reportInput) : Promise.resolve(null)]);
  const panelAccounts = accountsForPanel(activePanel, pendingResult, activeResult, blockedResult, allResult);
  const entitlementIds = accountIds(panelAccounts);
  const needsUserSettings = activePanel === 'access' || activePanel === 'output_activity' || activePanel === 'requests';
  const [entitlementResult, settingsResult] = await Promise.all([listEntitlementLimits(supabase, [user.id, ...entitlementIds]), needsUserSettings ? listManagerUserSettings(supabase, user.id, entitlementIds) : Promise.resolve(emptySettings())]);
  const summary = summaryResult.summary;
  const queryError = summaryResult.errorMessage || pendingResult.errorMessage || activeResult.errorMessage || blockedResult.errorMessage || allResult.errorMessage || entitlementResult.errorMessage || settingsResult.errorMessage;
  const activeDefinition = managerOperationsNavItems(activePanel).find((item) => 'active' in item && item.active === true);
  const panelHeader = managerPanelHeader(activePanel, activeDefinition?.label);

  let inviteLink = '';
  if (activePanel === 'requests') { const requestHeaders = await headers(); const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || 'x-disputer.vercel.app'; const protocol = requestHeaders.get('x-forwarded-proto') || 'https'; inviteLink = `${protocol}://${host}/signup?invite=${encodeURIComponent(inviteCode)}`; }

  return <ManagerConsoleShell mode="operations" email={profile?.email || user.email} accountName={profile?.full_name || user.user_metadata?.full_name as string | null | undefined} accountLabel="Manager account" navItems={managerOperationsNavItems(activePanel)} header={{ eyebrow: 'Manager console', title: panelHeader.title, description: panelHeader.description }}>
    <ManagerConsoleRealtimeRefreshMount />
    {controlStatus && <section className={`admin-monitor-card admin-feedback-card ${controlStatus === 'ok' ? 'success' : 'error'}`}><strong>{controlStatus === 'ok' ? 'Action completed' : 'Action failed'}</strong><span>{controlStatus === 'ok' ? controlMessage || 'The manager console refreshed with the latest state.' : controlMessage || 'Unknown error.'}</span></section>}
    {queryError && <section className="admin-monitor-card"><div className="admin-monitor-empty">Could not load a manager console dataset: {queryError}</div></section>}
    {activePanel === 'monitoring' && <MonitoringPanel summary={summary} pending={pendingResult} active={activeResult} entitlements={entitlementResult.entitlements} />}
    {activePanel === 'access' && <AccessPanel accounts={panelAccounts} entitlements={entitlementResult.entitlements} settings={settingsResult.settings} />}
    {activePanel === 'reports' && reportResult && <ReportPanel report={reportResult} />}
    {activePanel === 'output_activity' && <OutputActivityPanel accounts={panelAccounts} entitlements={entitlementResult.entitlements} settings={settingsResult.settings} />}
    {activePanel === 'requests' && <><section className="admin-monitor-card native-operation-card"><div className="manager-invite-panel"><div><p>Invite link</p><strong>{inviteLink || 'Create or rotate invite from the master account.'}</strong></div>{inviteLink && <ConsoleNavLink className="admin-action-button primary" href={inviteLink}>Open invite</ConsoleNavLink>}</div></section><RequestsPanel pending={pendingResult} blocked={blockedResult} entitlements={entitlementResult.entitlements} settings={settingsResult.settings} /></>}
  </ManagerConsoleShell>;
}
