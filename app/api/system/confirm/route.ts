import { NextResponse } from 'next/server';
import { confirmOperationalSetup } from '../../../../lib/saas/operational-confirmation';

export async function GET() {
  const report = await confirmOperationalSetup();
  return NextResponse.json(report, {
    status: report.summary.status === 'fail' ? 500 : 200
  });
}
