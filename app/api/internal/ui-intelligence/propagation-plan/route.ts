import { NextRequest, NextResponse } from 'next/server';
import { createPropagationPlan, UI_CONTRACTS } from '../../../../../lib/ui-intelligence';
import type { ChangePropagationPlan } from '../../../../../lib/ui-intelligence';

export const dynamic = 'force-dynamic';

const ALLOWED_CHANGE_TYPES: ChangePropagationPlan['changeType'][] = ['ui', 'ux', 'function', 'process', 'template', 'navigation'];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as { sourceContractId?: string; changeType?: ChangePropagationPlan['changeType'] }));
  const sourceContractId = typeof body.sourceContractId === 'string' ? body.sourceContractId : 'console-shell';
  const changeType = ALLOWED_CHANGE_TYPES.includes(body.changeType as ChangePropagationPlan['changeType']) ? body.changeType as ChangePropagationPlan['changeType'] : 'ui';
  return NextResponse.json(createPropagationPlan(UI_CONTRACTS, sourceContractId, changeType));
}
