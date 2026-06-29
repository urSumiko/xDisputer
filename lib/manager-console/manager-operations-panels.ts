export type ManagerOperationsPanel = 'monitoring' | 'access' | 'reports' | 'output_activity' | 'requests';
export type ManagerOperationsPanelInput = ManagerOperationsPanel | 'payroll' | 'output-activity';

export const managerOperationsPanels: Array<{ id: ManagerOperationsPanel; label: string; href: string; purpose: string }> = [
  { id: 'monitoring', label: 'Monitoring', href: '/admin?panel=monitoring', purpose: 'Monitor outputs and operational status of assigned users.' },
  { id: 'access', label: 'Access Control', href: '/admin?panel=access', purpose: 'Manage account status, approval, and operational metadata.' },
  { id: 'reports', label: 'Report', href: '/admin?panel=reports', purpose: 'Generate a clean operational report across users and outputs.' },
  { id: 'output_activity', label: 'Output Activity', href: '/admin/output-activity-v2', purpose: 'Confirm generated outputs before they affect payday pay.' },
  { id: 'requests', label: 'Request', href: '/admin?panel=requests', purpose: 'Review pending confirmations and account requests.' }
];

export function normalizeManagerOperationsPanel(value: string | string[] | undefined): ManagerOperationsPanel {
  const panel = Array.isArray(value) ? value[0] : value;
  if (panel === 'access' || panel === 'clients') return 'access';
  if (panel === 'reports' || panel === 'report') return 'reports';
  if (panel === 'payroll' || panel === 'output-activity' || panel === 'output_activity') return 'output_activity';
  if (panel === 'requests' || panel === 'request' || panel === 'intake' || panel === 'review') return 'requests';
  return 'monitoring';
}

export function managerOperationsNavItems(activePanelInput: ManagerOperationsPanelInput) {
  const activePanel = normalizeManagerOperationsPanel(activePanelInput);
  return [
    ...managerOperationsPanels.map((panel) => ({ href: panel.href, label: panel.label, active: panel.id === activePanel })),
    { href: '/manager-workspace', label: 'Switch mode', kind: 'workspace-switch' as const }
  ];
}
