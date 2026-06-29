'use client';

import type { ClientWorkspacePanel } from '../client-workspace-contract';

type ClientWorkspaceNavigationProps = {
  panels: ClientWorkspacePanel[];
  activePanel: ClientWorkspacePanel;
  outputsDisabled: boolean;
  onSelect: (panel: ClientWorkspacePanel) => void;
};

export default function ClientWorkspaceNavigation({ panels, activePanel, outputsDisabled, onSelect }: ClientWorkspaceNavigationProps) {
  return <nav data-client-workspace-component="navigation">{panels.map((item) => <button key={item} className={activePanel === item ? 'active' : ''} disabled={item === 'Outputs' && outputsDisabled} onClick={() => onSelect(item)}><strong>{item}</strong></button>)}</nav>;
}
