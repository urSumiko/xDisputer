import { NextResponse, type NextRequest } from 'next/server';
import {
  generationRowsToCsv,
  listGenerationReport,
  normalizeGenerationReportFilters
} from '../../../../lib/saas/generation-reports';
import { requireRole } from '../../../../lib/saas/session';

export async function GET(request: NextRequest) {
  const { supabase } = await requireRole('master');
  const filters = normalizeGenerationReportFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const { rows, errorMessage } = await listGenerationReport(supabase, 'master', 2000, filters);

  if (errorMessage) {
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  return new NextResponse(generationRowsToCsv(rows, 'master'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="master-generation-report.csv"'
    }
  });
}
