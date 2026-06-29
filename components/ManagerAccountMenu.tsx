'use client';

import AccountMenu from './console/AccountMenu';

type Props = {
  email?: string | null;
  accountLabel: string;
  mode: 'operations' | 'workspace';
  switchTarget: string;
  switchTargetLabel: string;
  role?: 'manager' | 'master';
};

function inferRole(accountLabel: string, switchTarget: string): 'manager' | 'master' {
  if (accountLabel.toLowerCase().includes('master')) return 'master';
  return switchTarget.startsWith('/master') ? 'manager' : 'manager';
}

export default function ManagerAccountMenu({ role, ...props }: Props) {
  return <AccountMenu role={role || inferRole(props.accountLabel, props.switchTarget)} {...props} />;
}
