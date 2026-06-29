export type AccountRoleLike = string | null | undefined;

export const PLATFORM_ACCOUNT_TERMS = {
  master: 'Master',
  manager: 'Manager',
  disputer: 'Disputer',
  admin: 'Manager'
} as const;

export function displayAccountRole(role: AccountRoleLike) {
  if (role === 'master') return PLATFORM_ACCOUNT_TERMS.master;
  if (role === 'manager' || role === 'admin') return PLATFORM_ACCOUNT_TERMS.manager;
  if (role === 'client' || role === 'disputer') return PLATFORM_ACCOUNT_TERMS.disputer;
  return role ? role : 'Account';
}

export function displayAccountRoleLower(role: AccountRoleLike) {
  return displayAccountRole(role).toLowerCase();
}

export function displayAccountRoleBadge(role: AccountRoleLike) {
  return displayAccountRole(role).toUpperCase();
}

export function displayAccountRoleContext(role: AccountRoleLike) {
  return `${displayAccountRole(role)} account`;
}

export function replaceClientUserTerms(value: string) {
  return value
    .replace(/client user/gi, 'Disputer')
    .replace(/client account/gi, 'Disputer account')
    .replace(/client limits/gi, 'Disputer limits')
    .replace(/client output/gi, 'Disputer output')
    .replace(/client usage/gi, 'Disputer usage')
    .replace(/active clients/gi, 'active Disputers')
    .replace(/assigned clients/gi, 'assigned Disputers')
    .replace(/all clients/gi, 'all Disputers')
    .replace(/active client/gi, 'active Disputer')
    .replace(/clients available/gi, 'Disputers available')
    .replace(/clients\b/gi, 'Disputers')
    .replace(/client\b/gi, 'Disputer');
}

export function productionFriendlyAccountText(value: string) {
  return replaceClientUserTerms(value)
    .replace(/backend roles?/gi, 'account authority')
    .replace(/backend access/gi, 'account access')
    .replace(/backend/gi, 'system')
    .replace(/frontend/gi, 'interface')
    .replace(/API routes?/gi, 'service connection')
    .replace(/route handlers?/gi, 'service handlers')
    .replace(/SQL functions?/gi, 'saved rules')
    .replace(/SQL/gi, 'saved rules')
    .replace(/Supabase/gi, 'database')
    .replace(/database rows?/gi, 'records')
    .replace(/debug/gi, 'diagnostic');
}

export function documentSubjectLabel() {
  return 'Client';
}
