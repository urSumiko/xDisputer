export const BOSS_NOT_ASSIGNED = 'Boss not assigned';

export type BossReportingContract = {
  version: '2026-06-30.boss-reporting-contract.v1';
  structuredTables: string[];
  structuredColumns: string[];
  legacyFallbacks: string[];
  reportTypes: string[];
};

export const BOSS_REPORTING_CONTRACT: BossReportingContract = {
  version: '2026-06-30.boss-reporting-contract.v1',
  structuredTables: ['bosses', 'disputer_boss_assignments'],
  structuredColumns: ['manager_disputer_output_approvals.boss_id'],
  legacyFallbacks: ['manager_disputer_output_approvals.notes'],
  reportTypes: ['per_boss']
};

export function normalizeBossReportName(value: string | null | undefined) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  return clean || BOSS_NOT_ASSIGNED;
}

export function bossNameFromLegacyNotes(notes: string | null | undefined) {
  const clean = normalizeBossReportName(notes);
  if (clean === BOSS_NOT_ASSIGNED) return clean;

  const tagged = clean.match(/(?:^|\b)(?:boss|team lead|leader)\s*[:=-]\s*(.+)$/i)?.[1];
  return normalizeBossReportName(tagged || clean);
}

export function bossReportingContractSummary() {
  return {
    ...BOSS_REPORTING_CONTRACT,
    fallbackStatus: 'Legacy notes fallback remains supported until boss_id is populated by migration and assignment workflow.'
  };
}
