import AccountMenu from '../console/AccountMenu';
import NotificationBell from '../notifications/NotificationBell';
import ClientMenuPopover from './ClientMenuPopover';

type ConsoleRole = 'manager' | 'master';
type ConsoleMode = 'operations' | 'workspace';

type Props = {
  role: ConsoleRole;
  mode: ConsoleMode;
  email?: string | null;
  displayName?: string | null;
  accountLabel: string;
  switchTarget: string;
  switchTargetLabel: string;
};

export default function TopbarActionCluster({ role, mode, email, displayName, accountLabel, switchTarget, switchTargetLabel }: Props) {
  return <div className="topbar-action-cluster manager-header-account-dock" data-topbar-action-cluster="true" data-console-component="TopbarActionCluster" data-console-account-role={role} data-console-mode={mode} data-manager-account-anchor="header-ratio-grid">
    <NotificationBell />
    <AccountMenu role={role} mode={mode} email={email} displayName={displayName} accountLabel={accountLabel} switchTarget={switchTarget} switchTargetLabel={switchTargetLabel} />
  </div>;
}

export function ClientTopbarActionCluster({ email, displayName }: { email?: string | null; displayName?: string | null }) {
  return <div className="topbar-action-cluster client-topbar-action-cluster" data-topbar-action-cluster="true" data-client-topbar-action-cluster="true">
    <NotificationBell />
    <ClientMenuPopover email={email} displayName={displayName} />
  </div>;
}
