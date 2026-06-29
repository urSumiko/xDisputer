import type { ReactNode } from 'react';
import type { ClientWorkspacePanel } from '../client-workspace-contract';
import { clientWorkspaceHeaderLabel } from '../client-workspace-contract';

type ClientWorkspaceHeaderProps = {
  panel: ClientWorkspacePanel;
  round: string;
  statusVisible: boolean;
  status: string;
  statusTone: 'info' | 'success' | 'error';
  actions?: ReactNode;
};

export default function ClientWorkspaceHeader({ panel, round, statusVisible, status, statusTone, actions }: ClientWorkspaceHeaderProps) {
  return <header className="header native-command-hero" data-console-header-primary="true" data-client-workspace-component="header"><div><p className="eyebrow">{clientWorkspaceHeaderLabel(panel, round)}</p><h1>{panel}</h1>{statusVisible && <p className={`workspace-operation-status ${statusTone}`} role={statusTone === 'error' ? 'alert' : 'status'} aria-live="polite">{status}</p>}</div><div className="workspace-header-actions">{actions}</div></header>;
}
