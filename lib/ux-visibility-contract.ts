export type UxPanel = string;
export type UxTone = 'info' | 'success' | 'error';

const sourceDataPanel = 'Source Data';
const outputsPanel = 'Outputs';

export type UxVisibilityInput = {
  /**
   * Panel names are owned by the workspace shell. This contract only needs to
   * know which panels require special warning/preflight behavior, so it accepts
   * any current or future panel label without breaking typecheck when navigation
   * changes.
   */
  panel: UxPanel;
  statusTone: UxTone;
  hasSource: boolean;
  hasPreflightBlockers: boolean;
  hasPreflightWarnings: boolean;
  generateAttempted: boolean;
  busy: boolean;
  hasGeneratedOutput: boolean;
};

export type UxVisibilityRules = {
  showHeaderNextAction: boolean;
  showStatusText: boolean;
  showPreflightPanel: boolean;
  showOutputWarnings: boolean;
  showBusyState: boolean;
  allowGlobalWarningSurface: boolean;
  compressEmptyAssetContainers: boolean;
  hideSecondaryManagementTools: boolean;
};

export function resolveUxVisibility(input: UxVisibilityInput): UxVisibilityRules {
  const inSourceData = input.panel === sourceDataPanel && input.hasSource;
  const blockedNow = inSourceData && input.hasPreflightBlockers;
  const reviewNeededNow = inSourceData && input.hasPreflightWarnings && (input.generateAttempted || input.statusTone === 'error');

  return {
    // Permanently retire the header progress/next-action tracker (for example "1/8 Start case").
    // Client errors now surface at the exact workflow stage where the user action failed.
    showHeaderNextAction: false,
    showStatusText: input.statusTone === 'success' || input.statusTone === 'error' || input.busy,
    showPreflightPanel: blockedNow || reviewNeededNow,
    showOutputWarnings: input.panel === outputsPanel && input.hasGeneratedOutput,
    showBusyState: input.busy,
    allowGlobalWarningSurface: false,
    compressEmptyAssetContainers: true,
    hideSecondaryManagementTools: true
  };
}

export function shouldKeepMainLayoutQuiet(rules: UxVisibilityRules) {
  return !rules.showStatusText && !rules.showPreflightPanel && !rules.showBusyState;
}

export function shouldRevealPreflightAfterAction(rules: UxVisibilityRules) {
  return rules.showPreflightPanel;
}
