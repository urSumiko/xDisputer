import { NextResponse } from 'next/server';
import { confirmRuntimeBridge } from '../../../../lib/saas/runtime-confirmation';

export async function GET() {
  const report = await confirmRuntimeBridge();

  return NextResponse.json(report, {
    status: report.summary.status === 'fail' ? 500 : 200
  });
}
