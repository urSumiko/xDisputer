import { NextRequest, NextResponse } from 'next/server';
import { buildUIIntelligenceReport, FEATURE_CONTRACTS, traceRootCause, UI_CONTRACTS } from '../../../../../lib/ui-intelligence';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as { problem?: string; route?: string }));
  const problem = typeof body.problem === 'string' && body.problem.trim() ? body.problem.trim() : 'Unknown UI issue';
  const route = typeof body.route === 'string' ? body.route : undefined;
  const report = buildUIIntelligenceReport(UI_CONTRACTS, FEATURE_CONTRACTS, {});
  return NextResponse.json(traceRootCause(problem, UI_CONTRACTS, report.findings, route));
}
