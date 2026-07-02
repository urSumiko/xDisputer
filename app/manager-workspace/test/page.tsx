import { redirect } from 'next/navigation';
import TemplateTestLabHub from '../../../components/templates/workspace/TemplateTestLabHub';
import TemplateWorkspaceShell from '../../../components/templates/workspace/TemplateWorkspaceShell';
import { requireAuth } from '../../../lib/saas/session';
import { buildTemplateTestLabContext } from '../../../lib/templates/workspace/template-test-lab-service';
import type { TemplateRound } from '../../../lib/templates/workspace/template-workspace-contract';

const allowedRounds: TemplateRound[] = ['1st Round', '2nd Round', '3rd Round', 'Final'];
type SearchParams = Record<string, string | string[] | undefined>;

function parseRound(value: string | string[] | undefined): TemplateRound {
  const text = Array.isArray(value) ? value[0] : value;
  return allowedRounds.includes(text as TemplateRound) ? text as TemplateRound : '1st Round';
}

function parsePacket(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  return text === 'LATE_PAYMENT' ? 'LATE_PAYMENT' : 'DISPUTE';
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerTemplateTestLabPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await requireAuth();
  if (!session.isManager && !session.isMaster) redirect(session.dashboardPath);

  const params = await searchParams;
  const round = parseRound(params?.round);
  const packet = parsePacket(params?.packet);
  const context = await buildTemplateTestLabContext({ supabase: session.supabase, managerId: session.user.id, round, packet });

  return <TemplateWorkspaceShell
    session={session}
    activeHref="/manager-workspace/test"
    title="Template Test Lab"
    description="Preview sample generated output and retrieve active manager template files before release."
  >
    <TemplateTestLabHub context={context} />
  </TemplateWorkspaceShell>;
}
