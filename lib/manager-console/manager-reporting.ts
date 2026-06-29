import type { createSupabaseServerClient } from '../supabase/server';
import { listManagerClientDirectory, type AccountDirectoryRow } from '../saas/account-directory';
import { listEntitlementLimits, type EntitlementLimitMap } from '../saas/entitlement-limits';
import { listManagerUserSettings, type ManagerUserSetting, type ManagerUserSettingMap } from '../saas/manager-user-settings';
import { bossNameFromLegacyNotes, normalizeBossReportName } from './boss-reporting-contract';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ManagerReportType = 'summary' | 'salary_outputs' | 'users' | 'per_boss';
export type ManagerReportRange = { fromDate: string; toDate: string; startIso: string; endIso: string };
export type ManagerReportInput = { type: ManagerReportType; range: ManagerReportRange };
export type ManagerReportOutputRow = { id: string; disputerId: string; disputerName: string; disputerEmail: string; bossName: string; clientName: string; roundLabel: string; status: string; outputType: string; outputCount: number; rateAmount: number; estimatedPay: number; createdAt: string };
export type ManagerReportUserRow = { id: string; name: string; email: string; status: string; employmentType: string; baseSalary: number; perOutputRate: number; outputLimit: number | null; outputs: number; approvedOutputs: number; pendingOutputs: number; returnedOutputs: number; estimatedPay: number };
export type ManagerReportBossRow = { bossName: string; disputerCount: number; outputRows: number; outputItems: number; approvedOutputs: number; pendingOutputs: number; returnedOutputs: number; fulltimeRows: number; outputPay: number; totalPay: number };
export type ManagerReportTotals = { userCount: number; activeUsers: number; blockedUsers: number; totalOutputRows: number; totalOutputItems: number; approvedRows: number; pendingRows: number; returnedRows: number; fulltimeRows: number; baseSalaryTotal: number; approvedExtraPay: number; pendingExtraPay: number; estimatedPayTotal: number };
export type ManagerReportData = { input: ManagerReportInput; accounts: AccountDirectoryRow[]; entitlements: EntitlementLimitMap; settings: ManagerUserSettingMap; outputs: ManagerReportOutputRow[]; users: ManagerReportUserRow[]; bosses: ManagerReportBossRow[]; totals: ManagerReportTotals; errorMessage: string | null };

type RawOutputApproval = {
  id: string;
  disputer_id: string;
  generation_run_id: string | null;
  output_label: string | null;
  output_count: number | null;
  rate_amount: number | null;
  status: string | null;
  notes: string | null;
  round_label: string | null;
  letter_route: string | null;
  client_name: string | null;
  is_per_output: boolean | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string | null;
  boss_id?: string | null;
};

const REPORT_TYPES = new Set<ManagerReportType>(['summary', 'salary_outputs', 'users', 'per_boss']);
const OUTPUT_COLUMNS_LEGACY = 'id,disputer_id,generation_run_id,output_label,output_count,rate_amount,status,notes,round_label,letter_route,client_name,is_per_output,approved_at,rejected_at,created_at';
const OUTPUT_COLUMNS_STRUCTURED = `${OUTPUT_COLUMNS_LEGACY},boss_id`;
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

function dateOnly(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(date: Date, days: number) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
function dateFromPhParts(year: number, monthIndex: number, day: number) { return new Date(Date.UTC(year, monthIndex, day) - PH_OFFSET_MS); }
function phDateOnlyFromUtc(utcDate: Date) { return dateOnly(new Date(utcDate.getTime() + PH_OFFSET_MS)); }
function safePhDate(value: string | null | undefined) { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const [year, month, day] = value.split('-').map(Number); const date = dateFromPhParts(year, month - 1, day); return Number.isNaN(date.getTime()) ? null : date; }
function positiveMoney(value: unknown) { const number = Number(value || 0); return Number.isFinite(number) ? Math.max(0, number) : 0; }
function accountName(account?: AccountDirectoryRow) { return account?.full_name || account?.email || 'Disputer'; }
function accountStatus(account?: AccountDirectoryRow) { return account?.account_status || 'unknown'; }
function employmentType(setting?: ManagerUserSetting) { return setting?.employment_type === 'output_based' || setting?.is_regular === false ? 'Per-output' : 'Full-time'; }
function normalizeReportType(value: string | undefined): ManagerReportType { if (value === 'salary' || value === 'outputs') return 'salary_outputs'; if (value === 'boss' || value === 'bosses' || value === 'per-boss' || value === 'perBoss') return 'per_boss'; return value && REPORT_TYPES.has(value as ManagerReportType) ? value as ManagerReportType : 'summary'; }

export function moneyText(value: number) { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value || 0); }
export function formatReportDate(value: string) { if (!value) return '—'; try { return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value)); } catch { return '—'; } }
export function formatReportDateRange(range: ManagerReportRange) { return `${formatReportDate(range.startIso)} to ${formatReportDate(addDays(new Date(range.endIso), -1).toISOString())}`; }

export function defaultManagerReportRange(now = new Date()): ManagerReportRange {
  const phNow = new Date(now.getTime() + PH_OFFSET_MS);
  const phDay = phNow.getUTCDay();
  const mondayDelta = (phDay + 6) % 7;
  const mondayUtc = dateFromPhParts(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate() - mondayDelta);
  const sundayUtc = addDays(mondayUtc, 6);
  const endExclusiveUtc = addDays(mondayUtc, 7);
  return { fromDate: phDateOnlyFromUtc(mondayUtc), toDate: phDateOnlyFromUtc(sundayUtc), startIso: mondayUtc.toISOString(), endIso: endExclusiveUtc.toISOString() };
}

export function parseManagerReportInput(search: { reportType?: string | string[]; from?: string | string[]; to?: string | string[] }): ManagerReportInput {
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const type = normalizeReportType(first(search.reportType));
  const fallback = defaultManagerReportRange();
  const fromDate = safePhDate(first(search.from));
  const toDate = safePhDate(first(search.to));
  if (!fromDate || !toDate || fromDate > toDate) return { type, range: fallback };
  return { type, range: { fromDate: phDateOnlyFromUtc(fromDate), toDate: phDateOnlyFromUtc(toDate), startIso: fromDate.toISOString(), endIso: addDays(toDate, 1).toISOString() } };
}

function rowPay(row: RawOutputApproval, setting?: ManagerUserSetting) {
  if (row.is_per_output !== true || (row.status !== 'approved' && row.status !== 'paid')) return 0;
  return Math.max(1, Number(row.output_count || 1)) * positiveMoney(row.rate_amount || setting?.per_output_rate || setting?.rate || 0);
}

function emptyTotals(): ManagerReportTotals { return { userCount: 0, activeUsers: 0, blockedUsers: 0, totalOutputRows: 0, totalOutputItems: 0, approvedRows: 0, pendingRows: 0, returnedRows: 0, fulltimeRows: 0, baseSalaryTotal: 0, approvedExtraPay: 0, pendingExtraPay: 0, estimatedPayTotal: 0 }; }

async function queryOutputApprovals(supabase: SupabaseServerClient, managerId: string, range: ManagerReportRange) {
  const query = (columns: string) => supabase.from('manager_disputer_output_approvals').select(columns).eq('manager_id', managerId).gte('created_at', range.startIso).lt('created_at', range.endIso).order('created_at', { ascending: false });
  const structured = await query(OUTPUT_COLUMNS_STRUCTURED);
  if (!structured.error) return structured;
  const missingBossColumn = /boss_id|column|schema cache/i.test(structured.error.message || '');
  if (!missingBossColumn) return structured;
  return query(OUTPUT_COLUMNS_LEGACY);
}

async function resolveBossName(supabase: SupabaseServerClient, managerId: string, row: RawOutputApproval) {
  const fallback = bossNameFromLegacyNotes(row.notes);
  const result = await supabase.rpc('report_boss_name_v1', {
    manager_id_input: managerId,
    disputer_id_input: row.disputer_id,
    activity_boss_id: row.boss_id || null,
    legacy_notes: row.notes || null
  });
  if (result.error || typeof result.data !== 'string') return fallback;
  return normalizeBossReportName(result.data || fallback);
}

function buildBossRows(outputs: ManagerReportOutputRow[], users: ManagerReportUserRow[]) {
  const byDisputer = new Map(users.map((user) => [user.id, user]));
  const groups = new Map<string, { disputers: Set<string>; outputRows: number; outputItems: number; approvedOutputs: number; pendingOutputs: number; returnedOutputs: number; fulltimeRows: number; outputPay: number; totalPay: number }>();
  for (const row of outputs) {
    const key = normalizeBossReportName(row.bossName);
    const group = groups.get(key) || { disputers: new Set<string>(), outputRows: 0, outputItems: 0, approvedOutputs: 0, pendingOutputs: 0, returnedOutputs: 0, fulltimeRows: 0, outputPay: 0, totalPay: 0 };
    group.disputers.add(row.disputerId);
    group.outputRows += 1;
    group.outputItems += row.outputCount;
    if (row.status === 'approved' || row.status === 'paid') group.approvedOutputs += row.outputCount;
    if (row.status === 'pending') group.pendingOutputs += row.outputCount;
    if (row.status === 'rejected') group.returnedOutputs += row.outputCount;
    if (row.outputType === 'Full-time record') group.fulltimeRows += 1;
    group.outputPay += row.estimatedPay;
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    for (const disputerId of group.disputers) {
      const user = byDisputer.get(disputerId);
      if (user?.employmentType === 'Full-time') group.totalPay += user.baseSalary;
    }
    group.totalPay += group.outputPay;
  }
  return Array.from(groups.entries()).map(([name, group]) => ({ bossName: name, disputerCount: group.disputers.size, outputRows: group.outputRows, outputItems: group.outputItems, approvedOutputs: group.approvedOutputs, pendingOutputs: group.pendingOutputs, returnedOutputs: group.returnedOutputs, fulltimeRows: group.fulltimeRows, outputPay: group.outputPay, totalPay: group.totalPay })).sort((left, right) => right.totalPay - left.totalPay || left.bossName.localeCompare(right.bossName));
}

export async function listManagerReportData(supabase: SupabaseServerClient, managerId: string, input: ManagerReportInput): Promise<ManagerReportData> {
  const accountsResult = await listManagerClientDirectory(supabase, { view: 'all', page: 1, pageSize: 250 });
  const accounts = accountsResult.accounts;
  const ids = accounts.map((account) => account.id).filter(Boolean);
  const [settingsResult, entitlementsResult] = await Promise.all([listManagerUserSettings(supabase, managerId, ids), listEntitlementLimits(supabase, ids)]);
  const outputQuery = await queryOutputApprovals(supabase, managerId, input.range);
  const errorMessage = accountsResult.errorMessage || settingsResult.errorMessage || entitlementsResult.errorMessage || outputQuery.error?.message || null;
  const rawOutputs = Array.isArray(outputQuery.data) ? outputQuery.data as RawOutputApproval[] : [];
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const bossNames = await Promise.all(rawOutputs.map((row) => resolveBossName(supabase, managerId, row)));
  const outputs = rawOutputs.map((row, index) => {
    const account = accountMap.get(row.disputer_id);
    const setting = settingsResult.settings[row.disputer_id];
    const outputCount = Math.max(1, Number(row.output_count || 1));
    const rateAmount = positiveMoney(row.rate_amount || setting?.per_output_rate || setting?.rate || 0);
    return { id: row.id, disputerId: row.disputer_id, disputerName: accountName(account), disputerEmail: account?.email || '', bossName: bossNames[index], clientName: row.client_name || 'Not set', roundLabel: row.round_label || 'Not set', status: row.status || 'recorded', outputType: row.is_per_output ? 'Per-output' : 'Full-time record', outputCount, rateAmount, estimatedPay: rowPay(row, setting), createdAt: row.created_at || '' };
  });
  const outputsByUser = new Map<string, ManagerReportOutputRow[]>();
  for (const row of outputs) outputsByUser.set(row.disputerId, [...(outputsByUser.get(row.disputerId) || []), row]);
  const totals = emptyTotals();
  totals.userCount = accounts.length;
  totals.activeUsers = accounts.filter((account) => account.account_status === 'active').length;
  totals.blockedUsers = accounts.filter((account) => account.account_status === 'disabled' || account.account_status === 'suspended').length;
  totals.totalOutputRows = outputs.length;
  totals.totalOutputItems = outputs.reduce((sum, row) => sum + row.outputCount, 0);
  totals.approvedRows = outputs.filter((row) => row.status === 'approved' || row.status === 'paid').length;
  totals.pendingRows = outputs.filter((row) => row.status === 'pending').length;
  totals.returnedRows = outputs.filter((row) => row.status === 'rejected').length;
  totals.fulltimeRows = outputs.filter((row) => row.outputType === 'Full-time record').length;
  const users = accounts.map((account) => {
    const setting = settingsResult.settings[account.id];
    const userOutputs = outputsByUser.get(account.id) || [];
    const isOutputBased = setting?.employment_type === 'output_based' || setting?.is_regular === false;
    const baseSalary = isOutputBased ? 0 : positiveMoney(setting?.base_salary || setting?.salary || 0);
    const approvedPay = userOutputs.reduce((sum, row) => sum + row.estimatedPay, 0);
    const pendingPay = userOutputs.filter((row) => row.status === 'pending').reduce((sum, row) => sum + row.outputCount * row.rateAmount, 0);
    const estimatedPay = baseSalary + approvedPay;
    totals.baseSalaryTotal += baseSalary; totals.approvedExtraPay += approvedPay; totals.pendingExtraPay += pendingPay; totals.estimatedPayTotal += estimatedPay;
    return { id: account.id, name: accountName(account), email: account.email || '', status: accountStatus(account), employmentType: employmentType(setting), baseSalary, perOutputRate: positiveMoney(setting?.per_output_rate || setting?.rate || 0), outputLimit: entitlementsResult.entitlements[account.id]?.effective_output_limit || null, outputs: userOutputs.reduce((sum, row) => sum + row.outputCount, 0), approvedOutputs: userOutputs.filter((row) => row.status === 'approved' || row.status === 'paid').reduce((sum, row) => sum + row.outputCount, 0), pendingOutputs: userOutputs.filter((row) => row.status === 'pending').reduce((sum, row) => sum + row.outputCount, 0), returnedOutputs: userOutputs.filter((row) => row.status === 'rejected').reduce((sum, row) => sum + row.outputCount, 0), estimatedPay };
  });
  const bosses = buildBossRows(outputs, users);
  return { input, accounts, entitlements: entitlementsResult.entitlements, settings: settingsResult.settings, outputs, users, bosses, totals, errorMessage };
}
