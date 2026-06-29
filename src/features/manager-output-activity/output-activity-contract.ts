export const outputActivityContract = {
  owner: 'src/features/manager-output-activity',
  table: 'public.manager_disputer_output_approvals',
  managerPage: 'app/admin/output-activity-v2/page.tsx',
  decisionRoute: 'app/api/manager-output-decision/route.ts',
  generationRoute: 'app/api/generation-runs/route.ts',
  defaultRateAmount: 0,
  sourceGeneratedPayable: 'generation_success_per_output',
  sourceGeneratedRecorded: 'generation_success_recorded',
  filters: {
    all: 'all',
    perOutput: 'per_output',
    notPerOutput: 'not_per_output'
  },
  status: {
    recorded: 'recorded',
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    paid: 'paid'
  }
} as const;

export type OutputActivityStatus = keyof typeof outputActivityContract.status;
export type OutputActivityFilter = typeof outputActivityContract.filters[keyof typeof outputActivityContract.filters];

export function outputActivityStatusLabel(value: string | null | undefined, isPerOutput = true) {
  if (!isPerOutput || value === outputActivityContract.status.recorded) return 'Fulltime Output';
  if (value === outputActivityContract.status.approved || value === outputActivityContract.status.paid) return 'Confirmed';
  if (value === outputActivityContract.status.rejected) return 'Returned';
  return 'Pending manager confirmation';
}

export function outputActivityPayAmount(outputCount: number, rateAmount: number, isPerOutput = true) {
  if (!isPerOutput) return 0;
  const count = Number.isFinite(outputCount) ? Math.max(0, outputCount) : 0;
  const rate = Number.isFinite(rateAmount) ? Math.max(0, rateAmount) : 0;
  return count * rate;
}

export function normalizeOutputActivityFilter(value: string | string[] | undefined): OutputActivityFilter {
  const input = Array.isArray(value) ? value[0] : value;
  if (input === outputActivityContract.filters.perOutput) return outputActivityContract.filters.perOutput;
  if (input === outputActivityContract.filters.notPerOutput) return outputActivityContract.filters.notPerOutput;
  return outputActivityContract.filters.all;
}
