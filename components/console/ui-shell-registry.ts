export type UiShellRouteExpectation = {
  path: string;
  role: 'manager' | 'master';
  mode: 'operations' | 'workspace';
  owner: string;
};

export const UI_SHELL_ROUTE_EXPECTATIONS: UiShellRouteExpectation[] = [
  { path: '/admin', role: 'manager', mode: 'operations', owner: 'components/ManagerConsoleShell.tsx' },
  { path: '/manager-workspace', role: 'manager', mode: 'workspace', owner: 'components/ManagerConsoleShell.tsx' },
  { path: '/admin/access', role: 'manager', mode: 'operations', owner: 'app/admin/access/page.tsx' },
  { path: '/admin/clients', role: 'manager', mode: 'operations', owner: 'app/admin/clients/page.tsx' },
  { path: '/admin/reports', role: 'manager', mode: 'operations', owner: 'components/GenerationReportView.tsx' },
  { path: '/admin/audit', role: 'manager', mode: 'operations', owner: 'components/AccessAuditView.tsx' },
  { path: '/master', role: 'master', mode: 'operations', owner: 'app/master/MasterConsoleHome.tsx' },
  { path: '/master/accounts', role: 'master', mode: 'operations', owner: 'app/master/accounts/page.tsx' },
  { path: '/master/reports', role: 'master', mode: 'operations', owner: 'components/GenerationReportView.tsx' },
  { path: '/master/audit', role: 'master', mode: 'operations', owner: 'components/AccessAuditView.tsx' },
  { path: '/master/system', role: 'master', mode: 'operations', owner: 'app/master/system/page.tsx' },
  { path: '/master/recovery', role: 'master', mode: 'operations', owner: 'app/master/recovery/page.tsx' }
];

export const UI_SHELL_FORBIDDEN_SOURCE_PATTERNS = [
  '<aside className="admin-monitor-sidebar',
  '<section className="admin-monitor-main',
  'className="admin-monitor-account"',
  '<ManagerWorkspaceSwitch',
  '<WorkspaceSwitchAnchor',
  'data-manager-switch-visible-slot="plain-nav-button"'
];

export const UI_SHELL_CANONICAL_COMPONENTS = {
  shell: 'components/console/ConsoleShell.tsx',
  sidebar: 'components/console/ConsoleShell.tsx',
  header: 'components/console/ConsoleHeader.tsx',
  accountMenu: 'components/console/AccountMenu.tsx',
  renderDebugger: 'components/console/RenderDebugger.tsx',
  templateExecution: 'lib/template-execution/template-execution-orchestrator.ts'
} as const;

export const UI_SHELL_RUNTIME_SIGNALS = {
  renderDebuggerStore: '__xdisputerDebug',
  templateExecutionStore: '__xdisputerTemplateExecution',
  templateExecutionEvent: 'xdisputer:template-execution'
} as const;
