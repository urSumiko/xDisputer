import { NextResponse } from 'next/server';
import { getStaticIntegrationHealth } from '../../../lib/saas/integration-health';

export async function GET() {
  return NextResponse.json({
    ok: true,
    integrations: getStaticIntegrationHealth(),
    checkedAt: new Date().toISOString()
  });
}
