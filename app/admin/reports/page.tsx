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

const MANAGER_REPORT_LIMIT = 80;

export default async function ManagerReportsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = normalizeGenerationReportFilters(params);
  const activeCount = activeGenerationFilterCount(filters);
  const exportHref = `/admin/reports/export${generationReportQueryString(filters)}`;

  const { user, profile, supabase } = await requireRole('manager');
  const { rows, summary, errorMessage } = await listGenerationReport(supabase, 'manager', MANAGER_REPORT_LIMIT, filters);

  return <GenerationReportView
    scope="manager"
    accountEmail={profile?.email || user.email || 'Manager account'}
    action="/admin/reports"
    exportHref={exportHref}
    filters={filters}
    activeCount={activeCount}
    rows={rows}
    summary={summary}
    title="Client activity."
    eyebrow="Manager report"
    description="Minimal workspace visibility: recent generated packages, failures, and top activity."
    errorMessage={errorMessage}
  />;
}
