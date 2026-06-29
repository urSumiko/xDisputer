import GenerationReportView from '../../../components/GenerationReportView';
import {
  activeGenerationFilterCount,
  generationReportQueryString,
  listGenerationReport,
  normalizeGenerationReportFilters
} from '../../../lib/saas/generation-reports';
import { requireRole } from '../../../lib/saas/session';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const MASTER_REPORT_LIMIT = 120;

export default async function MasterReportsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = normalizeGenerationReportFilters(params);
  const activeCount = activeGenerationFilterCount(filters);
  const exportHref = `/master/reports/export${generationReportQueryString(filters)}`;

  const { user, profile, supabase } = await requireRole('master');
  const { rows, summary, errorMessage } = await listGenerationReport(supabase, 'master', MASTER_REPORT_LIMIT, filters);

  return <GenerationReportView
    scope="master"
    accountEmail={profile?.email || user.email || 'Master account'}
    action="/master/reports"
    exportHref={exportHref}
    filters={filters}
    activeCount={activeCount}
    rows={rows}
    summary={summary}
    title="Generation activity."
    eyebrow="Master report"
    description="Minimal platform visibility: usage, failures, top activity, and recent events in one clean report."
    errorMessage={errorMessage}
  />;
}
