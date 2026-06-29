import type { ReactNode } from 'react';
import ManagerConsoleShell from '../../ManagerConsoleShell';
import { templateWorkspaceNavForPath } from '../../../lib/templates/workspace/template-workspace-navigation';
import type { SessionContext } from '../../../lib/saas/session';

type Props = {
  session: SessionContext & { user: NonNullable<SessionContext['user']> };
  activeHref: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function TemplateWorkspaceShell({ session, activeHref, title, description, children }: Props) {
  return <ManagerConsoleShell
    role={session.isMaster ? 'master' : 'manager'}
    mode="workspace"
    email={session.user.email}
    accountName={session.profile?.full_name || session.user.user_metadata?.full_name as string | null | undefined}
    accountLabel={session.isMaster ? 'Master template authority' : 'Manager template authority'}
    navItems={templateWorkspaceNavForPath(activeHref)}
    header={{ eyebrow: 'Manager workspace', title, description }}
  >
    {children}
  </ManagerConsoleShell>;
}
