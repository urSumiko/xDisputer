import { NextResponse } from 'next/server';
import { repositoryContractSummary } from '../../../../lib/repository-contract-map';
import { databaseContractSummary } from '../../../../lib/supabase/db-rpc-contract';
import { pdfConversionPolicy } from '../../../../lib/pdf-conversion-policy';
import { bossReportingContractSummary } from '../../../../lib/manager-console/boss-reporting-contract';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    repository: repositoryContractSummary(),
    database: databaseContractSummary(),
    pdf: pdfConversionPolicy(),
    bossReporting: bossReportingContractSummary()
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}
