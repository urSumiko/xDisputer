export type MasterConsoleUiWorkspaceMode = 'masterConsole' | 'uiWorkspace';
export type MasterConsoleUiWorkspaceRegion = 'primaryNav' | 'secondaryNav' | 'mainCanvas' | 'inspector' | 'bottomSwitch';

export const MASTER_CONSOLE_ROUTE = '/master';
export const MASTER_UI_WORKSPACE_ROUTE = '/master/ui-workspace';
export const MASTER_CONSOLE_UI_WORKSPACE_LABEL = 'Master Console ⇄ UI Workspace';

export const MASTER_CONSOLE_UI_WORKSPACE_REGIONS: MasterConsoleUiWorkspaceRegion[] = [
  'primaryNav',
  'secondaryNav',
  'mainCanvas',
  'inspector',
  'bottomSwitch'
];

export const MASTER_CONSOLE_UI_WORKSPACE_REGISTRY = {
  masterConsole: {
    mode: 'masterConsole',
    label: 'Master Console',
    route: MASTER_CONSOLE_ROUTE,
    targetMode: 'uiWorkspace',
    targetLabel: 'UI Workspace',
    targetRoute: MASTER_UI_WORKSPACE_ROUTE,
    switchLabel: MASTER_CONSOLE_UI_WORKSPACE_LABEL,
    layout: 'three-panel-console-shell',
    regions: MASTER_CONSOLE_UI_WORKSPACE_REGIONS,
    intent: 'Open UI Workspace',
    helper: 'Move from monitoring into the workspace for UI, navigation, content, behavior, theme, and preview planning.'
  },
  uiWorkspace: {
    mode: 'uiWorkspace',
    label: 'UI Workspace',
    route: MASTER_UI_WORKSPACE_ROUTE,
    targetMode: 'masterConsole',
    targetLabel: 'Master Console',
    targetRoute: MASTER_CONSOLE_ROUTE,
    switchLabel: MASTER_CONSOLE_UI_WORKSPACE_LABEL,
    layout: 'three-panel-console-shell',
    regions: MASTER_CONSOLE_UI_WORKSPACE_REGIONS,
    intent: 'Return to Master Console',
    helper: 'Return to account monitoring, workspace access, reports, audit review, and console health.'
  }
} as const;

export function masterConsoleUiModeFromConsoleMode(mode: 'operations' | 'workspace'): MasterConsoleUiWorkspaceMode {
  return mode === 'workspace' ? 'uiWorkspace' : 'masterConsole';
}

export function resolveMasterConsoleUiWorkspace(mode: MasterConsoleUiWorkspaceMode) {
  return MASTER_CONSOLE_UI_WORKSPACE_REGISTRY[mode];
}

export function resolveMasterConsoleUiWorkspaceFromConsoleMode(mode: 'operations' | 'workspace') {
  return resolveMasterConsoleUiWorkspace(masterConsoleUiModeFromConsoleMode(mode));
}
