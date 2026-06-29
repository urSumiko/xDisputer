import { notFound, redirect } from 'next/navigation';
import ManagerConsoleShell from '../ManagerConsoleShell';
import ConsoleTransformationPanel from './ConsoleTransformationPanel';
import { requireAuth, requireRole } from '../../lib/saas/session';
import { getPanelByHref, navItemsForDomain, panelsForDomain, CONSOLE_DOMAIN_DESCRIPTIONS, CONSOLE_DOMAIN_LABELS } from '../../lib/console/contracts/navigation-manifest';

export default async function ConsolePanelRoutePage({ route }: { route: string }) {
  const panel = getPanelByHref(route);
  if (!panel) notFound();

  if (panel.domain === 'manager-authoring') {
    const session = await requireAuth();
    if (!session.isManager && !session.isMaster) redirect(session.dashboardPath);
    const role = session.isMaster ? 'master' : 'manager';
    return <ManagerConsoleShell
      role={role}
      mode="workspace"
      email={session.user.email}
      accountLabel={session.isMaster ? 'Master template authority' : 'Manager template authority'}
      navItems={navItemsForDomain('manager-authoring', route)}
      header={{ eyebrow: CONSOLE_DOMAIN_LABELS[panel.domain], title: panel.label, description: CONSOLE_DOMAIN_DESCRIPTIONS[panel.domain] }}
    >
      <ConsoleTransformationPanel panel={panel} relatedPanels={panelsForDomain(panel.domain)} />
    </ManagerConsoleShell>;
  }

  if (panel.domain === 'manager-operations') {
    const { user, profile } = await requireRole('manager');
    return <ManagerConsoleShell
      mode="operations"
      email={profile?.email || user.email}
      accountLabel="Manager account"
      navItems={navItemsForDomain('manager-operations', route)}
      header={{ eyebrow: CONSOLE_DOMAIN_LABELS[panel.domain], title: panel.label, description: CONSOLE_DOMAIN_DESCRIPTIONS[panel.domain] }}
    >
      <ConsoleTransformationPanel panel={panel} relatedPanels={panelsForDomain(panel.domain)} />
    </ManagerConsoleShell>;
  }

  const { user, profile } = await requireRole('master');
  return <ManagerConsoleShell
    role="master"
    mode="operations"
    email={profile?.email || user.email}
    accountLabel="Master account"
    navItems={navItemsForDomain('master-governance', route)}
    header={{ eyebrow: CONSOLE_DOMAIN_LABELS[panel.domain], title: panel.label, description: CONSOLE_DOMAIN_DESCRIPTIONS[panel.domain] }}
  >
    <ConsoleTransformationPanel panel={panel} relatedPanels={panelsForDomain(panel.domain)} />
  </ManagerConsoleShell>;
}
