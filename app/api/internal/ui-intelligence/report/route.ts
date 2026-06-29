import { NextResponse } from 'next/server';
import { buildUIIntelligenceReport, FEATURE_CONTRACTS, UI_CONTRACTS } from '../../../../../lib/ui-intelligence';

export const dynamic = 'force-dynamic';

export async function GET() {
  const report = buildUIIntelligenceReport(UI_CONTRACTS, FEATURE_CONTRACTS, {});
  return NextResponse.json(report);
}
