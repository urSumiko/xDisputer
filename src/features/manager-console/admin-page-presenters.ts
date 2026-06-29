import type { AccountDirectoryListResult, AccountDirectoryRow } from '../../../lib/saas/account-directory';
import type { EntitlementLimitMap } from '../../../lib/saas/entitlement-limits';

export const emptyDirectoryResult: AccountDirectoryListResult = {
  accounts: [],
  total: 0,
  page: 1,
  pageSize: 8,
  errorMessage: null
};

export function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

export function money(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    currencyDisplay: 'symbol',
    maximumFractionDigits: 0
  }).format(Math.round(value || 0));
}

export function statusText(value: string | null | undefined) {
  if (value === 'pending_manager_assignment') return 'Waiting for invite';
  if (value === 'pending_manager_approval') return 'Pending approval';
  if (value === 'active') return 'Active';
  if (value === 'suspended') return 'Paused';
  if (value === 'disabled') return 'Disabled';
  return value || 'Pending';
}

export function outputUsage(entitlements: EntitlementLimitMap, accountId: string) {
  const row = entitlements[accountId];
  const used = row?.output_used_today || 0;
  const effective = typeof row?.effective_output_limit === 'number' && row.effective_output_limit > 0 ? row.effective_output_limit : null;
  return effective === null ? `${used} used · Manager cap not set` : `${used}/${effective} outputs today`;
}

export function uniqueAccounts(...groups: AccountDirectoryRow[][]) {
  const map = new Map<string, AccountDirectoryRow>();
  groups.flat().forEach((account) => map.set(account.id, account));
  return Array.from(map.values());
}
